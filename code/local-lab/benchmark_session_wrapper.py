"""Trusted subprocess bridge between a leased worker and a benchmark-owned actor.

stdin contains supervisor metadata; only the reconstructed allowlisted public
payload enters an actor. No formal admission, implicit fixture setup or models
are selected here. stdout is one JSON lifecycle envelope; other output is stderr.
"""
import argparse
import contextlib
import json
from pathlib import Path
import sys
from runtime_store import Store, digest, canonical
from runtime_inputs import read_pinned, verify_bound_input, materialize_actor_input
from runtime_worker import validate_commands

SUPERVISOR_SOURCES=('benchmark_session_wrapper.py','benchmark_actor_lifecycle.py',
    'benchmark_task_session.py','session_auth.py','lifecycle_timing.py','runtime_worker.py',
    'runtime_inputs.py','runtime_store.py','replay_audit.py')


def validate_request(request, manifest_ref):
    if set(request) != {'schema','actor_payload','binding','reset_receipt'} or request['schema']!='pss-owned-session-request-v1':
        raise ValueError('Exact trusted session request required')
    manifest = json.loads(read_pinned(manifest_ref['file'],manifest_ref['sha256']))
    if manifest.get('schema')!='pss-owned-session-wrapper-v1':
        raise ValueError('Pinned wrapper manifest required')
    sources=manifest.get('supervisor_source_refs',{})
    if set(sources)!=set(SUPERVISOR_SOURCES):raise ValueError('Full supervisor source pins required')
    for name,ref in sources.items():
        if Path(ref['file']).resolve()!=Path(__file__).with_name(name).resolve():
            raise ValueError('Supervisor source path mismatch')
        read_pinned(ref['file'],ref['sha256'])
    binding, payload, reset = request['binding'],request['actor_payload'],request['reset_receipt']
    validate_commands(binding)
    if binding.get('actor_protocol')!='owned-session-v1':raise ValueError('Owned session binding required')
    argv = binding['commands']['actor']['argv']
    for flag,value in (('--manifest',manifest_ref['file']),('--manifest-sha256',manifest_ref['sha256'])):
        if argv.count(flag)!=1 or argv[argv.index(flag)+1]!=value:
            raise ValueError('Wrapper manifest not pinned by frozen command')
    if Path(binding['commands']['actor']['source']).resolve()!=Path(__file__).resolve():
        raise ValueError('Actor command must pin this trusted wrapper')
    ledger = payload['request_ledger']
    if not Path(ledger['database']).is_absolute() or not Path(ledger['database']).is_file():
        raise ValueError('Existing absolute local ledger required')
    store = Store(ledger['database'])
    try:
        row = store.owned(ledger['opportunityId'],ledger['leaseToken'],states=('running',))
        op = json.loads(row['payload'])
        if op.get('scope') not in ('synthetic','diagnostic'):raise ValueError('Formal admission remains blocked')
        if op.get('runtime_binding_sha256')!=digest(binding):raise ValueError('Frozen runtime binding drift')
        op['lease_token']=ledger['leaseToken']
        reset_event = store.db.execute("SELECT payload FROM events WHERE opportunity=? AND kind='owned-session-reset' ORDER BY rowid DESC LIMIT 1",(op['opportunity_id'],)).fetchone()
        if reset_event is None or json.loads(reset_event['payload'])!={'lease_token':op['lease_token'],'reset_sha256':digest(reset)}:
            raise ValueError('Reset not attested by owning worker')
    finally:store.close()
    verify_bound_input(op)
    base={k:op[k] for k in ('opportunity_id','environment_id','configuration_sha256','scope','lease_token')}
    base['data_kind']='MEASURED' if op['scope']=='diagnostic' else 'SYNTHETIC_TEST'
    expected={**base,'input':materialize_actor_input(op['agent_input']),
        'coordinate_space':binding.get('coordinate_space','css-pixels'),
        'model_binding':binding.get('model_binding'),'budget':binding['budget'],
        'request_ledger':{'database':ledger['database'],'opportunityId':op['opportunity_id'],
            'leaseToken':op['lease_token'],'capMicroUsd':binding.get('cost_policy',{}).get('cap_micro_usd')},
        'cost_policy':binding.get('cost_policy')}
    if payload!=expected:raise ValueError('Actor payload differs from frozen outcome-free projection')
    if any(reset.get(k)!=v for k,v in base.items()):raise ValueError('Reset belongs to another execution')
    if (op.get('configuration_sha256')!=binding['configuration_sha256']
        or op['environment_id']!=binding['environment_id']
        or op.get('model_binding')!=binding.get('model_binding')):
        raise ValueError('Opportunity and binding identity differ')
    expected_mode='traditional' if binding['framework']=='playwright' else binding.get('mode')
    if expected_mode not in ('traditional','visual','hybrid') or binding.get('mode')!=expected_mode:
        raise ValueError('Explicit compatible actor mode required')
    if op['scope']=='diagnostic' and binding['framework']=='playwright':
        ref=binding.get('traditional_adaptation_ref')
        if not ref:raise ValueError('Reviewed outcome-blind task adaptation required')
        review=json.loads(read_pinned(ref['file'],ref['sha256']))
        if (review.get('schema')!='pss-traditional-adaptation-v1'
            or review.get('task_key')!=op.get('task_key') or not op.get('task_key')
            or review.get('script_ref')!=binding.get('traditional_script_ref')
            or review.get('status')!='frozen' or not review.get('reviewer')
            or review.get('other_arm_outcomes_visible') is not False
            or review.get('evaluator_internals_visible') is not False):
            raise ValueError('Traditional authoring review misbound or not blinded')
    root=Path(manifest['artifact_root'])
    if not root.is_absolute() or root.is_symlink():raise ValueError('Absolute private artifact root required')
    routes=manifest.get('routes')
    if not isinstance(routes,dict) or not routes:raise ValueError('Explicit deployed route map required')
    if op.get('benchmark')=='vwa' and not manifest.get('native_evaluator_ref'):
        raise ValueError('VWA requires live-page evaluator manifest before launch')
    return op,binding,reset,expected,manifest


def execute(request, manifest_ref):
    op,binding,reset,payload,manifest=validate_request(request,manifest_ref)
    from playwright.sync_api import sync_playwright
    from benchmark_actor_lifecycle import run_owned_session
    evaluate=None
    if op.get('benchmark')=='vwa':
        from vwa_native_evaluate import evaluate_live
        evaluate=lambda actor,page:evaluate_live({**{k:payload[k] for k in
            ('opportunity_id','environment_id','configuration_sha256','scope','data_kind')},
            'actor_result':actor,'evaluation_ref':op['evaluation_ref']},manifest['native_evaluator_ref'],page)
    directory=Path(manifest['artifact_root'])/digest({'op':op['opportunity_id'],'lease':op['lease_token']})
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        try:
            return run_owned_session(browser,op,reset,binding['baseline_sha256'],manifest['routes'],directory,
                payload,binding['framework'],binding['mode'],manifest.get('node'),
                viewport=tuple(manifest.get('viewport',[1280,720])),locale=manifest.get('locale','en-US'),
                timezone_id=manifest.get('timezone_id','UTC'),storage_state_ref=reset.get('authentication_ref'),
                native_evaluator=evaluate,lifecycle_limits=binding['lifecycle_limits'],
                traditional_script_ref=binding.get('traditional_script_ref'))
        finally:browser.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',required=True);parser.add_argument('--manifest-sha256',required=True)
    args=parser.parse_args()
    request=json.load(sys.stdin)
    with contextlib.redirect_stdout(sys.stderr):
        result=execute(request,{'file':args.manifest,'sha256':args.manifest_sha256})
    print(canonical(result))


if __name__=='__main__':
    try:main()
    except Exception as exc:
        # Never print authenticated storage, private paths or provider responses.
        print(json.dumps({'error_type':type(exc).__name__,'stage':'owned-session-wrapper'}),file=sys.stderr)
        raise SystemExit(2)
