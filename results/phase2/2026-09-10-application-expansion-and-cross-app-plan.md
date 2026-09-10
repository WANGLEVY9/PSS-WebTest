# Phase 2 application expansion and cross-application task plan (2026-09-10)

## Scope

This artifact expands the benchmark design without inflating the current experimental denominator. The repository has three local pilot SUTs—BookStack, Indico, and OWASP Juice Shop—and two additional WebTestPilot-backed candidates—Invoice Ninja and PrestaShop. The benchmark registry now exposes **25 application rows** (5 implemented/pilot rows plus 20 candidate-only rows), while the candidate catalog contains **22 countable applications**; **zero applications are admitted to confirmatory collection**. The catalog and workflow manifest are candidate pools and task-design contracts, not experimental evidence.

## What changed

- Added `code/config/application-expansion-catalog.v0.1.json` with 22 countable candidate applications, including the two locally available WebTestPilot candidates, and one explicitly non-countable role record.
- Added `code/config/application-workflow-blueprints.v0.1.json`, reserving eight reusable workflow slots for every one of the 22 countable candidates. These are not executable tasks until the application-specific adapter, seed, oracle, and matched pilot exist.
- Registered the 20 additional candidate applications as explicit `candidate` rows in `code/config/benchmark-matrix.v0.1.json`; the matrix now has 25 registry rows but still only 5 applications with local workflow implementations. Empty candidate rows point to the eight-slot planning manifest and cannot enter a denominator.
- Added four cross-application task families: issue-to-chat notification, file-share-to-knowledge-page, project-work-item-to-release-note, and business-record-to-approval-chat.
- Added a fail-closed validator and contract tests. Candidates have no version pin and remain `candidate-unverified`; cross-application tasks require individually admitted endpoint applications, a shared reset coordinator, causal handoff identifiers, bounded eventual consistency, and an independent source/target oracle.
- Added `npm run validate:application-catalog`.

## Candidate pool (not admitted)

The first practical expansion targets are Invoice Ninja and PrestaShop because their compose files, seed fixtures, and benchmark task families are already present under `third_party/WebTestPilot`. They are still `candidate-unverified`: the local images are not yet digest-pinned, their independent oracles and reset contracts are not implemented in this repository, and no three-arm matched pilot has passed. The next candidate wave adds community discussion (Discourse), issue tracking (Redmine), design collaboration (Penpot), project management (Plane and OpenProject), scheduling (Cal.com), files collaboration (ownCloud), and knowledge management (Outline). Their official source links are recorded in the catalog for later license, version, deployment, and reset verification.

The source links used in the catalog point to the projects' official repositories or download pages: [Nextcloud](https://github.com/nextcloud/server), [Gitea](https://github.com/go-gitea/gitea), [Mattermost](https://github.com/mattermost/mattermost), [Taiga Docker](https://github.com/taigaio/taiga-docker), and [MediaWiki download](https://www.mediawiki.org/wiki/Download). The catalog deliberately records verification and pinning as separate gates.

## Planned execution order

1. Bring Invoice Ninja and PrestaShop through the source/license, version/digest, and reproducible local deployment gates; do not count them as admitted merely because WebTestPilot contains a compose file.
2. Select one application from the new candidate wave only after a feasibility triage (container availability, authentication, deterministic seed, and oracle surface) and record the rejection reasons for the others.
3. Implement lifecycle/reset and seed fixtures before adding any CUA or Hybrid run.
4. Implement an independent oracle and clean/fault/evolution isolation for each selected application.
5. Run a three-arm matched pilot. Keep the application out of the denominator if any arm or oracle fails the gate.
6. Only after two endpoint applications are individually admitted, implement one cross-application task family with explicit handoff IDs and correlation logs.
7. Run cross-application diagnostic pilots first; freeze repetition counts only after the existing pilot-variance and power-simulation protocol is satisfied.

## Evidence boundary

The candidate catalog and 22 × 8 workflow reservation are design and infrastructure planning. They do not change the current statement that confirmatory collection is frozen. A larger list of application names or workflow slots is not a larger empirical sample; admission requires the same reset, oracle, matched three-arm, and run-record gates used for the current pilot SUTs.
