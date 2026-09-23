"""Outcome-blind Shopping development selection; no model calls or admission.

Input is projected to public task fields before selection. One public exemplar
per intent template (smallest official ID), then a reproducible hash ranking of
the remainder. This single-site development subset is not representative WAV.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import subprocess
from prepare_navigation_runtime import PINS
from prepare_official_runtime import save

PROFILES=('agentlab-visual','agentlab-hybrid','browser-use-hybrid','playwright')


def select(public_rows,n=100,seed='pss-qwen38max-wav100-v1'):
    rows=[{k:t[k] for k in ('task_id','intent_template_id','sites','intent','start_urls')}
          for t in public_rows if t['sites']==['shopping']]
    if len({t['task_id'] for t in rows})!=len(rows):raise ValueError('Duplicate official IDs')
    if len(rows)<n:raise ValueError('Insufficient different official tasks')
    groups=defaultdict(list)
    for row in rows:groups[row['intent_template_id']].append(row)
    exemplars=[min(group,key=lambda t:t['task_id']) for group in groups.values()]
    if len(exemplars)>n:raise ValueError('Size smaller than template coverage')
    ids={t['task_id'] for t in exemplars}
    rest=sorted((t for t in rows if t['task_id'] not in ids),key=lambda t:hashlib.sha256((seed+':'+str(t['task_id'])).encode()).hexdigest())
    selected=sorted(exemplars+rest[:n-len(exemplars)],key=lambda t:t['task_id'])
    return selected,len(rows),len(groups)


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    source=Path(a.source).resolve();dataset=source/'assets/dataset/webarena-verified.json'
    head=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
    if head!=PINS['wav'] or subprocess.check_output(['git','-C',str(source),'status','--porcelain'],text=True).strip():raise ValueError('Clean pinned source required')
    raw=dataset.read_bytes();selected,total,templates=select(json.loads(raw))
    plan={'schema':'pss-wav100-development-campaign-v1','scope':'diagnostic','model':'qwen3.8-max',
       'source_commit':head,'dataset_sha256':hashlib.sha256(raw).hexdigest(),'site':'shopping',
       'available_source_tasks':total,'selected_unique_tasks':len(selected),'intent_templates_covered':templates,
       'selection_rule':'smallest official ID per public intent template, then SHA256(pss-qwen38max-wav100-v1:ID)',
       'outcomes_used_for_selection':False,'prior_exposure_known_ids':[21,22,163,164,165,166,167],
       'profiles':list(PROFILES),'planned_executions_per_profile':100,'planned_executions':400,
       'repetitions':1,'received_executions':0,'effective_executions':0,
       'proposed_budget':{'task_timeout_ms':180000,'max_actions':24,'max_output_tokens':2048},
       'budget_frozen':False,'task_adapters_complete':False,'bulk_execution_authorized':False,'confirmatory_authorized':False,
       'admission_note':'Keep official task failures, adaptation failures and external blocks distinct. Never replace failed IDs or count repeats as different tasks.',
       'tasks':[{'task_key':'wav:'+str(t['task_id']),**t,'status':'awaiting-task-auth-script-and-fixture-validation'} for t in selected]}
    sha=save(Path(a.output),plan)
    print(json.dumps({'unique_tasks':len(selected),'templates':templates,'planned':400,'executed':0,'sha256':sha}))


if __name__=='__main__':main()
