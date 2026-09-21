# Security policy

PSS-WebTest is research infrastructure for authorized, disposable benchmark fixtures. It is not a production-testing service. There is no maintained production release series or guaranteed security-response SLA at this stage.

## Reporting a vulnerability

Do not disclose exploitable details, credentials or private data in a public issue. Use [GitHub private vulnerability reporting](https://github.com/WANGLEVY9/PSS-WebTest/security/advisories/new) if enabled. If unavailable, contact the maintainer privately at **231250082@smail.nju.edu.cn**. Include the affected commit, minimal sanitized reproduction, likely impact and a safe follow-up route.

Ordinary installation, reproducibility and documentation bugs can use [public issue forms](https://github.com/WANGLEVY9/PSS-WebTest/issues/new/choose). Private reporting availability is a GitHub setting, not something this file alone enables.

## Credentials and execution evidence

Keep API keys in ignored env files or a secret manager. Do not include keys, authorization headers, cookies, passwords or private account content in manifests, prompts, screenshots, HARs, provider outputs or public reports. Revoke or rotate an exposed secret promptly; deleting a file from the latest commit does not remove it from history.

Raw ledgers, replay frames and browser state belong in restricted storage. SQLite WAL state must be included in a consistent backup; copying only a live main database file can lose evidence. Review every exported artifact before publishing it.

## Local services and dependencies

Bind consoles and experimental fixture ports to loopback; use an authenticated tunnel when access is needed. Reset/mutation commands must target owned disposable fixtures. Keep actor tools within their declared boundary; reference/evaluator data are not actor input. Treat task text and browser content as untrusted inputs.

Dependency and benchmark/application security remains subject to upstream policies. A passing contract or public-boundary check does not certify deployment security, complete secret removal, or permission to redistribute third-party data.
