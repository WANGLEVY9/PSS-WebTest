import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spendGuard} from '../../experiment/spend-guard.mjs';
test('native CNY tariff preserves monetary units and unknown-charge hold',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pss-cny-test-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const policy=JSON.parse(fs.readFileSync(new URL('../../config/spend-policy.json',import.meta.url)));
 const c={provider:'aliyun',model:'SYNTHETIC_TEST',api:'chat-completions',base_url:'https://test.aliyuncs.com/v1'};
 policy.rates=[{...c,currency:'CNY',input_cny_per_million:12,cached_input_cny_per_million:1.5,output_cny_per_million:36,
 max_input_tokens:991808,max_output_tokens:2048,source:'SYNTHETIC_TEST',verified_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()}];
 const file=path.join(dir,'policy.json');fs.writeFileSync(file,JSON.stringify(policy));
 const guard=spendGuard({PSS_SPEND_POLICY_FILE:file,PSS_SPEND_DB:path.join(dir,'ledger.sqlite')});
 const body={model:c.model,messages:[],max_tokens:2048};
 const r=guard.reserve(c,body,'test');
 assert.equal(r.maximum_micro_cny,11975424);
 assert.equal(r.settle({model_returned:c.model,usage:{input_tokens:1000,cached_input_tokens:0,output_tokens:100}}).charge_micro_cny,15600);
 const unknown=guard.reserve(c,body,'test');unknown.settle({failure_class:'provider-timeout'});
 assert.equal(guard.status(c).held_micro_cny,11975424);
 assert.throws(()=>guard.reserve(c,body,'test'),/task-cap/);
});
