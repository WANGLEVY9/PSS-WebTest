"""Sequential, fail-closed 14-run official WAV acceptance batch; not confirmatory.

Two public navigation tasks, two explicitly bound models, three agent profiles
and one shared Traditional execution per task. No retry, no task substitution.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

MODELS=('qwen3.8-max','qwen3.8-flash')
PROFILES=(('agentlab-browsergym','visual'),('agentlab-browsergym','hybrid'),
          ('browser-use-restricted','hybrid'))

def jobs():
    out=[]
    for task in (260,274):
        out.append({'task_id':task,'framework':'playwright','mode':'traditional','model':None})
        for model in MODELS:
            for framework,mode in PROFILES:
                out.append({'task_id':task,'framework':framework,'mode':mode,'model':model})
    return out

def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()

def source_fingerprint(code):
    files=sorted((code/'local-lab').glob('*.py'))+sorted((code/'local-lab').glob('*.mjs'))
    return hashlib.sha256(json.dumps([(p.name,sha(p)) for p in files]).encode()).hexdigest()

def issue(report,returncode):
    if returncode or report.get('engineering_error') or report.get('cleanup_error'):
        return 'engineering-or-process-error'
    if not report.get('owned_cleanup_completed') or report.get('assessment_status')!='valid':
        return 'cleanup-or-native-evaluation-unverified'
    failure=report.get('failure_class')
    if failure and (failure.startswith('provider-') or failure in ('actuator-error','observation-error')):
        return failure
    # Native score zero is not itself an engineering issue and must not be dropped.
    return None

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for key in ('manifest','peer-proof','bindings','spend-policy','output'):p.add_argument('--'+key,required=True)
    p.add_argument('--port-base',type=int,default=18500)
    p.add_argument('--start-index',type=int,default=0)
    p.add_argument('--stop-index',type=int,default=14)
    p.add_argument('--live',action='store_true')
    a=p.parse_args();code=Path(__file__).resolve().parents[1];repo=code.parent
    if os.environ.get('PSS_LOCAL_ENV_FILE'):raise ValueError('Legacy isolated env override not admitted in this diagnostic probe')
    if not 1024<=a.port_base<=65000:raise ValueError('Invalid reserved ports')
    if not 0<=a.start_index<=a.stop_index<=14:raise ValueError('Invalid job slice')
    refs={k:{'file':str(Path(getattr(a,k.replace('-','_'))).resolve()),'sha256':sha(getattr(a,k.replace('-','_')))}
          for k in ('manifest','peer-proof','bindings','spend-policy')}
    root=Path(a.output).resolve();root.mkdir(parents=True,exist_ok=False,mode=0o700)
    fingerprint=source_fingerprint(code)
    plan={'schema':'pss-qwen38-paired-acceptance-v1','scope':'diagnostic',
          'created_at':datetime.now(timezone.utc).isoformat(),'tasks':[260,274],
          'jobs':jobs(),'planned_executions':14,'distinct_official_tasks':2,
          'traditional_shared':True,'confirmatory_authorized':False,'bulk_admitted':False,
          'source_sha256':fingerprint,'inputs':refs,'stop_on_external_or_engineering_failure':True}
    (root/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
    if not a.live:print(json.dumps({'status':'planned-not-run','plan':str(root/'plan.json')}));return
    env=dict(os.environ,PSS_SPEND_POLICY_FILE=refs['spend-policy']['file'])
    preflight="""import {loadRuntimeEnv} from './local-lab/runtime-env.mjs';
import {resolveProvider} from './local-lab/provider.mjs';
import {spendGuard} from './local-lab/spend-guard.mjs';
const e=loadRuntimeEnv();const g=spendGuard(e);
for(const m of ['qwen3.8-max','qwen3.8-flash']) {
 const c=resolveProvider({...e,PSS_LOCAL_PROVIDER:'aliyun',PSS_LOCAL_MODEL:m});
 const s=g.status(c);if(!s.ready)throw Error(s.pricing_error||'Shared spend guard not ready');
}
console.log('Provider configuration and shared pricing ready; no network calls');"""
    pre=subprocess.run(['node','--input-type=module','-e',preflight],cwd=code,env=env,capture_output=True,text=True)
    (root/'preflight.log').write_text(pre.stdout+pre.stderr)
    if pre.returncode:raise SystemExit('Preflight blocked; no benchmark started')
    # Do not spend another container startup just to discover a missing native
    # framework import. This is a deployment gate, not an agent outcome.
    for framework in ('agentlab-browsergym','browser-use-restricted'):
        executable=repo/'third_party/frameworks'/('h-browser-use' if framework=='browser-use-restricted' else 'h-agentlab')/'bin/python'
        module='browser_use' if framework=='browser-use-restricted' else 'playwright'
        probe=subprocess.run([str(executable),'-c',f'import {module}; print({module}.__file__)'],cwd=repo,env=env,capture_output=True,text=True)
        (root/f'preflight-{framework}.log').write_text(probe.stdout+probe.stderr)
        if probe.returncode:
            raise SystemExit(f'{framework} dependency preflight blocked: import {module}')
    completed=[];blocked=None
    for index,job in enumerate(plan['jobs']):
        if index<a.start_index or index>=a.stop_index: continue
        if source_fingerprint(code)!=fingerprint or any(sha(ref['file'])!=ref['sha256'] for ref in refs.values()):
            blocked='frozen-input-or-source-drift';break
        python=repo/'third_party/frameworks'/('h-browser-use' if job['framework']=='browser-use-restricted' else 'h-agentlab')/'bin/python'
        out=root/f'{index:02d}-{job["model"] or "shared"}-{job["task_id"]}-{job["framework"]}-{job["mode"]}'
        cmd=[str(python),str(code/'local-lab/wav_official_acceptance_probe.py'),
             '--framework',job['framework'],'--mode',job['mode'],'--task-id',str(job['task_id']),
             '--manifest',refs['manifest']['file'],'--manifest-sha256',refs['manifest']['sha256'],
             '--peer-proof',refs['peer-proof']['file'],'--peer-proof-sha256',refs['peer-proof']['sha256'],
             '--bindings',refs['bindings']['file'],'--output',str(out),
             '--port-base',str(a.port_base+index*2),'--coordinate-space','qwen-0-999','--live']
        if job['model']:cmd+=['--model',job['model']]
        print(json.dumps({'stage':'dispatch','index':index,**job}),flush=True)
        with (root/f'{index:02d}-process.log').open('x') as log:
            run=subprocess.run(cmd,cwd=repo,env=env,stdout=log,stderr=subprocess.STDOUT)
        report_file=out/'report.json'
        report=json.loads(report_file.read_text()) if report_file.exists() else {}
        blocked=issue(report,run.returncode)
        row={**job,'index':index,'returncode':run.returncode,'report_file':str(report_file),
             'report_sha256':sha(report_file) if report_file.exists() else None,
             'official_task_started':report.get('official_task_started',False),
             'official_score':report.get('official_score'),'failure_class':report.get('failure_class'),
             'engineering_error':report.get('engineering_error'),'batch_stop_reason':blocked}
        completed.append(row)
        with (root/'events.jsonl').open('a') as log:log.write(json.dumps(row)+'\n');log.flush();os.fsync(log.fileno())
        print(json.dumps(row),flush=True)
        if blocked:break
    summary={'scope':'diagnostic','confirmatory_authorized':False,'planned_executions':14,
             'completed_processes':len(completed),'unstarted':14-len(completed),
             'official_actor_starts':sum(r['official_task_started'] for r in completed),
             'status':'blocked' if blocked else 'batch-finished','stop_reason':blocked,'rows':completed}
    (root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps({k:v for k,v in summary.items() if k!='rows'}),flush=True)
    if blocked:raise SystemExit(2)

if __name__=='__main__':main()
