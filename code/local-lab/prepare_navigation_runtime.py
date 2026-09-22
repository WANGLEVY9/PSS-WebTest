"""Pinned WAV/VWA public task + image + multipage setup import.

Imports the full official source population, NOT a screened/final study subset.
No automatic exclusion, task execution, remote image fetch, model request or
benchmark admission. All evaluator/program/reference data stays in separate
supervisor files; only intent and explicitly published task images reach actors.
"""
import argparse
import hashlib
import json
from runtime_store import digest
from pathlib import Path
import subprocess
from prepare_official_runtime import save
from runtime_inputs import task_projection

PINS={'wav':'6473f72db5dcefc97b5725b59e734504edc28a21',
      'vwa':'89f5af29305c3d1e9f97ce4421462060a70c9a03'}


def image_refs(task, source):
    source=Path(source).resolve()
    images=task.get('image')
    if images is None:images=[]
    elif isinstance(images,str):images=[images]
    if not isinstance(images,list):raise ValueError('Unknown official image field shape')
    out=[]
    for value in images:
        if not isinstance(value,str) or '://' in value:
            raise ValueError('Remote image requires separately reviewed pinned download')
        file=(source/value).resolve()
        if source not in file.parents:raise ValueError('Image outside pinned official checkout')
        raw=file.read_bytes()
        mime=('image/png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else
              'image/jpeg' if raw.startswith(b'\xff\xd8\xff') else
              'image/gif' if raw[:6] in (b'GIF87a',b'GIF89a') else
              'image/webp' if raw[:4]==b'RIFF' and raw[8:12]==b'WEBP' else None)
        if not mime:raise ValueError('Unsupported official image bytes; do not silently convert')
        out.append({'file':str(file),'sha256':hashlib.sha256(raw).hexdigest(),'mime_type':mime})
    return out


def split_public(task, benchmark, source):
    intent=task['intent']
    if not isinstance(intent,str) or not intent.strip():raise ValueError('Official intent required')
    starts=task['start_urls'] if benchmark=='wav' else task['start_url'].split(' |AND| ')
    if not starts or not all(isinstance(s,str) and s for s in starts):raise ValueError('Official start URLs required')
    actor={'schema':'pss-official-task-input-v1','benchmark':benchmark,'intent':intent,
           'task_images':image_refs(task,source) if benchmark=='vwa' else []}
    task_projection(actor,benchmark)
    setup={'start_urls':starts,'sites':task['sites'],
           'require_login':task.get('require_login'), 'storage_state':task.get('storage_state'),
           'geolocation':task.get('geolocation'), 'reset_before_each_arm':True,
           'original_require_reset':task.get('require_reset'),
           'note':'Supervisor only. No automatic URL rewriting, task exclusion, login assumption or actor metadata disclosure.'}
    return actor,setup


def prepare(benchmark,source,destination):
    source=Path(source).resolve();dest=Path(destination).resolve()
    head=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
    dirty=subprocess.check_output(['git','-C',str(source),'status','--porcelain','--untracked-files=no'],text=True).strip()
    if head!=PINS[benchmark] or dirty:raise ValueError('Official checkout pin/cleanliness mismatch')
    files=[source/'assets/dataset/webarena-verified.json'] if benchmark=='wav' else sorted((source/'config_files/vwa').glob('*.raw.json'))
    dest.mkdir(mode=0o700,parents=True,exist_ok=False)
    for folder in ('actor','evaluator','supervisor'):(dest/folder).mkdir(mode=0o700)
    rows=[];bindings={};blocked=[];inventory=[];seen=set();images=0;multi=0
    for file in files:
        raw=file.read_bytes();source_sha=hashlib.sha256(raw).hexdigest()
        for t in json.loads(raw):
            application='+'.join(t['sites'])
            # VWA task IDs are site-scoped; preserve source namespace, never
            # collapse classifieds:8 with shopping:8.
            tid=str(t['task_id']) if benchmark=='wav' else file.name.removeprefix('test_').removesuffix('.raw.json')+':'+str(t['task_id'])
            key=benchmark+':'+tid
            if key in seen:raise ValueError('Duplicate official identity')
            seen.add(key)
            identity={'benchmark':benchmark,'official_task_id':tid,'application':application,'source_sha256':source_sha}
            inventory.append({'task_key':key,**identity})
            try:actor,setup=split_public(t,benchmark,source)
            except (ValueError,OSError,KeyError) as exc:
                blocked.append({'task_key':key,'reason_type':type(exc).__name__,
                                'status':'input-preparation-blocked-not-excluded'});continue
            name=key.replace(':','-')+'.json'
            actor_file=dest/'actor'/name;gold_file=dest/'evaluator'/name;setup_file=dest/'supervisor'/name
            actor_hash=save(actor_file,actor)
            gold_hash=save(gold_file,{**identity,'official_config':t,'source_commit':head})
            setup_hash=save(setup_file,{**identity,**setup})
            rows.append({**identity,'task_key':key,'agent_input_sha256':actor_hash,
                         'setup_ref_sha256':digest({'file':str(setup_file),'sha256':setup_hash}),
                         'evaluation_sha256':gold_hash,'evaluation_ref_sha256':digest({'file':str(gold_file),'sha256':gold_hash})})
            bindings[key]={**identity,'source_file':str(file),'agent_input_file':str(actor_file),
                           'agent_input_sha256':actor_hash,'evaluation_ref':{'file':str(gold_file),'sha256':gold_hash},
                           'setup_ref':{'file':str(setup_file),'sha256':setup_hash}}
            images+=len(actor['task_images']);multi+=len(setup['start_urls'])>1
    expected=812 if benchmark=='wav' else 910
    if len(inventory)!=expected:raise ValueError('Official source inventory drift')
    save(dest/'candidate-inventory.json',inventory)
    save(dest/'task-bindings.json',{'tasks':bindings,'executors':{},'schedule_freeze_sha256':None})
    # A partial image import must never masquerade as the final eligible set.
    save(dest/'prepared-candidates.json',{'protocol_id':'pss-manuscript-v2.1','scope':'source-preparation',
                                        'tasks':rows,'blocked':blocked,'screening_complete':False})
    report={'kind':'OFFICIAL_NAVIGATION_INPUT_PREPARATION','benchmark':benchmark,'source_commit':head,
            'official_candidate_tasks':len(inventory),'prepared':len(rows),'blocked':blocked,
            'public_image_attachments':images,'multi_start_tasks':multi,'model_requests':0,
            'benchmark_executions':0,'confirmatory_authorized':False,'frozen_eligible_tasks':None,
            'actor_evaluator_setup_separated':True}
    save(dest/'report.json',report)
    return report


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--benchmark',choices=('wav','vwa'),required=True)
    p.add_argument('--source',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    report=prepare(a.benchmark,a.source,a.output);print(json.dumps(report));raise SystemExit(2 if report['blocked'] else 0)
