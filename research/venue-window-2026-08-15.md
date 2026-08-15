# CCF-A venue window audit

Baseline date: 2026-08-15. Planning horizon: three months (to 2026-11-15). “Available” means a manuscript can be submitted; it does **not** mean acceptance or publication within three months. Conference dates use the deadline's stated time zone, including Anywhere on Earth (AoE).

## Decision summary

For a complete, reproducible empirical study finished within three months, the only confirmed immediately submissible CCF-A primary target is **IEEE Transactions on Software Engineering (TSE)**. FSE 2027 is the most topical conference target but its full-paper deadline is 2026-10-02 AoE, leaving roughly 48 days from this audit. It is appropriate only if substantial experimental assets already exist. Do not submit the same manuscript concurrently to a journal and a conference.

## Confirmed options

| Venue | CCF status / window | Fit and recommended topic labels | Decision |
|---|---|---|---|
| IEEE TSE | CCF-A journal; calls for submissions to upcoming issues, no issue-specific deadline. | Empirical comparative study of automated Web UI testing; assessment/testing/validation/reliability/measurements; tools and environments. | **Primary three-month target.** Emphasize experimental validity, effect boundaries, statistics, open artifacts, and replication. |
| FSE 2027 Research | CCF-A; full paper due **2026-10-02 23:59:59 AoE**; conference 2027-07-12--16, Shenzhen. | Software testing (primary); empirical SE; AI/ML for SE; tools/environments; HCI as relevant. | **Fast-track only.** Do not sacrifice controlled experimental quality to meet this deadline. |
| ICSE 2027 NIER | CCF-A conference series, but NIER is not a full/regular research paper; due **2026-10-23 AoE**. | Controlled benchmark/research agenda for CUA versus script testing, with initial evidence and a future plan. | Emergency positioning outlet, not a replacement for a CCF-A full paper. |
| ICSE 2027 Tool Demo & Data Showcase | Companion track, due **2026-10-23**. | A runnable benchmark harness, mutation suite, and reproducibility package. | Consider only if the artifact is genuinely usable; not a CCF-A full-paper outcome. |

## Future targets: prepare, do not promise

| Venue | Current status | Future fit |
|---|---|---|
| ISSTA 2027 | Official conference site confirms the edition, but no 2027 research CFP/deadline was available at audit. | Best topical match: Web application testing/analysis, empirical studies of testing processes, testing evolving systems, mutation testing, testing tools. |
| ASE 2027 | No official 2027 research CFP/deadline available at audit. | Testing and Analysis (primary); AI and Software Engineering (secondary). |
| ACM TOSEM | CCF-A journal and a credible methodological target. This audit could not retrieve ACM's live author workflow/deadline because of access restrictions. | Verify current Editorial Manager status before claiming continuous submission. |

## Confirmed too late for this cycle

- ICSE 2027 Research: abstract 2026-06-23 and full submission 2026-06-30 AoE passed. Its future matching areas are Testing/Analysis and AI for SE.
- ASE 2026 Research: 2026-03-26 deadline passed. Its matching areas are Testing and Analysis plus AI and SE.

## Realistic non-A fallback

**AST 2027**, co-located with ICSE, has a regular-paper deadline of 2026-10-30 AoE and explicitly welcomes automated software testing, practical experiments, tool adoption, and quantified consequences. It fits a three-month study better than the FSE deadline, but it is not a CCF-A full-paper venue.

## Positioning for the research-track abstracts

Use a conditional-comparison question, not “which technology wins?”:

> Under what Web UI, oracle, and evolution conditions do pure-visual CUAs, hybrid visual-plus-DOM agents, and accessible-locator Playwright suites differ in effectiveness, oracle correctness, repair effort, cost, latency, and run-to-run reproducibility?

For FSE: `Software testing` primary; `Empirical software engineering` and `AI/ML for SE` secondary. For a future ISSTA: `Web application testing/analysis` and `empirical testing process studies` primary. For a future ASE: `Testing and Analysis` primary and `AI and Software Engineering` secondary.

## Official sources

- FSE 2027 Research CFP: https://conf.researchr.org/track/fse-2027/fse-2027-papers
- FSE 2027 dates: https://conf.researchr.org/dates/fse-2027
- TSE call for papers: https://www.computer.org/digital-library/journals/ts/cfp-ieee-transactions-on-software-engineering
- ICSE 2027 NIER: https://conf.researchr.org/track/icse-2027/icse-2027-new-ideas-and-emerging-results--nier-
- ICSE 2027 dates: https://conf.researchr.org/dates/icse-2027
- ICSE 2027 Research: https://conf.researchr.org/track/icse-2027/icse-2027-research-track
- ASE 2026 Research: https://conf.researchr.org/track/ase-2026/ase-2026-research-track
- ASE 2026 dates: https://conf.researchr.org/dates/ase-2026
- ISSTA: https://www.issta.org/
- AST 2027: https://conf.researchr.org/home/ast-2027
- TOSEM author guidelines: https://dl.acm.org/journal/tosem/author-guidelines
- CCF catalogue note on full/regular papers: https://yocsef.ccf.org.cn/c/2019-04-25/663625.shtml
