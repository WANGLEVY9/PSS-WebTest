# PrestaShop authenticated Playwright diagnostic (2026-09-10)

## Scope

This is a diagnostic/pilot artifact for one WebTestPilot-aligned workflow. It is not confirmatory evidence and does not admit PrestaShop into the study denominator.

Task: `prestashop-buyer-search-product`  
Intent: authenticate as the seeded buyer, search for `Mug`, and verify the target product in search results.  
Independent oracle: direct database query over `ps_product_lang`, requiring `Mug The adventure begins`.

## Observed runs

| Run | Reset context | Arm | Actions | Replay frames | Page milestone | Independent oracle | Result |
|---|---|---|---:|---:|---|---|---|
| first implementation | prior native reset | Playwright | 3 | 6 | authenticated search results; target locator false negative | passed | evaluator-error |
| `prestashop-playwright-search-r3` | native reset | Playwright | 3 | 6 | authenticated search results; target visible | passed | completed / clean |
| `prestashop-playwright-search-r4` | second native reset | Playwright | 3 | 6 | authenticated search results; target visible | passed | completed / clean |

The first implementation error was a strict accessibility-role locator mismatch: the target product was visible in the result list, but the locator did not recognize the nested product title link. The repair changed the page-state check to the bounded `#js-product-list .product-title` result region. This is recorded as harness/evaluator evidence, not as an agent failure.

## Reset evidence

Two successive native-arm reset probes both returned:

```text
ready HTTP 200
seed counts [3,19,5,6]
reset-complete
```

The image is still not digest-pinned in the public benchmark manifest, and the database service reports an amd64 image under the arm64 host. The app image itself builds natively; repeated reset stability needs a larger bounded probe before admission.

## Admission boundary

PrestaShop is still `candidate-unverified`. The following remain open:

- image and database digest pinning;
- repeated reset budget and clean-state digest contract;
- fault/evolution isolation and independent mutation oracles;
- matched pure-visual, hybrid, and Playwright runs;
- standardized three-arm ledger completeness.

No CUA or Hybrid result is claimed from this artifact.

