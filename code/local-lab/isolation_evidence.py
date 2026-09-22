"""Read-only two-direction cross-instance content/reset evidence verifier.

This verifies actual export bytes against a frozen, independently reviewed
mutable-state inventory. It cannot discover omitted services or certify that an
exporter is faithful. No producer 'passed' flag substitutes for byte comparison.
No container mutation, reset, credential reads or benchmark admission here.
"""
import argparse
import hashlib
import json
from pathlib import Path
import stat
from runtime_inputs import read_pinned

STAGES=('A0','B0','Am','B_after_Am','Ar','B_after_Ar','Bm','A_after_Bm','Br','A_after_Br')
INSTANCE={'A0':'A','Am':'A','Ar':'A','A_after_Bm':'A','A_after_Br':'A',
          'B0':'B','B_after_Am':'B','B_after_Ar':'B','Bm':'B','Br':'B'}


def content_hash(ref):
    path=Path(ref['file'])
    if not path.is_absolute() or path.is_symlink() or not path.is_file():
        raise ValueError('Absolute regular non-symlink export required')
    if stat.S_IMODE(path.stat().st_mode)&0o077:
        raise ValueError('Raw state exports must remain private')
    h=hashlib.sha256();size=0
    with path.open('rb') as stream:
        while chunk:=stream.read(1024*1024):h.update(chunk);size+=len(chunk)
    if h.hexdigest()!=ref.get('sha256') or size!=ref.get('bytes') or size==0:
        raise ValueError('State export bytes/hash differ or export is empty')
    return h.hexdigest()


def audit(package):
    if package.get('schema')!='pss-cross-instance-isolation-v1':raise ValueError('Isolation package required')
    invref=package['inventory_ref']
    inventory=json.loads(read_pinned(invref['file'],invref['sha256']))
    if inventory.get('schema')!='pss-mutable-state-inventory-v1':raise ValueError('Frozen inventory required')
    components=inventory.get('components')
    if not isinstance(components,list) or not components:raise ValueError('Nonempty mutable-state inventory required')
    ids=[c['id'] for c in components]
    if len(ids)!=len(set(ids)) or any(c.get('kind') not in ('database','filesystem','object-store','cache','queue') for c in components):
        raise ValueError('Unique explicit mutable components required')
    review=json.loads(read_pinned(inventory['coverage_review_ref']['file'],inventory['coverage_review_ref']['sha256']))
    if (review.get('closure_verified') is not True or review.get('component_ids')!=ids
        or not review.get('reviewer') or review.get('unresolved_components')!=[]):
        raise ValueError('Independent closure review missing or unresolved')
    for field in ('topology_ref','exporter_source_ref','quiescence_protocol_ref'):
        ref=inventory[field];read_pinned(ref['file'],ref['sha256'])
    resources=inventory.get('instances',{})
    if set(resources)!= {'A','B'}:raise ValueError('Two explicitly owned instances required')
    sets=[]
    for instance in ('A','B'):
        mapping=resources[instance]
        if set(mapping)!=set(ids) or any(not isinstance(v,str) or not v for v in mapping.values()):
            raise ValueError('Every mutable resource must have a concrete instance identity')
        sets.append(set(mapping.values()))
    if sets[0]&sets[1]:raise ValueError('Instances share mutable resource identities')
    snapshots=package.get('snapshots',{})
    if set(snapshots)!=set(STAGES):raise ValueError('Complete bidirectional mutation/reset sequence required')
    hashes={};last=-1
    for stage in STAGES:
        ref=snapshots[stage];snapshot=json.loads(read_pinned(ref['file'],ref['sha256']))
        if (snapshot.get('schema')!='pss-isolation-state-v1' or snapshot.get('inventory_ref')!=invref
            or snapshot.get('instance')!=INSTANCE[stage] or snapshot.get('stage')!=stage
            or snapshot.get('resource_ids')!=resources[INSTANCE[stage]]):
            raise ValueError('Snapshot inventory/stage/instance mismatch')
        start,end=snapshot.get('capture_started_ns'),snapshot.get('capture_ended_ns')
        if any(type(v) is not int for v in (start,end)) or not last<start<=end:
            raise ValueError('Ordered same-host capture intervals required')
        last=end
        if snapshot.get('quiescent') is not True or snapshot.get('unresolved_components')!=[]:
            raise ValueError('Unstable or incomplete snapshot cannot prove isolation')
        exports=snapshot.get('exports',{})
        if set(exports)!=set(ids):raise ValueError('Snapshot omits mutable state')
        hashes[stage]={key:content_hash(value) for key,value in exports.items()}
    for left,right in (('A0','Ar'),('B0','B_after_Am'),('B0','B_after_Ar'),
                       ('B0','Br'),('Ar','A_after_Bm'),('Ar','A_after_Br')):
        if hashes[left]!=hashes[right]:raise ValueError('Restore or peer content changed: '+left+'/'+right)
    for initial,changed in (('A0','Am'),('B0','Bm')):
        if any(hashes[initial][key]==hashes[changed][key] for key in ids):
            raise ValueError('Positive perturbation not demonstrated for every component')
    return {'kind':'CROSS_INSTANCE_CONTENT_AUDIT','snapshot_contract_passed':True,
        'component_count':len(ids),'snapshot_count':len(STAGES),'inventory_sha256':invref['sha256'],
        'scope':'All components in independently reviewed inventory; exporter/topology fidelity requires live acceptance',
        'confirmatory_authorized':False,'benchmark_task_executions':0}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('package');args=parser.parse_args()
    try:print(json.dumps(audit(json.loads(Path(args.package).read_bytes()))))
    except (ValueError,KeyError,TypeError,OSError) as exc:
        print(json.dumps({'snapshot_contract_passed':False,'error_type':type(exc).__name__}));raise SystemExit(2)
