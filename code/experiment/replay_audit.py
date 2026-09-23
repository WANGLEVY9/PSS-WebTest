"""Read-only trajectory integrity audit. No success inference or model feedback."""
import argparse
import json
from pathlib import Path
from journaled_browser import sha


def audit(directory):
    root=Path(directory).resolve()
    raw=(root/'trajectory.jsonl').read_bytes()
    errors=[];previous=None;rows=[];artifacts=set()
    def check_ref(ref):
        file=(root/ref['file']).resolve()
        if file.parent!=root:raise ValueError('Artifact escapes private replay directory')
        data=file.read_bytes()
        if sha(data)!=ref['sha256'] or len(data)!=ref['bytes']:raise ValueError('Artifact hash/size mismatch')
        if file.suffix=='.json':visit(json.loads(data))
        artifacts.add(ref['file'])
    def visit(value):
        if isinstance(value,dict):
            if {'file','sha256','bytes'}<=set(value):check_ref(value)
            else:
                for item in value.values():visit(item)
        elif isinstance(value,list):
            for item in value:visit(item)
    if raw and not raw.endswith(b'\n'):errors.append('partial-last-event')
    for index,line in enumerate(raw.splitlines()):
        try:
            r=json.loads(line)
            if r['sequence']!=index or r['previous_sha256']!=previous:errors.append('event-chain-mismatch')
            visit(r);rows.append(r)
        except (ValueError,KeyError,OSError,RecursionError):errors.append('invalid-event-or-artifact')
        previous=sha(line)
    starts=[r for r in rows if r['kind']=='action-start'];ends=[r for r in rows if r['kind']=='action-end']
    if len(starts)!=len(ends):errors.append('incomplete-action')
    req=[r for r in rows if r['kind']=='provider-start'];res=[r for r in rows if r['kind']=='provider-end']
    if {r['request_id'] for r in req}!={r['request_id'] for r in res}:errors.append('unsettled-provider-attempt')
    actor_end=[r for r in rows if r['kind']=='actor-end']
    if len(actor_end)!=1:errors.append('no-unique-actor-end')
    return {'kind':'PRIVATE_REPLAY_INTEGRITY_AUDIT','passed':not errors,'errors':sorted(set(errors)),
            'events':len(rows),'actions':len(starts),'provider_attempts':len(req),
            'observation_frames':sum(r['kind']=='observation' for r in rows),
            'verified_artifacts':len(artifacts),'trajectory_sha256':sha(raw),
            'confirmatory_authorized':False,'scope':'artifact integrity only, not evaluator/capability correctness'}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory');a=p.parse_args();r=audit(a.directory)
    print(json.dumps(r));raise SystemExit(0 if r['passed'] else 2)
