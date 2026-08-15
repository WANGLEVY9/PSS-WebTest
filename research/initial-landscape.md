# Initial literature landscape

Search date: 2026-08-15. Scope: empirical studies that evaluate computer-use, multimodal GUI, or autonomous web agents for web UI testing, especially against traditional browser automation.

## Provisional answer

No directly matching peer-reviewed controlled study was identified in this initial search: namely, one that runs matched web UI test intents with a screenshot-driven computer-use agent and a conventional Selenium/Playwright-style suite, then compares effectiveness, robustness/maintenance, cost, latency, and reproducibility. This is a preliminary screening result, not a claim of exhaustive absence.

## Closest evidence

| Work | What it empirically compares | Why it is not the target comparison |
|---|---|---|
| Chevrot et al., ISSTA 2025 | Two autonomous test-agent designs on 113 natural-language tests across three offline web apps; reports about 60% correct verdicts for PinATA and up to 94% specificity. | No conventional scripted Selenium/Playwright baseline under matched test intents or UI mutations. |
| Kong et al., 2026, WebTestBench | Popular LLMs via a computer-use test framework for checklist generation and defect detection. | Benchmarks CUA testing capabilities, not a controlled CUA-versus-traditional automation study. |
| He et al., ACL 2024, WebVoyager | Multimodal visual web agent versus a text-only accessibility-tree setup on web-navigation tasks. | Tests web-task completion, not test creation/execution/oracle quality versus QA automation. |

## Implications for the new study

1. Use *traditional automation* as a concrete baseline: Playwright with role/label/test-id locators and explicit assertions. Report selectors and repair policy.
2. Separate three outcomes: action completion, defect verdict/oracle accuracy, and test-suite operational burden. A CUA can navigate correctly yet produce an incorrect verdict.
3. Use deterministic, versioned self-hosted applications and reset state before every trial. Repeat CUA conditions enough times to quantify stochastic variance.
4. Create a mutation taxonomy that distinguishes changes conventional selectors should tolerate from changes visible to a human but difficult for an accessibility/DOM-only approach.
5. Predefine the intervention boundary: whether a human may repair a prompt/script, and how authoring/repair time is measured.

## Search strings used

- `"computer use" web application testing empirical study`
- `LLM GUI agent web testing comparison Selenium Playwright empirical`
- `multimodal LLM GUI agent test automation web empirical evaluation`
- `"autonomous test agents" web testing empirical comparison`
- `"Computer-Using Agent" "Web Testing"`
- `"vision-based" "DOM-based" web agent empirical evaluation`

## Next screening actions

- Backward/forward snowball from Chevrot et al. and WebTestBench.
- Search ACM DL, IEEE Xplore, Scopus/Web of Science, and Google Scholar using the ledger in `screening-ledger.csv`.
- Retrieve full texts before extracting numeric results or declaring novelty.
