# LLM-assisted screening simulation — 2026-09-15

Status: **diagnostic pilot only; not a human screening result**

## Scope and isolation

Four isolated model identities reviewed the frozen 192-task outcome-blind pilot
sample, seven criteria per task (IC1–IC7):

| Identity | Provider/model | Tasks | Valid task reviews |
|---|---|---:|---:|
| `deepseek-r1` | DeepSeek / `deepseek-v4-flash-vision-exp` | 192 | 192 |
| `deepseek-r2` | DeepSeek / `deepseek-v4-flash-vision-exp` | 192 | 192 |
| `qwen-r1` | Alibaba / `qwen3.7-flash` | 192 | 192 |
| `qwen-r2` | Alibaba / `qwen3.7-flash` | 192 | 192 |

Each identity received only source metadata and a sanitized task instruction.
Evaluator internals, prior arm outcomes, hidden state, and the other identities'
decisions were not sent. API keys and local application credentials were not
included in the prompt or any output artifact. The raw JSONL records and model
responses remain in the ignored local directory
`code/artifacts/benchmark-snapshots/llm-screening-simulations/`.

## Engineering observations

- The first pass produced 18 non-complete records: four ATA title-parsing
  failures and fourteen model-format failures. The ATA parser was corrected to
  handle quoted CSV titles; malformed/incomplete model replies receive one
  explicit JSON-format retry. The resumed run finished all 768 task reviews.
- The simulation writes neither `reviewer-1` nor `reviewer-2` state and does not
  modify the canonical screening ledger. `confirmatory_authorized` remains
  `false`.

## Diagnostic agreement (all 192 paired tasks after repair)

The complete pairwise report is in the ignored `summary.json`. Representative
agreement rates show strong model/persona sensitivity:

The current local summary digest is
`785acd88647395234caeeb072a2ae2e69a1ee27c70e53c1ca0a51c32ffe2bf35`.

| Pair | IC2 | IC3 | IC7 |
|---|---:|---:|---:|
| DeepSeek-R1 vs DeepSeek-R2 | 0.651 | 0.958 | 0.948 |
| Qwen-R1 vs Qwen-R2 | 0.688 | 0.505 | 0.443 |
| DeepSeek-R1 vs Qwen-R2 | 0.109 | 0.406 | 0.156 |
| DeepSeek-R2 vs Qwen-R2 | 0.365 | 0.406 | 0.208 |

The low cross-model agreement on evaluator availability (IC2), environment
executability (IC3), and privileged-information requirements (IC7) is a
diagnostic signal that the rubric requires source citations and human
adjudication; it is not evidence that either model is correct. Cohen's κ is
reported alongside agreement in the machine-generated summary and is sensitive
to the highly imbalanced `unclear` category.

## Protocol boundary

These are model-generated labels, not independent human judgments. They must
not be used to claim inter-rater reliability, freeze the eligible-task set, or
populate `included_tasks.csv`, `excluded_tasks.csv`, `screening_log.csv`, or the
Traditional adaptation ledger. The next valid step remains two human reviewers
working independently in the Screening Desk, followed by adjudication and a
full-inventory audit.

Reproduction command (requires the local provider files and an explicit execute
flag):

```bash
cd /Users/laurantwang/PSS-WebTest/code
npm run screening:llm-simulate -- --execute \
  --reviewers deepseek-r1,deepseek-r2,qwen-r1,qwen-r2 \
  --concurrency 3 --run-label 2026-09-14-llm-screening-full
```
