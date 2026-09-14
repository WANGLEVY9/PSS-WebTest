# ATA/PinATA gate audit — 2026-09-14

Command: `npm run gate:ata`

| Service | Observation |
|---|---|
| VTaaS Classifieds (`:9980`) | HTTP 302; reachable |
| VTaaS OneStopShop (`:7770`) | HTTP 302; reachable |
| VTaaS Postmill (`:9999`) | HTTP 200; reachable |
| GitHub reset credential | not configured in this local process |
| Independent oracle audit | not verified; published evaluator uses Actor/Assertor status |

The gate returned `infrastructure-gate-failed`, `ready=false`, and
`study_execution_allowed=false`. Remote service reachability is useful
diagnostic evidence, but no ATA task, reset dispatch, evaluator, provider, or
arm request was executed. The missing credential and unresolved evaluator
semantics remain environment/protocol prerequisites and do not enter any
experimental denominator.
