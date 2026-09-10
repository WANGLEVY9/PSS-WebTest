# Phase 2 application expansion and cross-application task plan (2026-09-10)

## Scope

This artifact expands the benchmark design without inflating the current experimental denominator. The repository has three local pilot SUTs—BookStack, Indico, and OWASP Juice Shop—and two additional WebTestPilot-backed candidates—Invoice Ninja and PrestaShop. **Zero applications are admitted to confirmatory collection.** The new catalog is a candidate pool and a task-design contract, not experimental evidence.

## What changed

- Added `code/config/application-expansion-catalog.v0.1.json` with 14 countable candidate applications, including the two locally available WebTestPilot candidates, and one explicitly non-countable role record.
- Added four cross-application task families: issue-to-chat notification, file-share-to-knowledge-page, project-work-item-to-release-note, and business-record-to-approval-chat.
- Added a fail-closed validator and contract tests. Candidates have no version pin and remain `candidate-unverified`; cross-application tasks require individually admitted endpoint applications, a shared reset coordinator, causal handoff identifiers, bounded eventual consistency, and an independent source/target oracle.
- Added `npm run validate:application-catalog`.

## Candidate pool (not admitted)

The first practical expansion targets are Invoice Ninja and PrestaShop because their compose files, seed fixtures, and benchmark task families are already present under `third_party/WebTestPilot`. They are still `candidate-unverified`: the local images are not yet digest-pinned, their independent oracles and reset contracts are not implemented in this repository, and no three-arm matched pilot has passed. Priority P1 follow-on candidates are Nextcloud, Gitea, Mattermost, Taiga, Kanboard, and MediaWiki. Priority P2 candidates are GitLab, Ghost, WordPress, Roundcube, Odoo, and ERPNext. Their official source links are recorded in the catalog for later license, version, deployment, and reset verification.

The source links used in the catalog point to the projects' official repositories or download pages: [Nextcloud](https://github.com/nextcloud/server), [Gitea](https://github.com/go-gitea/gitea), [Mattermost](https://github.com/mattermost/mattermost), [Taiga Docker](https://github.com/taigaio/taiga-docker), and [MediaWiki download](https://www.mediawiki.org/wiki/Download). The catalog deliberately records verification and pinning as separate gates.

## Planned execution order

1. Bring Invoice Ninja and PrestaShop through the source/license, version/digest, and reproducible local deployment gates; do not count them as admitted merely because WebTestPilot contains a compose file.
2. Implement lifecycle/reset and seed fixtures before adding any CUA or Hybrid run.
3. Implement an independent oracle and clean/fault/evolution isolation for each selected application.
4. Run a three-arm matched pilot. Keep the application out of the denominator if any arm or oracle fails the gate.
5. Only after two endpoint applications are individually admitted, implement one cross-application task family with explicit handoff IDs and correlation logs.
6. Run cross-application diagnostic pilots first; freeze repetition counts only after the existing pilot-variance and power-simulation protocol is satisfied.

## Evidence boundary

The candidate catalog is design and infrastructure planning. It does not change the current statement that confirmatory collection is frozen. A larger list of application names is not a larger empirical sample; admission requires the same reset, oracle, matched three-arm, and run-record gates used for the current pilot SUTs.
