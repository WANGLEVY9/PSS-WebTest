"""Opt-in Qwen/native-framework connectivity on a synthetic upload+popup fixture.

NOT official benchmark execution, NOT deployment admission, NOT a success-rate
estimate. Each invocation uses a new browser and local server state. Real network
requests go only to the preconfigured provider, bounded by one task budget.
"""
import argparse
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import secrets
import shutil
import threading
from PIL import Image
from playwright.sync_api import sync_playwright
from journaled_browser import Journal, sha
from native_framework_driver import run_actor
from runtime_store import Store


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--framework', choices=('agentlab-browsergym', 'browser-use-restricted'), required=True)
    p.add_argument('--mode', choices=('visual', 'hybrid'), required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--model', default='qwen3.8-max')
    p.add_argument('--coordinate-space',choices=('css-pixels','qwen-0-999'),default='css-pixels')
    p.add_argument('--max-output-tokens',type=int,default=1024)
    p.add_argument('--live', action='store_true')
    args = p.parse_args()
    if not args.live:
        print('No request made. --live permits a bounded synthetic native-framework test, never benchmark admission.'); return
    # All provider overrides are explicit and retain the configured Alibaba key.
    os.environ['PSS_LOCAL_PROVIDER'] = 'aliyun'
    os.environ['PSS_LOCAL_MODEL'] = args.model
    if not 1<=args.max_output_tokens<=4096:raise ValueError('Bounded diagnostic token limit required')
    os.environ['PSS_LOCAL_MAX_OUTPUT_TOKENS'] = str(args.max_output_tokens)
    # A local control must fail before allocating its journal/lease if the
    # shared tariff policy or durable spend ledger does not admit this model.
    # Never label a policy rejection as a provider/model transport failure.
    from wav_official_acceptance_probe import require_provider_budget
    require_provider_budget(args.model,args.max_output_tokens,30000)
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=False, mode=0o700)
    model = {'provider':'aliyun', 'model':args.model}
    database = output/'ledger.sqlite'
    store = Store(str(database))
    op = {'opportunity_id':secrets.token_hex(16), 'environment_id':'synthetic-isolated-'+secrets.token_hex(8),
          'schedule_sha256':'synthetic-not-benchmark', 'configuration_sha256':sha(json.dumps([model,args.framework,args.mode,args.coordinate_space,args.max_output_tokens]).encode()),
          'scope':'synthetic', 'model_binding':model}
    store.enqueue([op]); claimed=store.claim(lease_seconds=180); store.start(op['opportunity_id'],claimed['lease_token'])
    image = io.BytesIO(); Image.new('RGB',(80,80),(24,99,140)).save(image,format='PNG')
    asset=image.getvalue(); code=secrets.token_hex(3).upper(); uploaded=[]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def do_GET(self):
            if self.path=='/review':
                html=f'<h1>Review</h1><p>Image received: {"YES" if uploaded and uploaded[-1]==asset else "NO"}</p><p>Confirmation code: <b>{code}</b></p>'
            else:
                html='''<h1>Image upload workspace</h1><p>1. Attach the public task image.</p>
                <input type="file" id="upload" style="font-size:20px" onchange="fetch('/upload',{method:'POST',body:this.files[0]}).then(()=>document.querySelector('#status').textContent='Upload complete')">
                <p id="status">No image uploaded</p><p>2. Open the review page.</p>
                <button style="font-size:22px;padding:15px" onclick="window.open('/review','_blank')">Open review tab</button>
                <p style="display:none">FORBIDDEN_HIDDEN_SENTINEL</p>'''
            self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers()
            self.wfile.write(('<body style="margin:40px;font:22px Arial;background:#fafafa">'+html+'</body>').encode())
        def do_POST(self):
            uploaded.append(self.rfile.read(int(self.headers['Content-Length'])))
            self.send_response(200);self.end_headers();self.wfile.write(b'OK')
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    task={'intent':'Upload the supplied public task image. Then open the review tab and return its confirmation code. Finish only after observing Image received: YES on the review page.',
          'task_images':[{'sha256':sha(asset),'image_url':'data:image/png;base64,'+base64.b64encode(asset).decode()}]}
    payload={**op,'input':task,'coordinate_space':args.coordinate_space,'budget':{'task_timeout_ms':150000,'max_actions':10},
             'request_ledger':{'database':str(database),'opportunityId':op['opportunity_id'],'leaseToken':claimed['lease_token'],'capMicroUsd':2000000},
             'cost_policy':{'request_reservation_micro_usd':200000}}
    result=None
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            context=browser.new_context(viewport={'width':1000,'height':700},device_scale_factor=1,
                                        record_har_path=str(output/'network.har'),record_har_content='embed')
            # Fixture browser traffic is loopback-only; LLM transport is separate.
            origin=f'http://127.0.0.1:{server.server_port}'
            context.route('**/*',lambda r: r.continue_() if r.request.url.startswith(origin+'/') else r.abort())
            page=context.new_page();page.goto(origin+'/')
            journal=Journal(output/'trajectory')
            result=run_actor(context,page,payload,journal,args.framework,args.mode,shutil.which('node'),viewport=(1000,700))
            pages_opened=len(context.pages)
            context.close();browser.close()
        store.finish(op['opportunity_id'],claimed['lease_token'],result)
        report={'kind':'SYNTHETIC_LIVE_FRAMEWORK_SMOKE', 'data_kind':'SYNTHETIC_TASK_REAL_PROVIDER',
                'framework':args.framework,'mode':args.mode,'model':args.model,
                'coordinate_space':args.coordinate_space,
                'max_output_tokens':args.max_output_tokens,
                'benchmark_executions':0,'confirmatory_authorized':False,'benchmark_adapter_admitted':False,
                'terminal_status':result['terminal_status'],'failure_class':result['failure_class'],
                'action_count':result['action_count'],'provider_requests':result['provider_requests'],
                'upload_bytes_match':bool(uploaded and uploaded[-1]==asset), 'pages_opened':pages_opened,
                'answer_matches_fixture':code in (result['final_answer'] or ''),'budget_met':result['budget_met'],
                'ledger':store.summary()}
        report['passed']=report['terminal_status']=='completed' and report['budget_met'] and report['upload_bytes_match'] and report['pages_opened']==2 and report['answer_matches_fixture']
        (output/'report.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report))
        if not report['passed']:raise SystemExit(2)
    finally:
        server.shutdown();server.server_close();store.close()


if __name__=='__main__': main()
