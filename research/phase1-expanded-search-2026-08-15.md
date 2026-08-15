# Phase 1 expanded search addendum — targeted snowball audit

**Project:** PSS-WebTest (Pixels, Page Structure, or Scripts?)  
**Date:** 2026-08-15  
**Purpose:** extend the collision audit without reopening the frozen research question. This addendum records the second-order neighbors found by targeted keyword, backward-reference, and forward-reference searches. It is evidence for the scope decision, not a claim of an exhaustive systematic review.

## 1. Search protocol and coverage

The following query families were run against web-indexed scholarly sources and official paper/repository pages, then expanded through references and cited-by terminology:

- `"computer-use" Playwright "web testing" empirical`
- `"screen-only" Playwright browser agent matched tasks`
- `"visual agent" "traditional" web UI testing benchmark`
- `"test oracle" computer-use agent web benchmark`
- `web GUI testing locator evolution repair empirical study benchmark`
- `Large Language Models automated web-form-test generation`
- `AI-generated test scripts web E2E testing ChatGPT Copilot`

The search was intentionally stratified into (i) direct collision, (ii) Web-testing and UI-evolution neighbors, and (iii) open benchmark/harness work. Search-engine snippets were discovery leads only; classifications below use an official paper, DOI page, arXiv full text/abstract, or official repository. A Semantic Scholar API attempt was blocked by the web connector's URL-safety policy, so the earlier citation graph and manual backward/forward expansion were retained. ACM/IEEE/Scopus/Web of Science coverage still needs a final database export before submission.

## 2. Expanded screening matrix

Legend: **Y** = verified present; **N** = verified absent; **U** = not established from the accessible artifact. “Matched” means the compared arms receive the same intent/task and comparable initial state, not merely the same benchmark name.

| Work (primary source) | Task type | Screenshot | DOM | A11y | Conventional Playwright/Selenium baseline | Matched intents | Oracle source | Defect / evolution / repair / repeats | Open/reproducible | Overlap and missing element | Classification |
|---|---|---:|---:|---:|---|---:|---|---|---|---|---|
| Leotta et al., *An empirical study to compare three web test automation approaches* ([DOI](https://doi.org/10.1002/smr.2606); OA manuscript) | Web regression automation: NLP-based, programmable, capture-and-replay | N | U | N | Y, programmable approach | Y, same suites | Test-suite pass/evolution outcomes; independent hidden oracle not the focus | Test development and evolution cost; repeated runs/evolution are reported at suite level; seeded functional faults U | Paper Y; artifact/repo U | Strongest traditional-automation methodology neighbor, but no screenshot CUA, no a11y-locator arm, no independent oracle correctness or stochastic CUA stability | Partial methodological conflict |
| Kluge & Stocco, *Web element relocalization in evolving web applications* ([Springer/DOI](https://link.springer.com/article/10.1007/s10664-026-10903-6)) | Locator relocalization after DOM/UI changes | N | Y | U | Selenium locator library and broken-locator baselines | Y, paired element matches | Ground-truth element pairs / benchmark labels | Behavior/UI evolution Y; repair Y; 30 apps, >10k element pairs, four-month interval; CUA repeats N | Source/results/library Y | Excellent evolution/repair benchmark precedent; does not execute whole tests, compare CUA, or measure oracle/cost/latency | Strong adjacent |
| Olianas et al., *BEWT: Extended benchmarking for end-to-end web testing* ([official page](https://sepl.dibris.unige.it/BEWTExtended.php); [DOI](https://doi.org/10.1016/j.jss.2026.112849)) | End-to-end Web testing benchmark and shared SUT/test suites | U | U | U | Conventional E2E harness is the benchmark context; exact arm comparison U | U | Benchmark expected outcomes U | Reproducible Docker/scripts are advertised; defect/evolution/repair/repeats U | Artifact Y in official description; runtime/license details U | Candidate source for SUT/reset design and reproducibility, but no verified CUA-vs-script matched experiment | Reusable benchmark neighbor |
| Moń & Pańczyk, *A comparative analysis of web application test automation tools* ([JCSI](https://ph.pollub.pl/index.php/jcsi/article/view/7119); [DOI](https://doi.org/10.35784/jcsi.7119)) | Tool-performance comparison of Playwright, Cypress, Selenium | N | U | U | Y, the compared tools | Same workload Y | Functional completion/performance harness; oracle details U | Execution time, CPU and RAM; evolution/repair/repeated stochastic runs U | Paper Y; code U | Direct conventional-tool performance baseline, but no CUA, no test-oracle study, no UI mutation/repair | Adjacent empirical baseline |
| Imtiaz, Iqbal & Khan, *An automated model-based approach to repair test suites of evolving web applications* ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0164121220302314)) | Repair of broken Web test scripts | N | Y | U | Selenium suites and WATER comparison | Same broken scripts/apps Y | Mutation analysis, DOM coverage and fault-finding checks | UI evolution Y; repair Y (reported repair success); repeated CUA runs N | Tool/paper Y; artifact availability U | Direct precedent for repair-effort outcomes, but no visual/hybrid CUA or three-arm comparison | Strong adjacent |
| *Robustness of locators in template-based Web application testing* ([DOI](https://doi.org/10.1016/j.jss.2023.111932)) | Regression testing under realistic GUI/layout changes | N | Y | U | Hook-based and state-of-practice locator strategies | Same changed templates Y | Regression-test outcomes; independent oracle details U | UI evolution Y; locator robustness Y; repair effort/repeated stochastic runs U | Paper Y; benchmark/artifact U | Supports mutation strata and locator baseline, not CUA comparison | Strong adjacent |
| Liu et al., *Understanding Automated Web GUI Testing: An Empirical Study Across Exploration Strategies and State Abstractions* ([arXiv](https://arxiv.org/abs/2606.16650)) | Automated Web GUI exploration/testing | U (agent observation varies) | Y/structured state | U | No authored Playwright suite baseline found | Same apps/targets, not three-arm matched intents | Coverage and failure revelation; hidden oracle details U | Six apps; exploration/state-ablation outcomes; UI evolution/repair/repeated stochastic stability U | Paper Y; artifact U | Broad empirical Web-testing map and factor design; no screenshot-only CUA versus deterministic script | Adjacent empirical study |
| Li et al., *Large Language Models for Automated Web-Form-Test Generation* ([arXiv](https://arxiv.org/abs/2405.09965); [TOSEM DOI](https://doi.org/10.1145/3735553)) | NL-to-Web-form test generation | N | Y/HTML | U | Script execution is the output, not a competing authored baseline | Same 146 forms Y | SSR/coverage metrics; independent defect oracle U | 30 Java apps; generation outcomes; UI evolution/repair/repeated CUA runs N | Paper Y; artifact U | Useful DOM-aware generation neighbor, but not visual CUA or oracle/evolution comparison | Adjacent |
| Alian et al., *FormNexus* ([ISSTA paper/PDF](https://nashid.github.io/resources/papers/formnexus-issta24.pdf)) | Web-form test generation with a Form Entity Relation Graph | N | Y | U | Generated Playwright-like execution, no conventional arm | Same forms/tasks Y | Coverage and generated test validity; hidden-state oracle U | 9 open-source apps; defect/evolution/repair/repeats U | Paper/code Y | Structured-page generation baseline; no screenshot arm or traditional suite comparison | Adjacent/reusable |
| Liu et al., *Temac* ([arXiv](https://arxiv.org/abs/2506.00520)) | Multi-agent Web GUI testing | Y/agent screenshots U | Y | U | Browser actions; conventional suite baseline N | Same six apps/tasks, three-arm match N | Code coverage and failure discovery; independent oracle details U | Six open-source apps; defect discovery; evolution/repair/repeats U | Paper Y; artifact U | Agentic testing neighbor, not modality or traditional-suite comparison | Adjacent |
| *WebRLED* ([arXiv](https://arxiv.org/abs/2504.19237)) | Reinforcement-learning Web GUI exploration/testing | U | Y/interaction state | U | No authored Playwright suite baseline | Same 12 apps/field tasks within method | Coverage/failure discovery; oracle details U | 12 open-source apps plus field study; evolution/repair/repeats U | Paper Y; artifact U | Provides exploration benchmark scale, not CUA-vs-script testing estimand | Adjacent |
| Leotta et al., *AI-Generated Test Scripts for Web E2E Testing with ChatGPT and Copilot* ([repository record](https://iris.unige.it/handle/11567/1220069)) | Manual versus Copilot/ChatGPT test-script authoring | N | U | U | Y, manual scripts | Same 8 suites × 12 scripts | Test execution pass/fail; independent oracle details U | Development-time comparison; evolution/repair/repeated stochastic runs U | Paper record Y; code U | Valuable authoring-cost comparator, but no runtime CUA or oracle/evolution study | Adjacent methodological |
| Taeb et al., *AXNav: Replaying Accessibility Tests from Natural Language* ([arXiv/DOI](https://doi.org/10.1145/3613904.3642777)) | Natural-language accessibility test replay on mobile GUI | Y/pixel-based | U | Y/target semantics | No Web Playwright baseline | Same NL accessibility tasks Y | Accessibility QA heuristic + professional ratings | User study and replay reliability; Web UI evolution/repair/repeats N | Paper Y; artifact U | Supports accessibility-oracle terminology, but wrong platform and no Web testing comparison | Adjacent |
| 2025 Web GUI testing adoption/maintenance study ([DOI](https://doi.org/10.1016/j.infsof.2025.107928)) | Empirical mining of Web GUI testing in 472 open-source apps | N | U | U | Selenium/Playwright/Cypress/Puppeteer observed | Repository-level, not matched task arms | Repository/test-maintenance signals | Co-evolution and maintenance Y; CUA comparison N | Paper Y; dataset/code U | Motivation for maintenance outcomes and external validity; not an intervention comparison | Adjacent empirical ecosystem study |

## 3. What the expanded search changes

### 3.1 No verified full direct conflict

No located work satisfies all four frozen conflict criteria: (a) Web software/regression testing, (b) screenshot-only CUA plus conventional scripted browser suite, (c) matched test intents and comparable state, and (d) an independently checkable outcome. The project therefore remains **GO**. This is a bounded conclusion as of 2026-08-15, not an exhaustive “first” claim.

### 3.2 Three collision boundaries are now explicit

1. **Paradigm collision:** Anchor/ERP-Bench and Průcha et al. already establish matched visual-computer-use versus conventional-automation comparisons outside software testing. We must not claim the general comparison is new.
2. **System-component collision:** WebTestPilot already combines visual/DOM observations, Web testing, inferred oracles, injected bugs, and a small Playwright locator re-identification comparison. We must not claim novelty for any one of those components.
3. **Methodological collision:** Leotta et al. already compare multiple Web test-automation paradigms and measure development/evolution cost. Our contribution must be the *CUA modality comparison plus independently grounded oracle/evolution/repair/stability outcomes*, not simply “an empirical comparison of Web testing tools.”

### 3.3 Strongest defensible gap

The unfilled cell is a **whole-workflow, three-arm Web software-testing experiment**: pure visual CUA versus hybrid visual+DOM/a11y agent versus accessibility-locator Playwright, receiving matched test intents, evaluated with an independent hidden functional oracle, seeded faults, behavior-preserving UI evolution, active repair, and repeated stochastic runs with cost/latency/stability accounting. The claim is conditional and comparative, not a universal winner claim.

## 4. Scope/method freeze after the expanded search

The previous freeze remains valid:

- **Arm A:** screenshot/coordinate-only CUA; no DOM, accessibility tree, selectors, hidden state, or network/application data.
- **Arm B:** screenshot plus declared DOM/accessibility representation; no hidden gold assertions or mutation labels.
- **Arm C:** human-authored deterministic Playwright using role/label/text and justified stable test IDs; no runtime LLM adaptation.
- **Conditions:** clean, seeded functional fault, and behavior-preserving UI evolution split into DOM, accessibility semantics, visual/layout, and interaction/runtime strata.
- **Primary outcomes:** balanced functional-verdict accuracy, valid test completion, and active repair effort.
- **Secondary outcomes:** false-positive/false-negative rates, cost, latency, authoring time, actions/tokens, retries, repeated-run failure probability, verdict disagreement, and failure taxonomy.
- **Oracle rule:** an arm's own verdict is never ground truth; hidden state/API/database assertions are authoritative for functional outcomes. Visual/usability labels are separate and blinded.

The confirmatory estimand is therefore:

> conditional differences among three Web UI test-automation approaches on matched intents, moderated by oracle authority/type and UI condition.

## 5. Immediate work items before Phase 2

1. Export and deduplicate the same query families in ACM DL, IEEE Xplore, Scopus/Web of Science, and Semantic Scholar; save date, query, hit count, and DOI-level exclusions.
2. Full-text verify the methods/results of WebTestPilot, Chevrot, WebTestBench, Anchor/ERP-Bench, and Leotta et al.; do not copy search snippets into the paper.
3. Run a contamination/license/reset audit for WebTestBench, Chevrot artifacts, BEWT, BrowserGym, and SeeAct before selecting SUTs.
4. Pilot one application × one intent × three arms × clean/fault/evolution, then simulate power for the arm × oracle × evolution interactions.

## 6. Source links used for this addendum

Primary links are embedded in the matrix. The most important collision sources are [WebTestPilot](https://arxiv.org/abs/2602.11724), [Chevrot et al.](https://arxiv.org/abs/2504.01495), [WebTestBench](https://arxiv.org/abs/2603.25226), [How Benchmarks Mis-Score Computer-Use Agents](https://arxiv.org/abs/2607.28367), [Anchor/ERP-Bench](https://arxiv.org/abs/2605.26321), [Leotta et al.](https://doi.org/10.1002/smr.2606), and the [locator-evolution replication study](https://doi.org/10.1007/s10664-026-10903-6).
