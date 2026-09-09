"""A BrowserGym task adapter for the local BookStack navigation intent.

The task keeps the independent visible route/heading oracle in BrowserGym's
``validate`` hook. It never exposes database state or mutation labels to an
AgentLab agent. Credentials are supplied at runtime by the caller and are not
stored in task metadata.
"""

from __future__ import annotations

from typing import Tuple
from urllib.parse import urlparse

import gymnasium
import playwright.sync_api
from browsergym.core.action.highlevel import HighLevelActionSet
from browsergym.core.env import BrowserEnv
from browsergym.core.task import AbstractBrowserTask


class PssBookStackOpenBookTask(AbstractBrowserTask):
    """Open the exact ``Book`` overview in a seeded local BookStack instance."""

    def __init__(self, seed: int, base_url: str, username: str, password: str, target_book: str = "Book") -> None:
        super().__init__(seed)
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.target_book = target_book
        self.viewport = {"width": 1280, "height": 720}
        self.slow_mo = 0
        self.timeout = 15000

    @classmethod
    def get_task_id(cls) -> str:
        return "pss-bookstack-open-book"

    def setup(self, page: playwright.sync_api.Page) -> tuple[str, dict]:
        page.goto(f"{self.base_url}/", wait_until="domcontentloaded")
        if page.locator('a[href="/login"]').count():
            page.locator('a[href="/login"]').click()
        if page.url.endswith("/login"):
            # Use stable form names here. BrowserGym's accessibility snapshot
            # can localize the visible labels, while the task adapter itself
            # must remain locale-robust.
            page.locator('input[name="email"]').fill(self.username)
            page.locator('input[name="password"]').fill(self.password)
            page.locator('form button[type="submit"], form button:not([type])').last.click()
        page.get_by_role("link", name="Books", exact=True).wait_for()
        goal = (
            f"Starting from the authenticated BookStack home page, click Books, then click the visible book named exactly "
            f"{self.target_book}. Stop at the exact /books/book overview route. Do not create or edit content."
        )
        return goal, {"task_id": self.get_task_id(), "oracle": "visible-route-and-heading"}

    def validate(self, page: playwright.sync_api.Page, chat_messages: list[str]) -> Tuple[float, bool, str, dict]:
        path = urlparse(page.url).path
        heading_count = page.get_by_role("heading", name=self.target_book, exact=True).count()
        passed = path == "/books/book" and heading_count > 0
        return (1.0 if passed else 0.0, True if passed else False, "Book overview reached" if passed else "Continue to the exact Book overview", {"oracle_passed": passed, "path": path, "heading_count": heading_count})


def make_bookstack_env(
    *,
    base_url: str,
    username: str,
    password: str,
    executable_path: str = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: bool = True,
) -> BrowserEnv:
    """Construct a BrowserGym environment suitable for AgentLab's loop."""

    action_set = HighLevelActionSet(subsets="webarena", strict=True, multiaction=False)
    return BrowserEnv(
        task_entrypoint=PssBookStackOpenBookTask,
        task_kwargs={"base_url": base_url, "username": username, "password": password},
        viewport={"width": 1280, "height": 720},
        slow_mo=0,
        timeout=15000,
        headless=headless,
        action_mapping=action_set.to_python_code,
        pw_chromium_kwargs={"executable_path": executable_path},
    )
