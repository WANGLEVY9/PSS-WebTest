# PrestaShop medium search-and-open pilot — 2026-09-13

Evidence boundary: one matched repetition for each of two frozen model strata;
pilot evidence only, not confirmatory.

Task: search for `Mug`, then open the exact visible product `Mug The adventure
begins` and stop on its detail page. Each arm used a fresh reset and the
database-backed product oracle.

| Model stratum | Playwright | Pure visual | Hybrid |
|---|---:|---:|---:|
| Qwen3.7-Flash | 1/1 | 0/1 | 1/1 |
| DeepSeek V4.1-Flash | 1/1 | 1/1 | 1/1 |

The Qwen visual replay reached a product detail page, but selected
`19-customizable-mug.html` rather than the target product route
`7-mug-the-adventure-begins.html`; the independent database oracle remained
true for the fixture's target row, but the agent checkpoint was false. This is
a visual grounding/target-selection failure, not reset, transport, or oracle
failure. Qwen Hybrid used the declared page structure and selected the correct
target. DeepSeek selected the correct product in both agent arms.

All six resets were seed-verified. Raw screenshots and replay frames remain in
ignored local artifacts; the standard aligned ledgers contain the bounded
metadata and failure categories. The result is a cross-model pilot stratum and
does not authorize repetition or power freezing.
