"""Synthetic type-tool/schema control. Zero official benchmark executions."""
import argparse
import json
import os
from pathlib import Path
import shutil
import secrets
from playwright.sync_api import sync_playwright
from journaled_browser import Journal
from runtime_store import Store,digest
from native_framework_driver import run_actor
from probe_lease_guard import ProbeLeaseGuard
from wav_owned_lifecycle import write_new


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',required=True);p.add_argument('--live',action='store_true');a=p.parse_args()
    if not a.live:print('No request: --live required');return
    root=Path(a.output).resolve();root.mkdir(mode=0o700,parents=True,exist_ok=False)
    os.environ.update(PSS_LOCAL_PROVIDER='aliyun',PSS_LOCAL_MODEL='qwen3.8-max',PSS_LOCAL_MAX_OUTPUT_TOKENS='2048')
    model={'provider':'aliyun','model':'qwen3.8-max'}
    op={'opportunity_id':root.name,'environment_id':'synthetic-type-'+secrets.token_hex(8),
        'configuration_sha256':digest({'model':model,'fixture':'type-canary-v1'}),
        'schedule_sha256':'synthetic-type-control-not-benchmark','scope':'synthetic','model_binding':model}
    store=Store(str(root/'ledger.sqlite'));store.enqueue([op]);lease=store.claim(lease_seconds=180);store.start(op['opportunity_id'],lease['lease_token'])
    guard=ProbeLeaseGuard(store.filename,op['opportunity_id'],lease['lease_token']).start()
    task={'intent':'Replace the text in the already focused Entry input with ORCHID-42, then finish. Do not click, submit, or navigate.','task_images':[]}
    payload={**op,'input':task,'coordinate_space':'css-pixels','budget':{'task_timeout_ms':60000,'max_actions':4},
        'request_ledger':{'database':store.filename,'opportunityId':op['opportunity_id'],'leaseToken':lease['lease_token'],'capMicroUsd':800000},
        'cost_policy':{'request_reservation_micro_usd':200000}}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True);context=browser.new_context(viewport={'width':800,'height':500})
            page=context.new_page()
            page.set_content('<body style="font:24px Arial;padding:40px"><h1>Typing control</h1><label for="entry">Entry</label><input id="entry" autofocus style="font:24px Arial;border:3px solid blue;margin:20px;padding:10px" value=""></body>')
            page.locator('#entry').focus()  # Declared synthetic precondition, not benchmark help.
            journal=Journal(root/'trajectory')
            actor=run_actor(context,page,payload,journal,'browser-use-restricted','hybrid',shutil.which('node'),viewport=(800,500))
            value_matches=page.locator('#entry').input_value()=='ORCHID-42'  # Post-actor oracle only.
            context.close();browser.close()
        guard.stop();store.finish(op['opportunity_id'],lease['lease_token'],actor)
        write_new(root/'report.json',{'kind':'SYNTHETIC_TYPE_TOOL_CONTROL','benchmark_executions':0,
            'model':model,'actor_status':actor['terminal_status'],'failure_class':actor['failure_class'],
            'actions':actor['action_count'],'provider_requests':actor['provider_requests'],
            'post_actor_input_matches':value_matches,'confirmatory_authorized':False})
        print(json.dumps({'synthetic_only':True,'input_matches':value_matches,'actor_status':actor['terminal_status']}))
    except Exception as exc:
        store.quarantine(op['opportunity_id'],lease['lease_token'],'synthetic-control-error')
        write_new(root/'report.json',{'kind':'SYNTHETIC_TYPE_TOOL_CONTROL','benchmark_executions':0,
            'engineering_error':type(exc).__name__,'confirmatory_authorized':False})
        raise
    finally:guard.stop();store.close()


if __name__=='__main__':main()
