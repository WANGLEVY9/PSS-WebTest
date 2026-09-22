# Phase 2 matched pilot input audit

Date: 2026-09-13  
Status: **pilot planning input; not confirmatory data**

The builder validated both ledger roots and produced one normalized input for
variance/power planning:

| Quantity | Value |
|---|---:|
| Valid records | 1,431 |
| Invalid records excluded | 159 |
| Single-arm strata cells | 259 |
| Single-arm eligible cells | 141 |
| Matched three-arm blocks | 89 |
| Matched blocks eligible for planning | 51 |

A matched block is keyed by application, workflow, condition family, and live
provider/model. It requires one Playwright, one visual, and one hybrid cell,
each with at least three reset-complete repetitions. Legacy
`qwen3-vl-flash` and records without a verifiable reset digest are retained for
diagnosis but excluded from eligible blocks.

## Eligible blocks by application

| Application | Matched blocks | Eligible blocks | Interpretation |
|---|---:|---:|---|
| BookStack | 11 | 1 | Only one complete live-model block currently meets reset/repetition criteria |
| Indico | 12 | 4 | Four complete blocks are available, but application admission still fails its oracle/breadth gates |
| Juice Shop | 48 | 46 | Qwen: 23/24; DeepSeek: 23/24 |
| Invoice Ninja | 18 | 0 | Existing records lack the required reset-digest contract in the normalized ledger |
| PrestaShop | 0 | 0 | Existing records lack the required reset-digest contract and workflow breadth |

The absence of eligible Invoice Ninja/PrestaShop blocks is a ledger contract
limitation, not evidence that their agents cannot execute. Their runners must
emit the same reset-digest-bearing record contract before those applications
can enter power planning.

Machine-readable input: [`2026-09-13-phase2-pilot-input.json`](2026-09-13-phase2-pilot-input.json).
