"""Exploratory Browser Use smoke against the local BookStack navigation task.

This is intentionally not a confirmatory run-record producer: the framework
history contains provider/model-specific traces and is kept out of Git. The
summary written here is redacted and only records task-level feasibility.
"""

import asyncio
import json
import os
import time
from pathlib import Path

from browser_use import Agent, Browser, ChatOpenAI

from pss_framework_version import require_env, require_installed, run_scoped_profile_dir

# Read from the installed distribution, never from a literal.
FRAMEWORK_VERSION = require_installed("browser-use")


async def main() -> None:
    started = time.time()
    base_url = os.environ.get("BOOKSTACK_BASE_URL", "http://127.0.0.1:8081")
    run_id = os.environ.get("PSS_RUN_ID", f"browser-use-smoke-{int(started * 1000)}")
    output_path = Path(os.environ.get(
        "PSS_FRAMEWORK_TASK_SMOKE_OUT",
        str(Path(__file__).resolve().parents[2] / "research" / "framework-task-smoke-2026-09-09.json"),
    ))
    browser = Browser(
        headless=True,
        user_data_dir=str(run_scoped_profile_dir(run_id, "browser-use-smoke")),
        allowed_domains=["127.0.0.1", "localhost"],
        enable_default_extensions=False,
    )
    provider = require_env(["CUA_MODEL", "CUA_API_KEY", "CUA_BASE_URL"])
    credentials = require_env(["PSS_BOOKSTACK_USERNAME", "PSS_BOOKSTACK_PASSWORD"])
    llm = ChatOpenAI(
        model=provider["CUA_MODEL"],
        api_key=provider["CUA_API_KEY"],
        base_url=provider["CUA_BASE_URL"],
        timeout=30,
        max_retries=1,
    )
    task = (
        f"Go to {base_url}/ and complete this local-only navigation smoke test. "
        "Use the available sensitive placeholders for the BookStack email and password to log in. "
        "Then click Books and the visible book named exactly Book. Stop at the exact Book overview "
        "route /books/book. Do not create or edit content and do not visit any external domain."
    )
    agent = Agent(
        task=task,
        llm=llm,
        browser=browser,
        sensitive_data={
            "email": credentials["PSS_BOOKSTACK_USERNAME"],
            "password": credentials["PSS_BOOKSTACK_PASSWORD"],
        },
        use_vision=True,
        max_failures=2,
        max_actions_per_step=3,
        step_timeout=30,
        llm_timeout=30,
        enable_signal_handler=False,
        use_judge=False,
        directly_open_url=True,
    )
    summary = {
        "framework": "browser-use",
        "framework_version": FRAMEWORK_VERSION,
        "provider_model": provider["CUA_MODEL"],
        "run_id": run_id,
        "task": "bookstack-open-book",
        "scope": "exploratory local authenticated navigation smoke; not matched evidence",
        "status": "error",
        "strict_pass": False,
        "steps": None,
        "elapsed_ms": None,
        "failure_category": None,
    }
    try:
        history = await agent.run(max_steps=10)
        final_result = str(history.final_result() or "")
        summary.update({
            "status": "completed",
            "strict_pass": "/books/book" in final_result and "successfully" in final_result.lower(),
            "steps": len(history.history) if hasattr(history, "history") else None,
            "failure_category": None if "/books/book" in final_result else "agent-verdict-or-route-mismatch",
        })
    except Exception as error:  # pragma: no cover - exploratory provider path
        summary.update({
            "status": "error",
            "failure_category": type(error).__name__,
        })
    finally:
        await browser.close()
    summary["elapsed_ms"] = round((time.time() - started) * 1000)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2) + "\n")
    print(f"PSS_FRAMEWORK_RESULT:{json.dumps(summary, ensure_ascii=False)}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
