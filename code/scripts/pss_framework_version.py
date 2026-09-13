"""Shared helpers for the external-framework adapters.

Two defects motivate this module:

1. `framework_version` was hardcoded as a string literal in the Python runners
   and in the JS runners and in the configuration registry. All three agreed by
   construction, so the registry cross-check could never fail and a rebuilt
   environment would silently report the old version. `installed_version()`
   reads the version from the actually installed distribution instead.

2. Browser profile directories and the Chrome executable path were hardcoded to
   macOS-only locations (`/private/tmp/...`,
   `/Applications/Google Chrome.app/...`). A `/tmp` profile also leaks cookies
   and localStorage across runs, which breaks the deterministic reset the study
   depends on. `run_scoped_profile_dir()` gives every run a fresh directory and
   `resolve_chrome_executable()` is platform aware.

Import path: the runners live in `code/scripts/`, so `sys.path[0]` is that
directory and a plain `from pss_framework_version import ...` works.
"""
from __future__ import annotations

import os
import platform
import shutil
import sys
from importlib import metadata
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def installed_version(distribution: str) -> str | None:
    """Return the installed version of a distribution, or None if absent."""
    try:
        return metadata.version(distribution)
    except metadata.PackageNotFoundError:
        return None
    except Exception:
        return None


def require_installed(distribution: str) -> str:
    """Fail closed when the distribution is missing or its version is unreadable."""
    version = installed_version(distribution)
    if not version:
        raise RuntimeError(
            f"{distribution} is not installed in this interpreter ({sys.executable}). "
            "Build the environment with: node scripts/build-framework-envs.mjs"
        )
    return version


def require_env(names: list[str]) -> dict[str, str]:
    """Read required environment variables with one clear error instead of a KeyError."""
    values: dict[str, str] = {}
    missing: list[str] = []
    for name in names:
        value = os.environ.get(name)
        if value is None or value.strip() == "":
            missing.append(name)
        else:
            values[name] = value
    if missing:
        raise RuntimeError(f"Missing required environment variable(s): {', '.join(sorted(missing))}")
    return values


def run_scoped_profile_dir(run_id: str, kind: str = "browser-profile") -> Path:
    """A fresh, per-run browser profile directory.

    Never reuse a profile across runs: a shared profile carries cookies and
    localStorage forward and silently breaks reset isolation.
    """
    safe_run_id = "".join(character if character.isalnum() or character in "._-" else "-" for character in run_id)
    root = Path(os.environ.get("PSS_BROWSER_PROFILE_ROOT", str(REPOSITORY_ROOT / "artifacts" / "phase2" / "browser-profiles")))
    directory = root / f"{kind}-{safe_run_id}"
    if directory.exists():
        shutil.rmtree(directory, ignore_errors=True)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def resolve_chrome_executable() -> str | None:
    """Return an explicitly configured Chrome/Chromium executable, else None.

    The study requires one frozen browser build across all arms, so the default
    is None: the framework launches its own Playwright-managed Chromium. The
    previous behaviour preferred a hardcoded macOS Chrome path, which failed on
    Linux and silently introduced a browser-build difference between arms.

    Set PSS_CHROME_EXECUTABLE only for a declared browser-build ablation, in
    which case the value is recorded with the run.
    """
    override = os.environ.get("PSS_CHROME_EXECUTABLE")
    if not override:
        return None
    if not Path(override).exists():
        raise RuntimeError(f"PSS_CHROME_EXECUTABLE points at a missing file: {override}")
    return override


def detect_system_chrome() -> str | None:
    """Best-effort detection of a system Chrome, for diagnostics only.

    This never drives a default: it exists so a report can state which system
    browser is present without letting it silently become the study browser.
    """
    system = platform.system()
    candidates: list[str] = []
    if system == "Darwin":
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
    elif system == "Linux":
        candidates = [
            shutil.which("google-chrome") or "",
            shutil.which("chromium") or "",
            shutil.which("chromium-browser") or "",
        ]
    elif system == "Windows":
        candidates = [
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
        ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def browser_launch_kwargs() -> dict:
    """Launch kwargs shared by every Python framework adapter.

    Empty unless PSS_CHROME_EXECUTABLE is explicitly set, so the framework uses
    its bundled Chromium and all arms share one frozen browser build.
    """
    executable = resolve_chrome_executable()
    return {"executable_path": executable} if executable else {}


def browser_build_info() -> dict:
    """Describe which browser the adapter will actually launch."""
    explicit = resolve_chrome_executable()
    return {
        "executable_path": explicit,
        "source": "explicit-override" if explicit else "framework-bundled-chromium",
        "system_chrome_detected": detect_system_chrome(),
    }
