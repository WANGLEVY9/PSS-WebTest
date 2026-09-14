# PrestaShop agent engineering pilot — 2026-09-14

Scope: one clean-stable medium workflow (`search → open product`) on the
local seeded PrestaShop fixture. This is engineering evidence only; it is not
part of the redesigned confirmatory denominator and does not freeze
repetitions or power.

| Arm | Provider/model | Outcome | Actions | Independent DB oracle | Record |
|---|---|---|---:|---|---|
| Pure visual | Alibaba / qwen3.7-flash | completed | 4 | passed | `code/artifacts/phase2/prestashop-engineering-qwen-visual-medium-20260914.jsonl` |
| Hybrid | Alibaba / qwen3.7-flash | completed | 4 | passed | `code/artifacts/phase2/prestashop-engineering-qwen-hybrid-medium-20260914.jsonl` |

Both runs reached the product-detail checkpoint and passed the independent
database oracle. The visual run used screenshot-only observations; the Hybrid
run used screenshot plus the allow-listed visible-interactable projection and
semantic target IDs. Typed values are redacted in the replay/run-record
artifacts. Trace hashes bind each record to its exact execution trace.

## Failure-to-fix evidence

The preceding Hybrid attempt failed before the first provider request because
the runner serialized an `element: undefined` key and occasionally emitted
out-of-range normalized centers. Those were runner/schema defects, not agent
capability outcomes. The corrected run completed the same matched intent. The
canonical PrestaShop authentication route was also required because `/login`
redirects to `/`; this was fixed in all PrestaShop readiness and task runners.

The result demonstrates that the earlier Hybrid failures were at least partly
engineering-induced. It does **not** establish a strategy ranking: sample size
is one matched cell, only one model/provider was exercised, and the fixture is
outside the confirmatory benchmark population.
