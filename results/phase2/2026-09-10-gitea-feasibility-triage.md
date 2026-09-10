# Gitea feasibility triage (2026-09-10)

## Decision

**Keep Gitea as a P1 candidate; do not admit it, schedule a matched pilot, or add it to an experimental denominator yet.** Gitea is a promising source-hosting SUT because its primary web state is self-contained (repositories, issues, labels, comments, and permissions), but this repository currently has no local Gitea compose stack, lifecycle/reset script, seed fixture, authenticated task adapter, or independent oracle.

This is a feasibility triage artifact, not an experimental result. No CUA, Hybrid, or Playwright task was executed.

## Evidence checked

| Gate | Observation | Status |
|---|---|---|
| Official source | The candidate catalog records the official Gitea repository: `https://github.com/go-gitea/gitea`. The repository describes Gitea as a self-hosted service covering Git hosting, code review, issues, projects, wiki, packages, and CI/CD. | pass for source identification |
| Container path | The official documentation provides a rootless Docker deployment using a versioned `docker.gitea.com/gitea:<version>-rootless` image and persistent `data`/`config` mounts. | pass for deployment hypothesis; not locally verified |
| Version pin | The local candidate record has `version_pin: null`; no image digest or release tag has been adopted by this repository. | blocked |
| Local asset | No `third_party/WebTestPilot/webapps/gitea` directory, compose file, seed SQL, lifecycle script, or task adapter exists in the checkout. | blocked |
| Reset | No deterministic database/repository-volume snapshot or reset procedure has been tested. | blocked |
| Authentication | A local test account and repository-owner/member fixtures have not been created. | blocked |
| Independent oracle | No repository/issue/permission oracle is implemented. Agent verdicts must remain separate from ground truth. | blocked |
| Matched three-arm pilot | No clean, fault, or UI-evolution matched cell has been run. | blocked |
| Runtime host | `docker version` could not reach the configured Colima socket (`permission denied`); `docker compose` is unavailable as a Docker subcommand in this shell. | infrastructure blocker |

## Candidate workflow surface

The eight reserved workflow slots can be specialized for Gitea without introducing hidden state:

1. navigate to a repository and issue;
2. search for a repository or issue and open the target;
3. create an issue with title/body/label;
4. edit an issue or repository description and verify persistence;
5. move from issue to repository/project and preserve the selected state;
6. distinguish owner/member/anonymous access to a private repository;
7. exercise a bounded delayed operation such as indexing or page refresh;
8. create a related entity such as a label/comment or link an issue to a project.

Potential independent oracle fields are repository existence, issue title/body/labels, comment identity, membership/permission response, and persisted database/API state. The oracle must be implemented outside the agent prompt and must not rely only on visible text.

## Why the candidate remains valuable

Gitea adds source-hosting and authorization-heavy workflows that are not represented by BookStack, Indico, Juice Shop, Invoice Ninja, or PrestaShop. It is therefore useful for testing locator drift, permission boundaries, structured forms, and cross-application handoffs. However, the current evidence supports only a **candidate selection decision**, not a claim of feasibility or agent performance.

## Required next actions before admission

1. Restore Docker/Colima access and verify the host architecture.
2. Choose an exact Gitea release and immutable image digest; record license and image metadata.
3. Add a minimal local compose stack with explicit port, persistent-volume paths, health check, and no external service dependency (SQLite is acceptable for the first feasibility pass).
4. Add deterministic seed data: one owner, one member, one anonymous visitor, one repository, two issues, labels, and one project.
5. Implement reset/ready commands and prove two consecutive reset cycles produce equivalent seed fingerprints.
6. Implement an independent oracle for issue/repository/permission state and a replay/run-record adapter.
7. Run one matched clean pilot across Playwright, Hybrid, and Pure Visual. Keep Gitea out of the denominator unless all three arms and the oracle pass the admission gate.

## Current classification

```text
application: gitea
catalog_status: candidate-unverified
triage_status: promising-but-unverified
local_reset: not implemented
independent_oracle: not implemented
three_arm_pilot: not started
confirmatory_eligible: false
```

## Sources

- [Gitea official repository](https://github.com/go-gitea/gitea)
- [Gitea official rootless Docker installation](https://docs.gitea.com/installation/install-with-docker-rootless/)
- [Gitea releases](https://github.com/go-gitea/gitea/releases)

