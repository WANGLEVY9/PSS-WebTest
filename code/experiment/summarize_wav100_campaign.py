"""Sanitized diagnostic accounting: distinct official IDs, not retries or plans.

Reads sealed probe reports only. Does not read screenshots, HAR, model prompts,
credentials or evaluator gold. A score with an execution error is not a clean
capability outcome. No data is promoted into confirmatory evidence.
"""
import argparse
import hashlib
import json
from pathlib import Path
from prepare_official_runtime import save

PROFILES={'agentlab-visual':('agentlab-browsergym','visual'),
 'agentlab-hybrid':('agentlab-browsergym','hybrid'),
 'browser-use-hybrid':('browser-use-restricted','hybrid'),
 'playwright':('playwright','traditional')}
FIELDS=('task_id','framework','mode','model','official_task_started','official_task_completed',
 'official_score','assessment_status','actor_status','failure_class','engineering_error',
 'provider_requests','actions','owned_cleanup_completed','cleanup_error')


def summarize(reports):
    result={}
    for profile,(framework,mode) in PROFILES.items():
        rows=[r for r in reports if (r.get('framework'),r.get('mode'))==(framework,mode)]
        started=[r for r in rows if r.get('official_task_started') is True]
        clean=[r for r in started if r.get('official_task_completed') is True
               and r.get('assessment_status')=='valid' and r.get('engineering_error') is None
               and r.get('actor_status')=='completed' and r.get('failure_class') is None
               and r.get('actor_budget_met') is True and r.get('source_tree_unchanged') is True
               and r.get('replay_integrity_passed') is True]
        result[profile]={'target_distinct_tasks':100,'probe_attempts':len(rows),
            'official_actor_starts':len(started),'distinct_official_tasks_started':len({r['task_id'] for r in started}),
            'valid_native_scores':sum(r.get('assessment_status')=='valid' for r in started),
            'completed_actor_valid_evaluation':len(clean),
            'native_success_with_completed_actor':sum(r.get('official_score')==1 for r in clean),
            'distinct_tasks_completed_actor_and_evaluated':len({r['task_id'] for r in clean}),
            'interpretation':'Configurations/coordinate policies may differ; not a pooled success-rate estimate.'}
    return result


def provider_metrics(folder):
    directory=folder/'trajectory';trace=directory/'trajectory.jsonl'
    summary={'recorded_responses':0,'returned_models':[],'http_status_counts':{},
             'known_input_tokens':0,'known_output_tokens':0,'responses_without_complete_usage':0,
             'provider_latency_ms':[],'billed_cost':None}
    if not trace.exists():return summary
    for event in map(json.loads,trace.read_text().splitlines()):
        if event.get('kind')!='provider-end':continue
        ref=event['response'];file=directory/ref['file']
        if file.is_symlink() or file.resolve().parent!=directory.resolve():raise ValueError('Response path outside trajectory')
        raw=file.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=ref['sha256']:raise ValueError('Response artifact drift')
        r=json.loads(raw);summary['recorded_responses']+=1
        if r.get('model_returned') is not None:summary['returned_models'].append(r['model_returned'])
        status=str(r.get('http_status'));summary['http_status_counts'][status]=summary['http_status_counts'].get(status,0)+1
        usage=r.get('usage') or {}
        for source,target in [('input_tokens','known_input_tokens'),('output_tokens','known_output_tokens')]:
            if type(usage.get(source)) is int:summary[target]+=usage[source]
        summary['responses_without_complete_usage']+=int(any(type(usage.get(k)) is not int for k in ('input_tokens','output_tokens')))
        if type(r.get('latency_ms')) in (int,float):summary['provider_latency_ms'].append(r['latency_ms'])
    summary['returned_models']=sorted(set(summary['returned_models']))
    return summary


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--artifacts',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    rows=[];unfinished=[]
    for folder in sorted(Path(a.artifacts).glob('qwen38max-official-wav*-*')):
        file=folder/'report.json'
        if not file.exists():unfinished.append(folder.name);continue
        raw=file.read_bytes();r=json.loads(raw)
        if r.get('kind')!='OFFICIAL_WAV_TASK_ACCEPTANCE_PROBE':raise ValueError('Unexpected report kind')
        config=json.loads((folder/'configuration.json').read_bytes())
        receipt_file=folder/'trajectory/actor-receipt.json'
        receipt=json.loads(receipt_file.read_bytes()) if receipt_file.exists() else {}
        rows.append({'run_id':folder.name,'report_sha256':hashlib.sha256(raw).hexdigest(),
            **{key:r.get(key) for key in FIELDS},
            'coordinate_space':config['coordinate_space'],
            'observation_timeout_ms':config.get('observation_timeout_ms',5000),
            'action_timeout_ms':config.get('action_timeout_ms',5000),
            'actor_budget_met':receipt.get('budget_met'),
            'actor_elapsed_ms':receipt.get('elapsed_ms'),
            'source_tree_unchanged':receipt.get('source_tree_unchanged'),
            'api':provider_metrics(folder),
            'replay_integrity_passed':r.get('replay',{}).get('passed'),
            'bulk_admitted':False,'confirmatory_authorized':False})
    out={'kind':'WAV100_DISTINCT_TASK_PROGRESS','scope':'diagnostic',
         'profiles':summarize(rows),'probe_reports':rows,'unsealed_directories':unfinished,
         'planned_executions':400,'target_is_not_execution_count':True,
         'full_state_isolation_proven':False,'bulk_admitted':False,'confirmatory_authorized':False}
    save(Path(a.output),out)
    print(json.dumps({'profiles':out['profiles'],'unsealed_directories':unfinished}))


if __name__=='__main__':main()
