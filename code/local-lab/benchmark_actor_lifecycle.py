"""Supervisor-only benchmark context/HAR lifecycle, never an actor observation.

The original actor-end receipt remains immutable. run_owned_session returns it
as actor_result and an independent actor_lifecycle_ref. Worker integration must
forward BOTH to the evaluator; it must not append HAR fields to actor_result.
No CLI or automatic model calls. Diagnostic callers must own an accepted reset,
fixture closure, frozen task binding and an explicit model/budget configuration.
Synthetic tests may inject a driver, but that path cannot admit real tasks.
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import stat

from benchmark_task_session import create_context
from journaled_browser import Journal
from replay_audit import audit as audit_replay
from runtime_inputs import read_pinned

SCHEMA = 'pss-actor-lifecycle-v1'
IDENTITY = ('opportunity_id', 'environment_id', 'configuration_sha256')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)+'\n').encode()


def persist(path, raw):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'wb') as stream:
        stream.write(raw);stream.flush();os.fsync(stream.fileno())
    return {'file':str(path),'sha256':sha(raw)}


def pinned_ref(path):
    path=Path(path).resolve()
    return {'file':str(path),'sha256':sha(path.read_bytes())}


def checked_actor(directory, actor):
    directory=Path(directory).resolve()
    if Path(actor.get('trajectory_directory','')).resolve()!=directory:
        raise ValueError('Actor trajectory directory mismatch')
    report=audit_replay(directory)
    if not report['passed']:
        raise ValueError('Cannot seal incomplete or corrupted actor journal')
    raw=(directory/'trajectory.jsonl').read_bytes()
    rows=[json.loads(line) for line in raw.splitlines()]
    endings=[r for r in rows if r['kind']=='actor-end']
    if len(endings)!=1 or endings[0]['receipt']!=actor or rows[-1]['kind']!='actor-end':
        raise ValueError('Immutable final actor-end receipt required')
    return raw


def seal_context(context, journal, actor_result, scope):
    """Close the owned context, then seal its finalized HAR without changing actor."""
    if scope not in ('synthetic','diagnostic'):
        raise ValueError('Separate formal campaign admission required')
    directory=Path(journal.directory).resolve()
    if stat.S_IMODE(directory.stat().st_mode)&0o077:
        raise ValueError('Actor artifacts must be private')
    actor=copy.deepcopy(actor_result)
    expected_kind='MEASURED' if scope=='diagnostic' else 'SYNTHETIC_TEST'
    if actor.get('scope')!=scope or actor.get('data_kind')!=expected_kind:
        raise ValueError('Actor and lifecycle provenance must agree')
    identity={key:actor.get(key) for key in IDENTITY}
    if not all(isinstance(value,str) and value for value in identity.values()):
        raise ValueError('Actor execution identities required')
    # Read before close: the journal must already end with the exact returned
    # actor receipt, and browser cleanup must not append or rewrite its events.
    before=checked_actor(directory,actor)
    observed=[]
    context.on('close',lambda *_:observed.append(True))
    context.close()
    if not observed:
        raise ValueError('No browser context close event observed')
    after=checked_actor(directory,actor)
    if before!=after or actor_result!=actor:
        raise ValueError('Actor receipt/journal changed during context close')
    har=directory/'network.har'
    if har.is_symlink() or not har.is_file():
        raise ValueError('Closed context did not finalize the owned HAR')
    # Playwright creates trace/HAR files using its own mode; the new owned files
    # are private before publishing any supervisor references.
    os.chmod(har,0o600)
    har_raw=har.read_bytes()
    trace=json.loads(har_raw)
    entries=trace.get('log',{}).get('entries')
    if not isinstance(entries,list):
        raise ValueError('Finalized HAR entries required')
    actor_ref=persist(directory/'actor-receipt.json',encoded(actor))
    receipt={**identity,'schema':SCHEMA,'scope':scope,
        'data_kind':'MEASURED' if scope=='diagnostic' else 'SYNTHETIC_TEST',
        'actor_receipt_ref':actor_ref,'trajectory_ref':pinned_ref(directory/'trajectory.jsonl'),
        'network_trace_ref':pinned_ref(har),'har_entries':len(entries),
        'context_close_observed':True,'context_closed_after_actor_end':True,
        'journal_unchanged_on_close':True,'confirmatory_authorized':False,
        'reset_isolation_verified_by_adapter':False}
    browser_trace=directory/'trace.zip'
    if browser_trace.exists():
        if browser_trace.is_symlink():raise ValueError('Browser trace symlink forbidden')
        os.chmod(browser_trace,0o600)
        receipt['browser_trace_ref']=pinned_ref(browser_trace)
    ref=persist(directory/'supervisor-lifecycle.json',encoded(receipt))
    return {'actor_result':actor,'actor_lifecycle_ref':ref}


def verify_lifecycle(ref,actor):
    """Recheck stored seal, identities, exact actor-end and bytes before evaluation."""
    if not isinstance(ref,dict) or set(ref)!={'file','sha256'}:
        raise ValueError('Pinned supervisor lifecycle reference required')
    seal=json.loads(read_pinned(ref['file'],ref['sha256']))
    if seal.get('schema')!=SCHEMA or seal.get('scope') not in ('synthetic','diagnostic'):
        raise ValueError('Diagnostic lifecycle schema required')
    if seal.get('data_kind')!=('MEASURED' if seal['scope']=='diagnostic' else 'SYNTHETIC_TEST'):
        raise ValueError('Lifecycle provenance label mismatch')
    if actor.get('scope')!=seal['scope'] or actor.get('data_kind')!=seal['data_kind']:
        raise ValueError('Actor/lifecycle provenance mismatch')
    if any(seal.get(k)!=actor.get(k) for k in IDENTITY):
        raise ValueError('Lifecycle belongs to another actor execution')
    if any(seal.get(k) is not True for k in
           ('context_close_observed','context_closed_after_actor_end','journal_unchanged_on_close')):
        raise ValueError('Context finalization unverified')
    if seal.get('confirmatory_authorized') is not False:
        raise ValueError('Lifecycle cannot authorize formal collection')
    directory=Path(actor['trajectory_directory']).resolve()
    if Path(ref['file']).resolve()!=directory/'supervisor-lifecycle.json':
        raise ValueError('Lifecycle outside actor directory')
    expected={'actor_receipt_ref':'actor-receipt.json','trajectory_ref':'trajectory.jsonl',
              'network_trace_ref':'network.har','browser_trace_ref':'trace.zip'}
    contents={}
    for key,name in expected.items():
        if key=='browser_trace_ref' and key not in seal:continue
        artifact=seal[key]
        if set(artifact)!={'file','sha256'} or Path(artifact['file']).resolve()!=directory/name:
            raise ValueError('Lifecycle artifact path mismatch')
        contents[key]=read_pinned(artifact['file'],artifact['sha256'])
    if json.loads(contents['actor_receipt_ref'])!=actor:
        raise ValueError('Supervisor actor receipt mismatch')
    if checked_actor(directory,actor)!=contents['trajectory_ref']:
        raise ValueError('Supervisor trajectory mismatch')
    entries=json.loads(contents['network_trace_ref']).get('log',{}).get('entries')
    if not isinstance(entries,list) or type(seal.get('har_entries')) is not int or len(entries)!=seal['har_entries']:
        raise ValueError('HAR accounting mismatch')
    return seal


def run_owned_session(browser,op,reset,baseline_sha256,routes,journal_directory,
                      payload,framework,mode,node,viewport=(1280,720),locale='en-US',
                      timezone_id='UTC',storage_state_ref=None,synthetic_driver=None):
    """Compose trusted setup → real actor → closed-context seal; never evaluate."""
    if op.get('scope') not in ('synthetic','diagnostic'):
        raise ValueError('Formal session admission is not implemented')
    if synthetic_driver is not None and op['scope']!='synthetic':
        raise ValueError('Synthetic driver cannot execute diagnostic benchmark tasks')
    if any(payload.get(key)!=op.get(key) for key in IDENTITY):
        raise ValueError('Worker/actor session identity mismatch')
    kind='MEASURED' if op['scope']=='diagnostic' else 'SYNTHETIC_TEST'
    if payload.get('scope')!=op['scope'] or payload.get('data_kind')!=kind:
        raise ValueError('Actor payload provenance differs from trusted opportunity')
    if payload.get('model_binding')!=op.get('model_binding'):
        raise ValueError('Actor model differs from frozen opportunity')
    public_keys=set(IDENTITY)|{'input','lease_token','model_binding','budget','request_ledger',
                              'cost_policy','coordinate_space','scope','data_kind'}
    if set(payload)-public_keys:
        raise ValueError('Unexpected supervisor data in actor payload')
    journal=Journal(journal_directory)
    context=None
    try:
        context,page,actor_input=create_context(browser,op,reset,baseline_sha256,routes,
            journal.directory,viewport,locale,timezone_id,storage_state_ref)
        if payload.get('input')!=actor_input:
            raise ValueError('Actor payload differs from frozen public task input')
        if synthetic_driver is None:
            from native_framework_driver import run_actor
            driver=run_actor
        else:driver=synthetic_driver
        # Only the existing actor payload is supplied. No setup/reset refs, HAR,
        # lifecycle file, evaluator result, hidden URL or gold is added to it.
        actor=driver(context,page,payload,journal,framework,mode,node,viewport=viewport)
        return seal_context(context,journal,actor,op['scope'])
    except BaseException as exc:
        cleanup='not-created'
        if context is not None:
            try:context.close();cleanup='closed'
            except Exception:cleanup='close-failed'
        persist(journal.directory/'supervisor-failure.json',encoded({
            **{key:op.get(key) for key in IDENTITY},'schema':'pss-actor-lifecycle-failure-v1',
            'error_type':type(exc).__name__,'context_cleanup':cleanup,
            'scope':op.get('scope'),'confirmatory_authorized':False}))
        raise
