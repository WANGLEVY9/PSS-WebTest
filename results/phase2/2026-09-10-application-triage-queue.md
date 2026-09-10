# Application feasibility triage queue (2026-09-10)

This is a planning and infrastructure artifact. It does not contain empirical runs and does not authorize confirmatory collection.

## Queue

| Wave | Candidates | Selection rule |
|---|---|---|
| 0 | Invoice Ninja, PrestaShop | Existing WebTestPilot compose/seed/task assets; finish local blockers first |
| 1 | Gitea, Nextcloud, MediaWiki, Ghost, WordPress, Redmine, Kanboard | Lower expected deployment complexity and bounded persisted-state oracles |
| 2 | Mattermost, Taiga, Discourse, Roundcube, ownCloud, Outline, Plane | Multi-user, mail, storage, or multi-service dependencies |
| 3 | GitLab, Odoo, ERPNext, Penpot, OpenProject, Cal.com | Heavy images, multiple services, or calendar/asset semantics |

## Gate ordering

For each candidate, the queue requires the following evidence in order:

1. Official source/license and version/digest evidence.
2. Reproducible self-hosted deployment and deterministic seed/reset.
3. Independent persisted-state or relational oracle.
4. Clean, fault, and UI-evolution isolation.
5. Matched pure-visual, hybrid, and Playwright pilot with standardized run records.

Failures are retained as infrastructure or agent-boundary evidence and do not count as successful cells. Cross-application work remains blocked until both endpoint applications are individually admitted.

## Validation

```text
npm run validate:application-triage
Application triage queue validation passed: 22 candidates across 4 waves; admission remains closed.
```

