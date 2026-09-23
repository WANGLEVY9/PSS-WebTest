"""Freeze a deterministic development cohort from official prepared inputs.

No runtime output is an input to selection. This is NOT human screening and
does not redefine the manuscript eligible set. Prior task exposure is unknown.
"""
import argparse
from collections import defaultdict, deque
import hashlib
import json
from pathlib import Path
from benchmark_acceptance import BENCHMARKS, PROFILES
from prepare_official_runtime import save
from runtime_inputs import read_pinned, task_projection
from runtime_store import digest


def select_tasks(bindings, benchmark, seed, n=20):
    groups = defaultdict(list)
    for key, row in bindings['tasks'].items():
        if row['benchmark'] != benchmark or key != benchmark + ':' + row['official_task_id']:
            raise ValueError('Official namespace mismatch')
        read_pinned(row['source_file'], row['source_sha256'])
        actor = json.loads(read_pinned(row['agent_input_file'], row['agent_input_sha256']))
        task_projection(actor, benchmark)
        evaluation = json.loads(read_pinned(row['evaluation_ref']['file'], row['evaluation_ref']['sha256']))
        for field in ('benchmark', 'official_task_id', 'source_sha256'):
            if evaluation.get(field) != row[field]: raise ValueError('Official identity mismatch')
        if benchmark == 'ata':
            stratum = (row['application'], evaluation['expected'])
        else:
            setup = json.loads(read_pinned(row['setup_ref']['file'], row['setup_ref']['sha256']))
            stratum = (row['application'], str(len(setup['start_urls']) > 1), str(bool(actor['task_images'])))
        groups[stratum].append({'task_key':key, 'benchmark':benchmark,
            'official_task_id':row['official_task_id'], 'application':row['application'],
            'stratum':list(stratum), 'binding':row, 'binding_sha256':digest(row),
            'prior_exposure':'unknown', 'scientific_screening':'not-established'})
        if benchmark == 'ata':
            labels=[s['step'] for s in actor['steps']]
            groups[stratum][-1]['source_step_labels_unique']=len(labels)==len(set(labels))
    if sum(map(len, groups.values())) < n: raise ValueError('Insufficient official candidates')
    rank = lambda key: hashlib.sha256((seed + ':' + key).encode()).hexdigest()
    buckets = [deque(sorted(rows, key=lambda r: rank(r['task_key'])))
               for _, rows in sorted(groups.items(), key=lambda item: rank(json.dumps(item[0])))]
    chosen = []
    while len(chosen) < n:
        for bucket in buckets:
            if bucket and len(chosen) < n: chosen.append(bucket.popleft())
    for i, row in enumerate(chosen):
        row.update(stage=2 if i < 2 else 10 if i < 10 else 20, stability_repeat=i < 5)
    return chosen


def build(bundles, seed, campaign_id):
    if set(bundles) != set(BENCHMARKS) or not seed or not campaign_id:
        raise ValueError('All three official bundles, seed and campaign identity required')
    tasks, refs = [], {}
    for benchmark, filename in bundles.items():
        raw = Path(filename).read_bytes()
        refs[benchmark] = {'file':str(Path(filename).resolve()), 'sha256':hashlib.sha256(raw).hexdigest()}
        tasks += select_tasks(json.loads(raw), benchmark, seed)
    return {'schema':'pss-development-cohort-v1', 'protocol_id':'pss-manuscript-v2.1',
        'campaign_id':campaign_id, 'scope':'diagnostic', 'selection_seed':seed,
        'selection_rule':'round-robin source metadata strata; within-stratum SHA256(seed:task_key)',
        'outcome_files_consumed':False, 'source_bundles':refs, 'tasks':tasks,
        'profiles':list(PROFILES), 'base_executions':240, 'stability_executions':120,
        'runtime_bindings_frozen':False, 'execution_authorized':False, 'confirmatory_authorized':False,
        'limitation':'Development coverage, not a representative sample or completed eligibility review. '
            'Official bindings require upstream source-pin audit. Prior exposure is unknown. '
            'No outcome-based replacement; unavailable tasks stay in the plan as blocked.'}


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    for name in BENCHMARKS: p.add_argument('--'+name, required=True)
    p.add_argument('--seed', required=True); p.add_argument('--campaign-id', required=True)
    p.add_argument('--output', required=True); a = p.parse_args()
    plan = build({b:getattr(a,b) for b in BENCHMARKS}, a.seed, a.campaign_id)
    sha = save(Path(a.output), plan)
    print(json.dumps({'tasks':len(plan['tasks']), 'planned_executions':360,
        'manifest_sha256':sha, 'benchmark_executions':0, 'execution_authorized':False}))
