"""Browser Use adapter for the PSS-WebTest v0.2 run-record protocol.

The adapter owns the Browser Use session, keeps only redacted action summaries,
and writes screenshot replay frames separately from the immutable ledger. It
does not expose DOM dumps, typed values, credentials, or model responses.
"""

import asyncio
import base64
import hashlib
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from browser_use import Agent, Browser, ChatOpenAI


def safe_path(url: str) -> str:
    if not url or url.startswith("about:blank"):
        return "/blank"
    return urlparse(url).path or "/"


def milestone(url: str) -> str:
    path = safe_path(url)
    if path == "/login":
        return "login"
    if path == "/":
        return "authenticated-home"
    if path == "/books":
        return "books-list"
    if path == "/books/book":
        return "book-overview"
    return "other"


def safe_action(model) -> dict:
    data = model.model_dump(exclude_none=True, mode="json") if hasattr(model, "model_dump") else {}
    if not data:
        return {"type": "unknown"}
    name, params = next(iter(data.items()))
    result = {"type": str(name)[:80]}
    if isinstance(params, dict):
        if isinstance(params.get("index"), int):
            result["index"] = params["index"]
        if isinstance(params.get("text"), str):
            result["text_redacted"] = True
            result["text_length"] = len(params["text"])
        if isinstance(params.get("keys"), str):
            result["keys"] = params["keys"][:32]
        if isinstance(params.get("url"), str):
            result["url_path"] = safe_path(params["url"])
        if isinstance(params.get("seconds"), (int, float)):
            result["seconds"] = max(0, min(300, params["seconds"]))
    return result


async def main() -> None:
    started = time.time()
    run_id = os.environ.get("PSS_RUN_ID", f"bookstack-browser-use-{int(started * 1000)}")
    base_url = os.environ.get("BOOKSTACK_BASE_URL", "http://127.0.0.1:8081")
    replay_root = Path(os.environ.get("PSS_REPLAY_ROOT", str(Path(__file__).resolve().parents[2] / "artifacts" / "phase2" / "replays")))
    replay_dir = replay_root / run_id
    replay_dir.mkdir(parents=True, exist_ok=True)
    frames = []
    provider_events = []
    trace = []
    frame_index = 0
    last_state_url = ""
    last_heading_count = 0

    async def capture(state=None, step=None, action=None, phase="step", provider_ids=None):
        nonlocal frame_index
        image_b64 = getattr(state, "screenshot", None) if state is not None else None
        try:
            image = base64.b64decode(image_b64) if image_b64 else await browser.take_screenshot(format="png")
        except Exception:
            return
        filename = f"{frame_index:03d}-{phase}-step-{int(step) if isinstance(step, int) else 0:02d}.png"
        frame_index += 1
        (replay_dir / filename).write_bytes(image)
        url = getattr(state, "url", None) or await browser.get_current_page_url()
        safe_state = {"milestone": milestone(url), "url_path": safe_path(url), "authenticated": safe_path(url) != "/login"}
        frame = {
            "id": f"{phase}-{frame_index - 1}",
            "filename": filename,
            "phase": phase,
            "step": step if isinstance(step, int) else None,
            "url": url,
            "action": action,
            "screenshot_digest": hashlib.sha256(image).hexdigest(),
            "state": safe_state,
            "provider_event_ids": list(provider_ids or []),
        }
        frames.append(frame)

    async def on_step(state, model_output, step):
        nonlocal last_state_url, last_heading_count
        actions = [safe_action(item) for item in (getattr(model_output, "action", None) or [])]
        last_state_url = getattr(state, "url", "") or last_state_url
        if safe_path(last_state_url) == "/books/book":
            try:
                current_page = await browser.get_current_page()
                if current_page is not None:
                    last_heading_count = int(await current_page.evaluate("(target) => Array.from(document.querySelectorAll('h1,h2,h3')).filter((e) => (e.textContent || '').trim() === target).length", "Book"))
            except Exception:
                last_heading_count = 0
        event_id = f"provider-{len(provider_events):03d}"
        provider_events.append({"id": event_id, "step": int(step) if isinstance(step, int) else None, "action_count": len(actions), "has_tool_call": bool(actions)})
        trace.append({"step": int(step) if isinstance(step, int) else None, "url_path": safe_path(getattr(state, "url", "")), "actions": actions})
        await capture(state=state, step=step, action=actions[0] if actions else None, phase="step", provider_ids=[event_id])

    browser = Browser(
        headless=True,
        user_data_dir="/private/tmp/pss-browser-use-pilot-profile",
        allowed_domains=["127.0.0.1", "localhost"],
        enable_default_extensions=False,
    )
    llm = ChatOpenAI(
        model=os.environ["CUA_MODEL"],
        api_key=os.environ["CUA_API_KEY"],
        base_url=os.environ["CUA_BASE_URL"],
        timeout=int(os.environ.get("CUA_TIMEOUT_MS", "30000")) / 1000,
        max_retries=1,
    )
    task = (
        f"Go to {base_url}/ and complete this local-only navigation task. "
        "Use the available sensitive placeholders for the BookStack email and password to log in. "
        "Then click Books and the visible book named exactly Book. Stop at the exact Book overview "
        "route /books/book. Do not create or edit content and do not visit any external domain."
    )
    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        sensitive_data={"email": os.environ["PSS_BOOKSTACK_USERNAME"], "password": os.environ["PSS_BOOKSTACK_PASSWORD"]},
        use_vision=True,
        max_failures=2,
        max_actions_per_step=3,
        step_timeout=max(10, int(os.environ.get("CUA_TIMEOUT_MS", "30000")) // 1000),
        llm_timeout=max(10, int(os.environ.get("CUA_TIMEOUT_MS", "30000")) // 1000),
        enable_signal_handler=False,
        use_judge=False,
        directly_open_url=True,
        register_new_step_callback=on_step,
    )
    history = None
    failure = None
    try:
        history = await asyncio.wait_for(agent.run(max_steps=int(os.environ.get("CUA_MAX_STEPS", "10"))), timeout=float(os.environ.get("CUA_AGENT_WALL_TIMEOUT_MS", "120000")) / 1000)
    except Exception as error:  # bounded provider/framework failure
        failure = {"name": type(error).__name__, "message": str(error)[:240]}

    final_url = await browser.get_current_page_url()
    final_page = await browser.get_current_page()
    heading_count = 0
    if final_page is not None:
        try:
            heading_count = int(await final_page.evaluate("(target) => Array.from(document.querySelectorAll('h1,h2,h3')).filter((e) => (e.textContent || '').trim() === target).length", "Book"))
        except Exception:
            heading_count = 0
    # Browser Use may tear down its owned session immediately after emitting a
    # done action. Prefer the last model-visible state for the independent
    # route/heading oracle when the post-run session is already blank.
    oracle_url = final_url if safe_path(final_url) != "/blank" else last_state_url
    oracle_heading_count = heading_count or last_heading_count
    oracle_passed = safe_path(oracle_url) == "/books/book" and oracle_heading_count > 0
    if final_page is not None:
        await capture(state=None, step=len(trace), phase="final", provider_ids=[])
    agent_success = bool(history and history.is_successful() is True)
    final_result = str(history.final_result() or "") if history else ""
    if failure:
        failure_category = "provider-timeout" if "Timeout" in failure["name"] or "timeout" in failure["message"].lower() else "provider-api"
        status = "timeout" if failure_category == "provider-timeout" else "test-failure"
    elif oracle_passed and agent_success:
        failure_category = None
        status = "completed"
    else:
        failure_category = "agent-verdict" if oracle_passed else "oracle"
        status = "evaluator-error"
    replay = {
        "schema_version": "replay-v1",
        "run_id": run_id,
        "application_id": "bookstack",
        "task_id": "bookstack-open-book",
        "arm": "hybrid",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "outcome": {"status": status, "checkpoint_reached": oracle_passed, "emitted_verdict": "clean" if agent_success else "not-emitted", "ground_truth_verdict": "clean", "failure_category": failure_category, "oracle_passed": oracle_passed, "error": failure},
        "frames": frames,
        "provider_events": provider_events,
    }
    (replay_root / f"{run_id}.json").write_text(json.dumps(replay, indent=2) + "\n")
    summary = {
        "framework": "browser-use",
        "framework_version": "0.13.10",
        "run_id": run_id,
        "task_id": "bookstack-open-book",
        "status": status,
        "strict_pass": status == "completed",
        "checkpoint_reached": oracle_passed,
        "agent_success": agent_success,
        "oracle_passed": oracle_passed,
        "final_url_path": safe_path(oracle_url),
        "heading_count": oracle_heading_count,
        "wall_time_ms": round((time.time() - started) * 1000),
        "actions": len(trace),
        "retries": 0,
        "failure_category": failure_category,
        "failure": failure,
        "trace": trace,
        "replay_manifest": str(replay_root / f"{run_id}.json"),
        "replay_frame_count": len(frames),
        "provider_event_count": len(provider_events),
        "final_result_digest": hashlib.sha256(final_result.encode()).hexdigest() if final_result else None,
    }
    print(f"PSS_FRAMEWORK_RESULT:{json.dumps(summary, ensure_ascii=False)}", flush=True)
    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
