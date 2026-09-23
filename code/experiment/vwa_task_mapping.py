"""Supervisor-only content-addressed VWA site-ID to port global-ID mapping.

Compares ALL task fields including evaluators. Only task_id and the documented
homepage image prefix differ. No fuzzy intent matching, gold-to-actor delivery,
task exclusion or evaluator rewriting. Original image bytes remain pinned.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import subprocess
from prepare_navigation_runtime import PINS, image_refs
from prepare_official_runtime import save
from runtime_store import digest


def signature(task):
    normalized=dict(task)
    normalized.pop('task_id')
    def image_path(value):
        prefix='environment_docker/webarena-homepage/'
        if isinstance(value,str) and value.startswith(prefix):
            return '__HOMEPAGE__/'+value[len(prefix):]
        return value
    value=task.get('image')
    normalized['image']=[image_path(x) for x in value] if isinstance(value,list) else image_path(value)
    return digest(normalized)


def match(original, port):
    by_hash=defaultdict(list)
    for row in port:by_hash[signature(row)].append(row['task_id'])
    if len({r['task_id'] for r in port})!=len(port):raise ValueError('Duplicate global task IDs')
    output=[];seen=set()
    for key,row in original:
        sig=signature(row);candidates=by_hash[sig]
        if len(candidates)!=1 or candidates[0] in seen:
            raise ValueError('Missing, ambiguous or reused VWA content mapping: '+key)
        seen.add(candidates[0])
        output.append({'task_key':key,'port_global_task_id':candidates[0], 'content_sha256':sig})
    if len(seen)!=len(port):raise ValueError('Unmapped tasks in VWA port')
    return output


def prepare(source, port_file):
    source=Path(source).resolve();port_file=Path(port_file).resolve()
    head=subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()
    dirty=subprocess.check_output(['git','-C',str(source),'status','--porcelain','--untracked-files=no'],text=True).strip()
    if head!=PINS['vwa'] or dirty:raise ValueError('Pinned clean official VWA source required')
    original=[];sources=[];attachments={}
    for file in sorted((source/'config_files/vwa').glob('*.raw.json')):
        namespace=file.name.removeprefix('test_').removesuffix('.raw.json')
        sources.append({'file':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
        for row in json.loads(file.read_bytes()):
            key='vwa:'+namespace+':'+str(row['task_id'])
            original.append((key,row));attachments[key]=image_refs(row,source)
    port=json.loads(port_file.read_bytes())
    if len(original)!=910 or len(port)!=910:raise ValueError('VWA population drift')
    mapping=match(original,port)
    for row in mapping:row['official_image_refs']=attachments[row['task_key']]
    return {'schema':'pss-vwa-port-mapping-v1','source_commit':head,'source_files':sources,
        'port_ref':{'file':str(port_file),'sha256':hashlib.sha256(port_file.read_bytes()).hexdigest()},
        'mapped_tasks':len(mapping),'rows':mapping,'model_requests':0,'benchmark_executions':0,
        'confirmatory_authorized':False,
        'limitation':'Supervisor mapping only. Does not establish native environment, reset, evaluator or port reward equivalence.'}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--port-tasks',required=True)
    p.add_argument('--output',required=True);a=p.parse_args();report=prepare(a.source,a.port_tasks)
    h=save(Path(a.output),report)
    print(json.dumps({'mapped_tasks':report['mapped_tasks'],'mapping_sha256':h,'benchmark_executions':0,'confirmatory_authorized':False}))
