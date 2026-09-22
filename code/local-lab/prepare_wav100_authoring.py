"""Create a public-input-only authoring handoff for 100 diagnostic WAV tasks.

Not the frozen confirmatory included set. Never reads evaluator files, existing
agent results or credentials. PENDING entries are not scripts or executions.
"""
import argparse
import hashlib
import json
from pathlib import Path
from prepare_official_runtime import save
from runtime_inputs import read_pinned,task_projection
from benchmark_output_contract import public_output_instruction


def public_entry(task,binding):
    key='wav:'+str(task['task_id'])
    if task['task_key']!=key or binding['benchmark']!='wav' or str(binding['official_task_id'])!=str(task['task_id']):
        raise ValueError('Official identity mismatch')
    raw=read_pinned(binding['agent_input_file'],binding['agent_input_sha256'])
    actor=task_projection(json.loads(raw),'wav')
    setup=json.loads(read_pinned(binding['setup_ref']['file'],binding['setup_ref']['sha256']))
    if actor['intent']!=task['intent'] or setup['sites']!=task['sites'] or setup['start_urls']!=task['start_urls']:
        raise ValueError('Public task/setup drift from selected campaign')
    return {'task_key':key,'official_task_id':task['task_id'],'benchmark':'wav',
        'intent_template_id':task['intent_template_id'],'public_task':actor,
        'public_start_urls':list(task['start_urls']),
        'output_instruction':public_output_instruction('wav'),
        'official_instruction_digest':binding['agent_input_sha256'],
        'script_status':'PENDING','review_status':'PENDING','authentication_policy':'UNREVIEWED',
        'authoring_minutes':None,'debugging_minutes':None,'review_minutes':None,
        'script_sha256':None,'script_file':None,'author_pseudonym':None,
        'agent_outcomes_exposed':False,'evaluator_internals_exposed':False,
        'exposure_note':'File projection only; human independence requires separate access controls.',
        'confirmatory_authorized':False}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--plan',required=True);p.add_argument('--bindings',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    plan_raw=Path(a.plan).read_bytes();plan=json.loads(plan_raw)
    if len(plan['tasks'])!=100 or len({t['task_key'] for t in plan['tasks']})!=100:
        raise ValueError('Exactly 100 distinct planned task IDs required')
    bindings=json.loads(Path(a.bindings).read_bytes())['tasks']
    # Validate all records before creating a partially filled handoff.
    rows=[public_entry(task,bindings[task['task_key']]) for task in plan['tasks']]
    dest=Path(a.output);dest.mkdir(mode=0o700,parents=True,exist_ok=False)
    refs=[]
    for row in rows:
        name='wav-'+str(row['official_task_id'])+'.json'
        digest=save(dest/name,row);refs.append({'task_key':row['task_key'],'file':name,'sha256':digest})
    report={'kind':'WAV100_BLIND_AUTHORING_PREPARATION','task_count':100,'script_count':0,
        'scope':'diagnostic-source-preparation-not-frozen-eligibility','plan_sha256':hashlib.sha256(plan_raw).hexdigest(),
        'source_commit':plan['source_commit'],'dataset_sha256':plan['dataset_sha256'],
        'authentication_policies_reviewed':0,'official_executions':0,'human_reviews_completed':0,
        'files':refs,'confirmatory_authorized':False}
    save(dest/'manifest.json',report)
    print(json.dumps({k:report[k] for k in ('task_count','script_count','authentication_policies_reviewed','official_executions')}))


if __name__=='__main__':main()
