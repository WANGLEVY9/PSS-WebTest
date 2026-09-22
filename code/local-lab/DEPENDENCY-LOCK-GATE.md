# Complete Python distribution lock gate

The sponsor doctor compares the **entire installed distribution set and every exact version** with the explicitly bound lock file. It rejects:

- a locked package missing from the environment;
- a differing installed version;
- any installed package absent from the lock, including installer/tooling packages;
- duplicate installed metadata records after Python package-name normalization.

This gate does not allow "all 107 locked entries match" to pass when 110 distributions are installed. The report includes the locked count, installed count, union count and each difference classified as `missing`, `version-mismatch`, or `unlocked`. `uv pip check` remains an independent dependency/platform-consistency check.

## Browser Use journaled actuator

The current **local** journaled-actuator configuration is declared by:

`config/frameworks/h-browser-use-journaled-actuator.lock`

The older `h-browser-use.lock` omits the actuator's `greenlet`, `playwright` and `pyee` distributions. Binding that old lock to the expanded environment must fail. Operators should explicitly select the reviewed journaled-actuator lock for that configuration; the doctor never switches locks or rewrites a private deployment profile automatically.

The local lock is not proof of a reproducible Linux sponsor environment. It includes host-dependent packages. Do not copy it into a Linux campaign unchanged, ignore incompatible packages, or export whatever happens to be installed and call that independently verified. Build a fresh target environment from reviewed upstream requirements and the chosen adapter dependencies, validate the full distribution set and native execution, then freeze and review a target-specific lock and provenance record. Keep the old lock and prior diagnostic reports for audit.

This check proves declaration consistency only. It does not prove wheel/source integrity, browser behavior, native evaluator correctness, scientific admission, or task success.
