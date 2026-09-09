"""Run the AgentLab/BrowserGym PSS BookStack adapter smoke.

This validates task setup, observation extraction, direct deterministic action
execution, and the independent task oracle. It is not a model-backed AgentLab
result; the model adapter remains a separate experimental configuration.
"""

import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from agentlab_adapter import make_bookstack_env  # noqa: E402


def main() -> None:
    started = time.time()
    env = make_bookstack_env(
        base_url=os.environ.get("BOOKSTACK_BASE_URL", "http://127.0.0.1:8081"),
        username=os.environ["PSS_BOOKSTACK_USERNAME"],
        password=os.environ["PSS_BOOKSTACK_PASSWORD"],
        executable_path=os.environ.get("PSS_CHROME_EXECUTABLE", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
    )
    result = {"framework": "agentlab-browsergym", "framework_version": "0.4.2/0.14.2", "task_id": "pss-bookstack-open-book", "status": "error", "strict_pass": False, "adapter": "task-setup-observation-oracle"}
    try:
        obs, info = env.reset(seed=0)
        env.page.get_by_role("link", name="Books", exact=True).click()
        env.page.get_by_role("link", name="Book", exact=True).first.click()
        reward, done, message, oracle_info = env.task.validate(env.page, [])
        result.update({"status": "completed", "strict_pass": bool(done and oracle_info.get("oracle_passed")), "reward": reward, "done": done, "observation_keys": sorted(obs.keys()), "screenshot_present": obs.get("screenshot") is not None, "oracle": oracle_info, "message": message})
    except Exception as error:
        result.update({"status": "error", "failure_category": type(error).__name__, "error": str(error)[:300]})
    finally:
        env.close()
    result["elapsed_ms"] = round((time.time() - started) * 1000)
    print(f"PSS_AGENTLAB_RESULT:{json.dumps(result, ensure_ascii=False)}", flush=True)


if __name__ == "__main__":
    main()
