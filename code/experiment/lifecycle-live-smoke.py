"""Opt-in real-provider/Traditional lifecycle control on a synthetic local fixture.

This is NOT an official benchmark task, fixture admission or comparative result.
Each process owns a fresh server/context/ledger; no benchmark gate is modified.
The oracle executes only after actor-end and is never delivered to the actor.
"""
import argparse
import contextlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import secrets
import shutil
import threading
from benchmark_actor_lifecycle import run_owned_session, verify_lifecycle, persist, encoded, pinned_ref
from runtime_inputs import materialize_actor_input
from runtime_store import Store, digest
from replay_audit import audit

INTENT='Upload the supplied public task image. Then open the review tab and return its confirmation code. Finish only after observing Image received: YES on the review page.'
SCRIPT="""def run(session, public_task):
    session.locator('input[type=file]').upload('task-image-0')
    session.get_by_role('button', name='Open review tab', exact=True).click()
    return session.locator('b').inner_text()
"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--framework',required=True,choices=['agentlab-browsergym','browser-use-restricted','playwright'])
    parser.add_argument('--mode',required=True,choices=['visual','hybrid','traditional'])
    parser.add_argument('--model',default='qwen3.8-max')
    parser.add_argument('--coordinate-space',choices=['css-pixels','qwen-0-999'],default='qwen-0-999')
    parser.add_argument('--max-output-tokens',type=int,default=1024)
    parser.add_argument('--output',required=True)
    parser.add_argument('--live',action='store_true')
    args=parser.parse_args()
    if not args.live:
        print('No execution: --live is required. This is synthetic engineering evidence, never benchmark admission.')
        return
    if ((args.framework=='playwright')!=(args.mode=='traditional')
        or args.framework=='browser-use-restricted' and args.mode!='hybrid'):
        raise ValueError('Explicit compatible framework/mode required')
    from PIL import Image
    from playwright.sync_api import sync_playwright
    if not 1<=args.max_output_tokens<=4096:raise ValueError('Bounded diagnostic token limit required')
    os.environ.update(PSS_LOCAL_PROVIDER='aliyun',PSS_LOCAL_MODEL=args.model,PSS_LOCAL_MAX_OUTPUT_TOKENS=str(args.max_output_tokens))
    # A separate explicit env file would override the model above. Never run it
    # under a different model while labelling the output as the requested Qwen.
    if os.environ.get('PSS_LOCAL_ENV_FILE'):
        raise ValueError('This control requires default configured Aliyun credentials; explicit env override refused')
    root=Path(args.output).resolve();root.mkdir(parents=True,mode=0o700,exist_ok=False)
    persist(root/'runner-source.py',Path(__file__).read_bytes())
    buffer=io.BytesIO();Image.new('RGB',(80,80),(24,99,140)).save(buffer,format='PNG')
    asset=buffer.getvalue();asset_ref=persist(root/'task-image.png',asset)
    code=secrets.token_hex(3).upper();uploaded=[]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):
            if self.path=='/review':
                content=f'<h1>Review</h1><p>Image received: {"YES" if uploaded and uploaded[-1]==asset else "NO"}</p><p>Confirmation code: <b>{code}</b></p>'
            else:
                content='''<h1>Image upload workspace</h1><p>1. Attach the public task image.</p>
                <input type="file" style="font-size:20px" onchange="fetch('/upload',{method:'POST',body:this.files[0]}).then(()=>document.querySelector('#status').textContent='Upload complete')">
                <p id="status">No image uploaded</p><p>2. Open the review page.</p>
                <button style="font-size:22px;padding:15px" onclick="window.open('/review','_blank')">Open review tab</button>
                <p style="display:none">FORBIDDEN_HIDDEN_SENTINEL</p>'''
            self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers()
            self.wfile.write(('<body style="margin:40px;font:22px Arial;background:#fafafa">'+content+'</body>').encode())
        def do_POST(self):
            uploaded.append(self.rfile.read(int(self.headers['Content-Length'])))
            self.send_response(200);self.end_headers();self.wfile.write(b'OK')
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    origin=f'http://127.0.0.1:{server.server_port}'
    setup=persist(root/'setup.json',encoded({'sites':['synthetic'],'start_urls':['__SYNTHETIC__/'],
                                           'require_login':False,'geolocation':None}))
    proof=persist(root/'fixture-start.json',encoded({'data_kind':'SYNTHETIC_TEST','fresh_process':True,
            'initial_uploaded_objects':len(uploaded),'fixture_source_ref':pinned_ref(root/'runner-source.py')}))
    model=None if args.framework=='playwright' else {'provider':'aliyun','model':args.model}
    budget={'task_timeout_ms':150000,'max_actions':10}
    limits={'setup_ms':30000,'evaluation_ms':30000,'finalization_ms':30000,'transport_ms':30000}
    task={'intent':INTENT,'task_images':[{**asset_ref,'mime_type':'image/png'}]}
    op={'opportunity_id':secrets.token_hex(16),'environment_id':'synthetic-'+secrets.token_hex(8),
        'configuration_sha256':digest({'framework':args.framework,'mode':args.mode,'model':model,'budget':budget,
            'coordinate_space':args.coordinate_space,'max_output_tokens':args.max_output_tokens,
            'lifecycle_limits':limits,'runner_source_sha256':pinned_ref(root/'runner-source.py')['sha256']}),
        'scope':'synthetic','schedule_sha256':'synthetic-component-control','model_binding':model,
        'agent_input':task,'setup_ref':setup,'setup_binding_sha256':digest(setup)}
    store=Store(str(root/'ledger.sqlite'));store.enqueue([op]);lease=store.claim(lease_seconds=300)
    store.start(op['opportunity_id'],lease['lease_token']);op['lease_token']=lease['lease_token']
    identity={k:op[k] for k in ('opportunity_id','environment_id','configuration_sha256','scope','lease_token')}
    identity['data_kind']='SYNTHETIC_TEST'
    reset={**identity,'restored':True,'baseline_sha256':proof['sha256'],'closure_sites':['synthetic'],'reset_evidence_ref':proof}
    payload={**identity,'model_binding':model,'input':materialize_actor_input(task),'coordinate_space':args.coordinate_space,
        'budget':budget,'request_ledger':{'database':store.filename,'opportunityId':op['opportunity_id'],
            'leaseToken':lease['lease_token'],'capMicroUsd':2000000},
        'cost_policy':{'request_reservation_micro_usd':200000}}
    script_ref=persist(root/'synthetic-script.py',SCRIPT.encode()) if args.framework=='playwright' else None
    checks={}
    def evaluate(actor,page):
        # Supervisor-only post-termination checks, not model feedback or progress.
        checks.update(upload_bytes_match=bool(uploaded and uploaded[-1]==asset),
            pages_opened=len(page.context.pages),answer_matches_fixture=code in (actor.get('final_answer') or ''))
        passed=checks['upload_bytes_match'] and checks['pages_opened']==2 and checks['answer_matches_fixture']
        return {**identity,'schema':'pss-synthetic-fixture-oracle-v1','checks':checks,
            'assessment_status':'valid','native_score':int(passed),'verdict':None,
            'trajectory_ref':pinned_ref(root/'trajectory'/'trajectory.jsonl'),'confirmatory_authorized':False}
    report={'kind':'SYNTHETIC_LIVE_LIFECYCLE_CONTROL','data_kind':'SYNTHETIC_TASK_REAL_EXECUTION',
        'framework':args.framework,'mode':args.mode,'model':model,'budget':budget,'lifecycle_limits':limits,
        'coordinate_space':args.coordinate_space,'max_output_tokens':args.max_output_tokens,
        'benchmark_executions':0,'benchmark_adapter_admitted':False,'confirmatory_authorized':False,'passed':False}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            class LoopbackBrowser:
                def new_context(self,**kwargs):
                    context=browser.new_context(**kwargs)
                    context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(origin+'/') else route.abort())
                    return context
            try:
                result=run_owned_session(LoopbackBrowser(),op,reset,proof['sha256'],{'__SYNTHETIC__':origin},
                    root/'trajectory',payload,args.framework,args.mode,shutil.which('node'),viewport=(1000,700),
                    native_evaluator=evaluate,lifecycle_limits=limits,traditional_script_ref=script_ref)
            finally:browser.close()
        actor=result['actor_result'];seal=verify_lifecycle(result['actor_lifecycle_ref'],actor)
        replay=audit(root/'trajectory')
        store.finish(op['opportunity_id'],lease['lease_token'],actor)
        persist(root/'envelope.json',encoded(result))
        report.update({k:actor[k] for k in ('terminal_status','failure_class','action_count','provider_requests','budget_met','elapsed_ms')})
        report.update(checks=checks,replay=replay,actor_lifecycle_ref=result['actor_lifecycle_ref'],
            lifecycle_timing=seal['lifecycle_timing'],ledger=store.summary())
        report['passed']=(actor['terminal_status']=='completed' and actor['budget_met'] and replay['passed']
            and checks.get('upload_bytes_match') is True and checks.get('pages_opened')==2 and checks.get('answer_matches_fixture') is True)
    except Exception as exc:
        report.update(error_type=type(exc).__name__,failure_attribution='engineering-or-external-unresolved')
        try:store.quarantine(op['opportunity_id'],lease['lease_token'],report)
        except Exception:pass
    finally:
        persist(root/'report.json',encoded(report))
        server.shutdown();server.server_close();thread.join(timeout=2);store.close()
    print(json.dumps({k:v for k,v in report.items() if k not in ('actor_lifecycle_ref','lifecycle_timing')}))
    if not report['passed']:raise SystemExit(2)


if __name__=='__main__':main()
