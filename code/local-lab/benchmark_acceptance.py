"""Read-only coverage audit for real per-benchmark/per-configuration acceptance.

Checks measured receipts and their pinned evidence; does not manufacture them.
An audit result never changes formal-acquisition authorization. Fixture closure,
native evaluator/control implementation and human evidence review still matter.
"""
import argparse
import json
from pathlib import Path
from runtime_inputs import read_pinned

PROFILES = ('agentlab-visual', 'agentlab-hybrid', 'browser-use-hybrid', 'playwright')
BENCHMARKS = ('wav', 'vwa', 'ata')
CHECKS = ('official_task_binding', 'boundary', 'reset', 'isolation', 'native_evaluator', 'replay', 'budget', 'provider')


def audit(package):
    if package.get('schema') != 'pss-benchmark-acceptance-v1' or package.get('protocol_id') != 'pss-manuscript-v2.1':
        raise ValueError('Active benchmark acceptance schema required')
    if not package.get('campaign_id') or not package.get('host_id'):
        raise ValueError('Campaign and actual host identity required')
    receipts = package.get('receipts', [])
    rows, seen, source_ids = [], set(), set()
    by_key = {}
    for ref in receipts:
        if ref['sha256'] in seen:
            raise ValueError('Receipt reused for multiple acceptance cells')
        seen.add(ref['sha256'])
        receipt = json.loads(read_pinned(ref['file'], ref['sha256']))
        key = (receipt.get('benchmark'), receipt.get('profile'))
        if key in by_key or key[0] not in BENCHMARKS or key[1] not in PROFILES:
            raise ValueError('Duplicate/unknown acceptance cell')
        if not receipt.get('receipt_id') or receipt['receipt_id'] in source_ids:
            raise ValueError('Unique acceptance receipt identity required')
        source_ids.add(receipt['receipt_id'])
        by_key[key] = receipt
    for benchmark in BENCHMARKS:
        for profile in PROFILES:
            r = by_key.get((benchmark, profile))
            errors = []
            if not r:
                errors.append('no-measured-receipt')
            else:
                if r.get('data_kind') != 'MEASURED' or any(r.get(k) != package[k] for k in ('protocol_id', 'host_id', 'campaign_id')):
                    errors.append('measured-host-campaign-identity-mismatch')
                for check in CHECKS:
                    if check == 'provider' and profile == 'playwright':
                        continue
                    evidence = r.get('checks', {}).get(check)
                    if not isinstance(evidence, dict) or evidence.get('status') != 'passed' or not evidence.get('artifacts'):
                        errors.append(check + ':missing-or-not-passed')
                        continue
                    for artifact in evidence['artifacts']:
                        try: read_pinned(artifact['file'], artifact['sha256'])
                        except (OSError, ValueError, KeyError): errors.append(check + ':evidence-missing-or-drifted')
                reset = r.get('reset_cycles', [])
                if len(reset) < 2:
                    errors.append('at-least-two-mutate-reset-cycles-required')
                for cycle in reset:
                    baseline = cycle.get('baseline_sha256')
                    if not baseline or cycle.get('after_reset_sha256') != baseline or cycle.get('mutated_sha256') in (None, baseline) or cycle.get('fresh_agent_context') is not True:
                        errors.append('reset-did-not-prove-mutation-restoration-and-agent-reset')
                    peers = cycle.get('peers', [])
                    if not peers or any(not p.get('environment_id') or not p.get('before_sha256') or p.get('before_sha256') != p.get('after_sha256') for p in peers):
                        errors.append('peer-isolation-not-demonstrated')
                controls = r.get('evaluator_controls', {})
                if controls != {'positive': 'correct', 'negative': 'incorrect', 'malformed': 'unresolved'}:
                    errors.append('native-evaluator-controls-incomplete')
                if r.get('strict_success_required_for_admission') is not False:
                    errors.append('capability-success-must-not-select-admitted-tasks')
            rows.append({'benchmark': benchmark, 'profile': profile, 'status': 'blocked' if errors else 'evidence-ready-for-review', 'errors': sorted(set(errors))})
    return {'kind': 'BENCHMARK_ACCEPTANCE_EVIDENCE_AUDIT', 'campaign_id': package['campaign_id'], 'host_id': package['host_id'],
            'cells': rows, 'ready_cells': sum(r['status'] == 'evidence-ready-for-review' for r in rows), 'required_cells': 12,
            'confirmatory_authorized': False, 'model_requests': 0, 'benchmark_executions': 0,
            'limitation': 'Receipt and file consistency is not independent verification of their contents; human scientific admission remains separate.'}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--package', required=True)
    p.add_argument('--output', required=True)
    args = p.parse_args()
    result = audit(json.loads(Path(args.package).read_text()))
    from prepare_official_runtime import save
    save(Path(args.output), result)
    print(json.dumps(result))
    raise SystemExit(0 if result['ready_cells'] == result['required_cells'] else 2)
