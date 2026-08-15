# Systematic snowball search: CUA versus traditional web UI testing

Search date: 2026-08-15. This is a structured, reproducible search update, not a completed systematic literature review.

## Eligibility rule for a direct conflict

A study is a **direct conflict** only if it evaluates a screenshot/visual computer-use agent and a conventional scripted web-UI automation baseline (e.g., Selenium or Playwright) on matched test intents and reports at least one comparable empirical outcome. Eligible outcomes include action/test success, defect verdict accuracy, UI-change robustness or repair effort, execution cost/latency, and run-to-run variability.

## Result of three forward/backward rounds

One **partial direct conflict** was found: WebTestPilot (PACMSE/FSE 2026) is a hybrid visual-plus-DOM LLM Web-testing agent and evaluates a small UI-change re-identification study against XPath, CSS and Playwright scripts. It does not run a full matched CUA-versus-conventional-suite comparison for test effectiveness, oracle correctness, execution cost, latency and stochastic reproducibility. The closest general paradigm conflict remains Průcha et al.'s CUA-versus-UiPath RPA study. The topic remains viable only with a narrower, comparison-centered claim.

| Priority | Work | Screening conclusion | Consequence for our study |
|---|---|---|---|
| 1: conflict | Průcha et al. (2025), *Are LLM Agents the New RPA?* | **Direct methodological neighbour, not direct Web-testing conflict.** CUA vs UiPath on data entry, monitoring and document extraction. | Do not claim the first general CUA-vs-automation comparison. Claim the first controlled comparison for Web software testing only if a full SLR confirms it. Reuse its development-time/speed/reliability dimensions. |
| 1: partial conflict | Teoh et al. (2026), *WebTestPilot* | **Hybrid visual-plus-DOM Web-testing agent.** Four web apps, 100 injected bugs; compared against agent baselines and includes a 40-case locator-reidentification comparison with XPath/CSS/Playwright. | Do not duplicate NL-to-E2E testing or isolated locator robustness. Compare whole testing approaches on matched intents with independent oracles, operational cost and repeated stochastic trials. |
| 2: core | Chevrot et al. (2025), *Are Autonomous Web Agents Good Testers?* | Two ATA implementations and 113 natural-language tests; no conventional browser-script baseline. | Reuse the separation of test execution and verdict accuracy; avoid presenting an agent's self-reported pass as ground truth. |
| 2: core | Kong et al. (2026), *WebTestBench* | CUA checklist generation and defect detection for 100 synthesized web apps; no script baseline. | Add checklist coverage and oracle accuracy; its public code is a candidate source of tasks/methods, pending license and runnable-environment review. |
| 2: adjacent | Zimmermann & Koziolek (2023) | GPT-4 plus Selenium compared with monkey testing for branch coverage. | Establish the difference between LLM-assisted DOM automation and screenshot-driven CUA; include a monkey/random exploration arm only if scope permits. |
| 2: adjacent | Salva (2026) | Guarded NL test execution over six web apps; reports false-positive and false-negative bounds, but no visual CUA or script baseline. | Use separate false-positive/false-negative test-oracle measures and its reliability vocabulary. |
| 2: adjacent | Zhao et al. (2024), GTArena | Visual-agent test generation/execution/defect detection on mobile apps. | Useful conceptual decomposition; exclude from Web outcome claims. |
| 2: adjacent | Ye et al. (2025), *WebProber* | Visual agent finds usability issues during autonomous exploration of 120 public websites. | Maintain a separate usability/visual-defect outcome stratum; it is not a matched regression-testing comparison. |
| 2: adjacent | Kirinuki et al. (2025), *XTestGen* | Natural language is converted to deterministic Gherkin/JavaScript E2E scripts. | Treat agent-to-deterministic-script conversion as an important hybrid deployment alternative. |
| 3: reusable | BrowserGym + AgentLab | Open harness supporting self-hosted WebArena/VisualWebArena and several other benchmarks. | Strong candidate for the common environment and deterministic reset protocol; validate its licenses/setup before adoption. |
| 3: reusable | SeeAct | Open multimodal web-agent implementation that runs through Playwright. | Candidate CUA arm or reference implementation; pin model/version and capture trajectories. |
| 3: reusable | GUI-Robust | Open dataset/toolkit with seven anomaly types, including pop-ups, loading delay and network failures. | Use as a mutation-taxonomy seed; its data are not Web test oracles, so do not treat it as the main evaluation dataset. |

## Search log

### Round 1: direct collision queries

- `"computer use agent" Playwright testing empirical study`
- `"computer-use agents" Selenium "test automation"`
- `"autonomous test agent" Selenium empirical`
- `"visual GUI testing" Selenium comparison "large language model"`

### Round 2: seed and terminology expansion

- `"GPT-4" "Selenium WebDriver" "web application testing"`
- `"GPT-3" Selenium OpenCV "black-box testing"`
- `"branch coverage" "Selenium" "GPT-4" testing`
- `"natural language-driven" GUI testing LLM Selenium web`
- `"Are Autonomous Web Agents Good Testers" citations OR "cited by"`
- `"WebTestBench" "computer-use" citations`

### Round 3: reusable benchmark/harness discovery

- `GitHub WebTestBench computer-use agents end-to-end web testing`
- `GitHub autonomous web test agent benchmark PinATA SeeAct-ATA`
- `GitHub WebArena BrowserGym web agent benchmark self hosted`
- `GitHub GUI-Robust real-world anomalies computer-use agent benchmark`

### Round 4: forward-citation expansion and full-text verification

- Semantic Scholar forward citations of Chevrot et al. and WebTestPilot.
- `"computer-use" "Playwright-based test scripts" web testing empirical`
- `"visual language model" web testing Playwright maintainability`
- `"WebTestPilot" "traditional" testing comparison`
- `"XTestGen" "Natural Language to Maintainable E2E Test Scripts"`

## Design decision induced by the search

The study should be titled and framed as **an empirical, whole-workflow comparison of computer-use agents and traditional Web UI *test automation***, not generic UI automation or RPA. Its differentiators must be: (1) matched test intents; (2) a robust, accessible-locator Playwright baseline; (3) independent ground-truth oracles; (4) controlled UI/interaction mutations and measured repair effort; (5) repeated CUA trials with cost, latency, and variance; and (6) explicit distinction between pure visual, hybrid visual-plus-DOM, and deterministic-script approaches.

## Next high-value search steps

1. Run forward/backward citation retrieval for the high-scoring seeds through Semantic Scholar once its public rate limit resets, then screen every returned title/abstract using the eligibility rule.
2. Search IEEE Xplore, ACM DL, Scopus and Web of Science with the logged query families; record coverage/date and deduplicate by DOI.
3. Retrieve full texts for the three nearest studies before copying any numerical result or detailed methodology into the manuscript.
4. Perform a runnable-environment audit of WebTestBench, Chevrot's artifacts, BrowserGym, and SeeAct before selecting an experimental base.

## Expanded targeted-search addendum (2026-08-15)

The second-order snowball pass is recorded in [`research/phase1-expanded-search-2026-08-15.md`](phase1-expanded-search-2026-08-15.md). It adds a field-by-field matrix for Leotta et al.'s NLP/programmatic/capture-and-replay comparison, Kluge–Stocco locator evolution and repair, BEWT, conventional Playwright/Selenium tool comparisons, recent Web GUI exploration studies, Web-form generation, accessibility replay, and Web GUI maintenance mining. The result is unchanged but better bounded: no verified full three-arm matched Web software-testing conflict was found; the defensible contribution is the independent-oracle, UI-evolution/repair, cost/latency, and repeated-stability comparison.

## Phase 1 master synthesis (2026-08-15)

The additional snowball round and final Phase 1 framework are consolidated in [`research/phase1-master-synthesis.md`](phase1-master-synthesis.md). The main new boundary is historical: visual-versus-DOM Web testing, visual test migration, and visual test repair were empirically studied before modern CUAs. The paper therefore cannot claim the first visual-versus-DOM testing comparison. Recent UIExplorer, ST-WebAgentBench, and *Do GUI Agents Believe Their Eyes?* also provide matched screenshot-versus-structure evidence outside defect-oriented testing.

The frozen contribution is now a testing-specific whole-workflow comparison of three bundled deployment strategies. It adds independent oracle authority, functional faults, ecological behavior-preserving evolution, semantic-preserving repair, repeated stochastic trials, and an evidence-admission contract. A nested secondary modality diagnostic is recommended because the main A/B/C contrasts also vary action grounding, runtime adaptation, and artifact type.
