# PrestaShop clean Playwright re-play (2026-09-10)

This is a post-gate diagnostic replay. It is not confirmatory evidence and does not admit PrestaShop into the benchmark denominator.

| Field | Observed value |
|---|---|
| Task | `prestashop-buyer-search-product` |
| Arm | accessibility-locator Playwright |
| Reset | native reset immediately before run; ready HTTP 200; seed counts `[3,19,5,6]` |
| Actions | 3 |
| Replay frames | 6 (local ignored replay archive) |
| Final milestone | authenticated search results |
| Target visible | yes |
| Product count | 5 |
| Independent database oracle | pass; target `Mug The adventure begins` present in `ps_product_lang` |
| Run status | completed / clean |
| Wall time | 1328 ms |

The clean replay passed after the fault/evolution controller gate, providing a negative-control check that the page-local mutation controllers did not persist into a fresh page or alter the database. CUA and Hybrid matched runs are still open; this result must not be interpreted as a three-arm comparison.
