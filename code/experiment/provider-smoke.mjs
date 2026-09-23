// Opt-in, two paid image requests at most; synthetic image only, never benchmark gold.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {loadRuntimeEnv} from './runtime-env.mjs';
import {resolveProvider,publicProvider,buildProviderRequest,callProvider} from './provider.mjs';
import {modelMessages,parseDecision} from './agent-protocol.mjs';
if(!process.argv.includes('--live')) {
  console.log('No API call made. Use --live to authorize up to two synthetic vision requests. This never admits benchmark execution.');
} else {
  const config=resolveProvider(loadRuntimeEnv());
  const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const dir=path.join(code,'artifacts/local-runtime',`provider-smoke-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const report={kind:'SYNTHETIC_PROVIDER_SMOKE',started_at:new Date().toISOString(),provider:publicProvider(config),
    confirmatory_authorized:false,benchmark_executions:0,maximum_requests:2,results:[],passed:false};
  const save=()=>fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  let browser;
  try {
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    await page.route('**/*',route=>route.abort());
    const visibleToken=crypto.randomBytes(3).toString('hex').toUpperCase();
    await page.setContent(`<body style="font:40px sans-serif;padding:80px;background:#fafafa"><h1>Vision connection check</h1><p>Read the token: <strong>${visibleToken}</strong></p><button>Continue</button></body>`);
    const image=await page.screenshot({type:'png'});
    fs.writeFileSync(path.join(dir,'synthetic.png'),image,{mode:0o600});
    report.image_sha256=crypto.createHash('sha256').update(image).digest('hex');
    for(const arm of ['visual','hybrid']) {
      const controls=arm==='hybrid'?[{target_id:'o0-c0',role:'button',name:'Continue'}]:[];
      const prompt='This is a synthetic API contract check, not a benchmark task. Read the token printed in the screenshot. Return exactly one JSON OBJECT (not an array, not a list of actions), with action="done" and answer=[the exact token].'+
        (arm==='hybrid'?` Visible controls: ${JSON.stringify(controls)}`:'');
      const body=buildProviderRequest(config,{arm,controls,messages:modelMessages(prompt,[],`data:image/png;base64,${image.toString('base64')}`)});
      const response=await callProvider(config,body,{timeoutMs:45000});
      // Private diagnostic evidence, never copied into the public smoke summary.
      if(typeof response.output==='string') fs.writeFileSync(path.join(dir,`${arm}-output.txt`),response.output,{mode:0o600});
      const row={arm,...response,request_sha256:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'),contract_valid:false,image_read_correct:false};
      if(!response.failure_class) {
        try {const decision=parseDecision(response.output,{arm,controls});row.contract_valid=true;row.image_read_correct=decision.action==='done' && JSON.stringify(decision.answer)===JSON.stringify([visibleToken]);}
        catch {row.failure_class='model-output-contract';}
      }
      // Do not echo any model output in terminal/public summaries.
      delete row.output;report.results.push(row);save();
      if(['provider-auth','provider-rate-limit','provider-http','provider-service','provider-network','provider-timeout'].includes(row.failure_class)) break;
    }
    report.passed=report.results.length===2 && report.results.every(r=>r.contract_valid && r.image_read_correct);
  } catch {report.error='Synthetic smoke setup failed; inspect local browser/runtime prerequisites';}
  finally {
    await browser?.close();report.finished_at=new Date().toISOString();save();
    console.log(JSON.stringify(report,null,2));
    if(!report.passed)process.exitCode=2;
  }
}
