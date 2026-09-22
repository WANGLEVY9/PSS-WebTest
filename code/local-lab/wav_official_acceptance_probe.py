"""One official WAV task on a fresh owned fixture, for acceptance diagnosis.

This bounded bootstrap probe does not bypass the bulk execution gate. It never
authorizes the 100-task campaign. Only public-navigation task 260 is implemented;
all other tasks require their authentication and reviewed script adapters first.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from benchmark_actor_lifecycle import run_owned_session, pinned_ref, persist, encoded, verify_lifecycle
from runtime_inputs import task_projection, materialize_actor_input
from runtime_store import Store, digest
from replay_audit import audit
from wav_owned_lifecycle import OwnedLifecycle, read_ref, write_new
from wav_owned_peer_probe import comparisons
from probe_lease_guard import ProbeLeaseGuard

SCRIPT='''def run(session, public_task):
    session.get_by_role('link', name='Video Games', exact=True).click()
    return '{"task_type":"NAVIGATE","status":"SUCCESS","retrieved_data":null}'
'''


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--framework',choices=['agentlab-browsergym','browser-use-restricted','playwright'],required=True)
    p.add_argument('--mode',choices=['visual','hybrid','traditional'],required=True)
    p.add_argument('--manifest',required=True);p.add_argument('--manifest-sha256',required=True)
    p.add_argument('--peer-proof',required=True);p.add_argument('--peer-proof-sha256',required=True)
    p.add_argument('--bindings',required=True);p.add_argument('--output',required=True)
    p.add_argument('--port-base',type=int,required=True);p.add_argument('--live',action='store_true')
    p.add_argument('--coordinate-space',choices=['css-pixels','qwen-0-999'],default='css-pixels')
    p.add_argument('--observation-timeout-ms',type=int,default=30000)
    a=p.parse_args()
    if not a.live:print('No execution: --live required');return
    if ((a.framework=='playwright')!=(a.mode=='traditional') or
        a.framework=='browser-use-restricted' and a.mode!='hybrid'):raise ValueError('Incompatible framework/mode')
    if not 1024<=a.port_base<=65534:raise ValueError('Invalid ports')
    if not 1<=a.observation_timeout_ms<=30000:raise ValueError('Invalid observation timeout')
    if os.environ.get('PSS_LOCAL_ENV_FILE'):raise ValueError('Explicit env file override refused')
    proof=read_ref({'file':a.peer_proof,'sha256':a.peer_proof_sha256})
    if (proof.get('kind')!='WAV_OWNED_BIDIRECTIONAL_TARGETED_CONTENT_CONTROL' or
        proof.get('passed') is not True or proof.get('cleanup_errors')!=[] or
        comparisons(proof['states'])['targeted_content_passed'] is not True):
        raise ValueError('Completed measured targeted reset/peer control required')
    # Targeted peer proof is deliberately not accepted as full-state admission.
    for ref in proof['evidence_refs'].values():
        snapshot=read_ref(ref)
        for export in snapshot['exports'].values():read_ref(export)
    m=read_ref({'file':a.manifest,'sha256':a.manifest_sha256})
    binding=json.loads(Path(a.bindings).read_bytes())['tasks']['wav:260']
    public=read_ref({'file':binding['agent_input_file'],'sha256':binding['agent_input_sha256']})
    actor_input=task_projection(public,'wav')
    if actor_input['intent']!='Open the Video Game category page to browse products':raise ValueError('Frozen public task drift')
    setup=read_ref(binding['setup_ref'])
    if setup['sites']!=['shopping'] or setup['start_urls']!=['__SHOPPING__']:
        raise ValueError('Unsupported dependency/authentication setup')
    root=Path(a.output).resolve();root.mkdir(mode=0o700,parents=True,exist_ok=False)
    persist(root/'runner-source.py',Path(__file__).read_bytes())
    m.update(namespace='pss-wav-official-'+str(time.time_ns()),environment_id='wav-official-260',artifact_root=str(root/'instances'))
    m['sites'][0].update(http_port=a.port_base,control_port=a.port_base+1)
    mr=write_new(root/'fixture-manifest.json',m)
    os.environ.update(PSS_LOCAL_PROVIDER='aliyun',PSS_LOCAL_MODEL='qwen3.8-max',PSS_LOCAL_MAX_OUTPUT_TOKENS='2048')
    model=None if a.mode=='traditional' else {'provider':'aliyun','model':'qwen3.8-max'}
    configuration={'framework':a.framework,'mode':a.mode,'model':model,'coordinate_space':a.coordinate_space,
        'observation_timeout_ms':a.observation_timeout_ms,
        'max_output_tokens':2048,'budget':{'task_timeout_ms':180000,'max_actions':24},
        'lifecycle_limits':{'setup_ms':60000,'evaluation_ms':30000,'finalization_ms':30000,'transport_ms':30000},
        'script_sha256':digest(SCRIPT),'source_sha256':pinned_ref(root/'runner-source.py')['sha256']}
    cr=write_new(root/'configuration.json',configuration)
    schedule=write_new(root/'acceptance-opportunity.json',{'task_key':'wav:260','configuration_sha256':cr['sha256'],
        'scope':'acceptance-probe-not-bulk','prior_task_exposure':'public-intent-seen-no-outcome-used',
        'full_state_isolation_proven':False,'bulk_admission':False})
    op={'opportunity_id':root.name,'environment_id':m['environment_id'],'configuration_sha256':cr['sha256'],
        'scope':'diagnostic','benchmark':'wav','task_key':'wav:260','schedule_sha256':schedule['sha256'],
        'agent_input':actor_input,'evaluation_ref':binding['evaluation_ref'],'setup_ref':binding['setup_ref'],
        'setup_binding_sha256':digest(binding['setup_ref']),'model_binding':model}
    op['task_input_binding']={k:op[k] for k in ('task_key','benchmark','schedule_sha256')}
    op['task_input_binding'].update(agent_payload_sha256=digest(actor_input),evaluation_ref_sha256=digest(op['evaluation_ref']))
    store=Store(str(root/'ledger.sqlite'));store.enqueue([op]);lease=store.claim(lease_seconds=1800)
    op['lease_token']=lease['lease_token'];store.start(op['opportunity_id'],op['lease_token'])
    identity={k:op[k] for k in ('opportunity_id','environment_id','configuration_sha256','scope','lease_token')}
    identity['data_kind']='MEASURED'
    reset_input={**identity,'baseline_sha256':mr['sha256'],'setup_ref':op['setup_ref']}
    life=OwnedLifecycle(m,mr['sha256'],reset_input)
    report={'kind':'OFFICIAL_WAV_TASK_ACCEPTANCE_PROBE','task_id':260,'framework':a.framework,'mode':a.mode,
        'model':model,'confirmatory_authorized':False,'bulk_admitted':False,'full_state_isolation_proven':False,
        'official_task_started':False,'official_task_completed':False,'official_score':None,'engineering_error':None}
    guard=ProbeLeaseGuard(store.filename,op['opportunity_id'],op['lease_token'])
    try:
        guard.start()
        print(json.dumps({'stage':'fresh-official-fixture','mode':a.mode}),flush=True)
        reset=life.reset(reset_input);write_new(root/'reset-receipt.json',reset)
        payload={**identity,'input':materialize_actor_input(actor_input),'model_binding':model,
            'budget':configuration['budget'],'coordinate_space':a.coordinate_space,
            'observation_timeout_ms':a.observation_timeout_ms,
            'request_ledger':{'database':store.filename,'opportunityId':op['opportunity_id'],'leaseToken':op['lease_token'],'capMicroUsd':5000000},
            'cost_policy':{'request_reservation_micro_usd':200000}}
        script=persist(root/'task260-script.py',SCRIPT.encode()) if a.mode=='traditional' else None
        if script:write_new(root/'authoring-note.json',{'scope':'AI-assisted-diagnostic-only','human_blinded_baseline':False,
            'task_key':'wav:260','public_intent_only':True,'script_ref':script,'written_before_this_probe_outcomes':True})
        from playwright.sync_api import sync_playwright
        print(json.dumps({'stage':'official-task-actor','task_id':260,'mode':a.mode}),flush=True)
        report['task_browser_setup_attempted']=True
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            try:
                envelope=run_owned_session(browser,op,reset,mr['sha256'],{'__SHOPPING__':f'http://127.0.0.1:{a.port_base}'},
                    root/'trajectory',payload,a.framework,a.mode,shutil.which('node'),viewport=(1280,720),
                    lifecycle_limits=configuration['lifecycle_limits'],traditional_script_ref=script)
            finally:browser.close()
        actor=envelope['actor_result'];verify_lifecycle(envelope['actor_lifecycle_ref'],actor)
        # Persist evidence even if ledger finalization subsequently fails.
        write_new(root/'envelope.json',envelope)
        guard.stop()
        store.finish(op['opportunity_id'],op['lease_token'],actor)
        report.update(official_task_completed=True,actor_status=actor['terminal_status'],failure_class=actor['failure_class'],
                      provider_requests=actor['provider_requests'],actions=actor['action_count'],replay=audit(root/'trajectory'))
        source=Path(m['source_directory']);dataset=source/'assets/dataset/webarena-verified.json'
        envref=write_new(root/'native-config.json',{'test_data_file':str(dataset),
            'environments':{'__SHOPPING__':{'urls':[f'http://127.0.0.1:{a.port_base}']}}})
        evref=write_new(root/'native-manifest.json',{'schema':'pss-wav-native-evaluator-v1','scope':'diagnostic',
            'source_dir':str(source),'source_commit':m['source_commit'],'source_dataset_sha256':pinned_ref(dataset)['sha256'],
            'environment_config_ref':envref,'network_trace_root':str(root),'private_artifact_root':str(root/'native-private')})
        code=Path(__file__).resolve().parents[1]
        result=subprocess.run([str(code/'.venv-benchmark/bin/python'),str(Path(__file__).with_name('wav_native_evaluate.py')),
            '--manifest',evref['file'],'--manifest-sha256',evref['sha256']],
            input=json.dumps({**identity,**envelope,'evaluation_ref':binding['evaluation_ref']}),capture_output=True,text=True,timeout=120)
        if result.returncode:raise RuntimeError('Native evaluator unresolved; inspect private evidence')
        evaluated=json.loads(result.stdout);write_new(root/'native-receipt.json',evaluated)
        report.update(assessment_status=evaluated['assessment_status'],official_score=evaluated['native_score'])
    except Exception as exc:
        report['engineering_error']=type(exc).__name__
        persist(root/'private-error.txt',str(exc).encode())
        try:store.quarantine(op['opportunity_id'],op['lease_token'],'probe-engineering-error')
        except ValueError:report['ledger_reconciliation_required']=True
    finally:
        try:guard.stop()
        except Exception as exc:report['supervisor_error']=type(exc).__name__
        trajectory=root/'trajectory'/'trajectory.jsonl'
        if trajectory.exists():
            report['official_task_started']=any(json.loads(line).get('kind')=='actor-start' for line in trajectory.read_text().splitlines())
        try:write_new(root/'cleanup-receipt.json',life.cleanup());report['owned_cleanup_completed']=True
        except Exception as exc:report['cleanup_error']=type(exc).__name__
        report['ledger']=store.summary();store.close();write_new(root/'report.json',report)
    print(json.dumps(report),flush=True)
    if report['engineering_error']:raise SystemExit(2)


if __name__=='__main__':main()
