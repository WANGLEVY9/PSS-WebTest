# Phase 2 cross-application admission audit

Date: 2026-09-13  
Status: **pilot audit only; confirmatory collection remains fail-closed**

Command:

```text
npm --prefix code run audit:phase2:admission -- --output ../results/phase2/2026-09-13-phase2-application-admission-audit.json
```

The audit scans both append-only ledger roots used by the current runners:
`artifacts/phase2` and `code/artifacts/phase2`. It validates every JSONL record
against the configuration registry, counts matched task × condition × arm
cells, checks reset evidence, and checks live provider/model strata. Legacy
`qwen3-vl-flash` records are quarantined from the live-stratum threshold.

## Snapshot

| Item | Value |
|---|---:|
| Valid records | 1,431 |
| Invalid records excluded | 159 |
| JSONL files scanned | 355 |
| Applications in the matrix | 5 |
| Planned workflows/application | 8 |
| Conditions | 3 |
| Primary arms | 3 |
| Minimum pilot repetitions/cell | 3 |
| Confirmatory authorized | **No** |

## Application status

| Application | Implemented workflows | Valid records | Strict passes | Status | Blocking reason |
|---|---:|---:|---:|---|---|
| BookStack | 3/8 | 429 | 255 | blocked-workflow-breadth | five workflow slots missing; independent oracle and fault/evolution gates remain open |
| Indico | 2/8 | 139 | 40 | blocked-workflow-breadth | six workflow slots missing; independent oracle gate remains open |
| Juice Shop | 8/8 | 541 | 280 | pilot-admission-candidate | all 72 pooled cells and live provider strata meet the 3-record pilot threshold; still requires variance/power freeze |
| Invoice Ninja | 2/8 | 300 | 216 | blocked-workflow-breadth | six workflow slots missing; image/license provenance gate is unresolved |
| PrestaShop | 3/8 | 22 | 3 | blocked-workflow-breadth | five workflow slots missing; image/license provenance gate is unresolved |

The unified count for Juice Shop is 541 valid records. The older
Juice-specific report intentionally ignored four records in a non-`-records`
ledger filename and therefore reported 530 parseable records; this is a
ledger-view difference, not a new experimental success. The unified audit is
the authoritative cross-application view, while the Juice-specific report is
retained for historical provenance.

## Interpretation boundary

The result is **not** a leaderboard and does not authorize 14-repetition
confirmatory collection. A `pilot-admission-candidate` means only that the
current application-level coverage and live provider-stratum checks are
complete under the declared pilot threshold. It does not mean that the
application has passed preregistration, power simulation, model/framework
replication, or confirmatory freeze.

The 159 invalid records are retained as blocked evidence. They are not silently
converted into failures or successes; the JSON audit lists representative
validation errors. Provider quota/format failures, missing independent oracles,
and incomplete workflow breadth remain separate from capability outcomes.

## Long-run branch plan

1. **Juice Shop:** freeze the validated pilot input set, run the preregistered
   variance and power simulation, and keep confirmatory blocked until the
   analysis manifest is signed off.
2. **BookStack/Indico:** add only the missing workflow slots after repairing
   their oracle/fault gates; do not compensate for missing breadth with extra
   repetitions of existing tasks.
3. **Invoice Ninja/PrestaShop:** resolve public image/license provenance and
   bind five/six additional workflows respectively before application
   admission.
4. **All applications:** preserve the same three arms, reset contract,
   independent oracle, provider/model labels, and append-only run-record
   schema. Only after at least three applications are admitted-pilot should the
   nested framework/model replication wave begin.

Machine-readable evidence: [`2026-09-13-phase2-application-admission-audit.json`](2026-09-13-phase2-application-admission-audit.json).  
Stratified ledger input for dashboard/variance planning: [`2026-09-13-phase2-ledger-summary.json`](2026-09-13-phase2-ledger-summary.json).  
Execution contract: [`phase2-application-admission-manifest.v0.1.json`](../../code/config/phase2-application-admission-manifest.v0.1.json).
