# Deep-read notes: closest studies (2026-08-15)

This note separates verified full-text facts from implications for our proposed study. It must not be read as a claim that the listed work was reproduced locally.

## WebTestPilot (Teoh et al., PACMSE/FSE 2026) — partial direct conflict

**Verified scope.** WebTestPilot transforms free-form natural-language requirements into condition--action--expectation steps, builds inferred pre/postcondition assertions, and uses Pydantic-style symbols plus a DSL to check cross-state data, causal and temporal dependencies. Its application state includes both a screenshot and DOM; action execution uses visual grounding/Set-of-Mark but is therefore a **hybrid visual-plus-DOM agent**, not a screenshot-only CUA.

**Verified evaluation.** It uses four open-source web applications, 100 injected bugs, and compares test-flow completion with LaVague, NaviQAte and PinATA. The authors report 0.99 total task completion, 96% precision and 96% recall for injected-bug detection. The paper's test scripts use Playwright as the ground-truth evaluation oracle; Playwright is not an execution-baseline arm. For a maintainability sub-study, it compares re-identification of the same widgets after UI changes: WebTestPilot 39/40, XPath 32/40, CSS 33/40 and Playwright 29/40. This sub-study has five tests per application and two real plus three synthetic changes.

**Consequence.** Do not propose another approach whose contribution is merely natural-language-to-agentic Web testing, visual grounding, symbolic test-oracle inference, or a small locator-reidentification comparison. A defensible comparison study instead needs matched test intents, an explicit production-quality Playwright baseline, independently scored ground truth, several CUA implementations/observation modes, repeated trials, and full operational measures (authoring, repair, cost, latency and variance) over a preregistered mutation taxonomy.

**Source.** https://arxiv.org/html/2602.11724v3

## Chevrot et al. (PACMSE/ISSTA 2025) — core predecessor

**Verified scope.** The paper supplies three offline web applications, 113 manual natural-language test cases, SeeAct-ATA and PinATA. It studies agent execution, assertion and verdict behavior. It reports roughly 60% correct verdicts for PinATA and specificity up to 94%.

**Consequence.** It establishes that agent task execution and verdict correctness are separate outcomes. Our study must retain that separation, rather than score only task completion or the agent's own pass/fail statement.

**Source.** https://arxiv.org/abs/2504.01495

## WebTestBench (Kong et al., 2026) — core benchmark predecessor

**Verified scope.** The benchmark contains 100 curated development instructions across seven web-application categories, paired with AI-generated web apps with naturally occurring defects. It separates checklist generation from defect detection and reports performance both end-to-end and with a gold checklist. The public paper links code/data.

**Consequence.** It supports checklist coverage and oracle accuracy as distinct measurements, but it does not provide a conventional UI-test-suite comparison. Its task/application artifacts should be audited for license, determinism and overlap before reuse.

**Source.** https://arxiv.org/html/2603.25226v1

## Prucha et al. (2025) — direct paradigm comparison outside testing

**Verified scope.** The study compares Anthropic Computer Use with UiPath RPA on data entry, monitoring and document extraction, measuring speed, reliability and development effort. The reported qualitative result favors RPA on stable repetitive workflows and CUA on development speed/adaptation to dynamic interfaces.

**Consequence.** We cannot make a general “first CUA versus traditional automation” claim. It offers a metric template but not a Web UI test-automation baseline or defect-oracle study.

**Source.** https://arxiv.org/abs/2509.04198

## WebProber (Ye et al., 2025) — adjacent visual testing-in-the-wild

**Verified scope.** WebProber autonomously explores URLs and reports usability problems. Its case study covers 120 academic personal websites and reports 29 usability issues; it is evaluated as an agentic usability/testing case study, not against a matched conventional Web test suite.

**Consequence.** It motivates a separate usability/visual-defect stratum. Do not mix its user-experience defects with functional regression outcomes without explicit separate scoring.

**Source.** https://arxiv.org/abs/2509.05197

## XTestGen (ICSME 2025 tool demonstration) — hybridization design precedent

**Verified scope.** XTestGen converts natural language into Gherkin and JavaScript step definitions, prioritizing deterministic replay, scenario abstraction and hierarchical-tree element identification.

**Consequence.** It reinforces that the appropriate real-world comparison is not binary: an LLM/CUA may explore or author, followed by deterministic Playwright replay. Include this as a third hybrid arm only if the three-month budget permits; otherwise, discuss it as a deployment alternative.

**Source.** https://conf.researchr.org/details/icsme-2025/icsme-2025-tool-demonstration/3/XTestGen-Natural-Language-to-Maintainable-E2E-Test-Scripts-with-LLMs

## LLM test-oracle SLR (Mughal and Bilal, 2026) — methodological guardrail

**Verified scope.** This preprint reports a PRISMA review of 83 studies and stresses that an oracle's authority (specification, learned knowledge, or other source) is distinct from its execution mechanism. It also observes that oracle quality is often evaluated by agreement with an existing oracle rather than injected-fault detection.

**Consequence.** Predeclare the authority of every oracle in our study. Use hidden ground-truth assertions and injected known faults wherever possible; report disagreement analyses rather than relying on LLM-as-a-judge alone.

**Source.** https://arxiv.org/abs/2607.05031
