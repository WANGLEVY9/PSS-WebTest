"""Portable binding/fencing tests. No model, browser, reset or task execution."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from benchmark_session_wrapper import SUPERVISOR_SOURCES, validate_request
from runtime_store import Store,digest


def ref(path):
    return {'file':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}


def fixture(root,routes=None):
    lab=Path(__file__).resolve().parent
    path=root/'wrapper.json'
    path.write_text(json.dumps({'schema':'pss-owned-session-wrapper-v1',
        'supervisor_source_refs':{name:ref(lab/name) for name in SUPERVISOR_SOURCES},
        'artifact_root':str(root/'runs'),'routes':routes or {'__SHOPPING__':'http://127.0.0.1:12345'}}))
    manifest_ref=ref(path);source=lab/'benchmark_session_wrapper.py'
    command={**{'source':str(source),'sha256':ref(source)['sha256'],'timeout_ms':50000},
        'argv':[sys.executable,str(source),'--manifest',str(path),'--manifest-sha256',manifest_ref['sha256']]}
    script=root/'reviewed.py';script.write_text("def run(session,task):\n    return session.locator('h1').inner_text()\n")
    binding={'framework':'playwright','mode':'traditional','framework_revision':'synthetic-test',
        'actor_protocol':'owned-session-v1','configuration_sha256':'a'*64,
        'boundary_audit_sha256':'d'*64,'baseline_sha256':'b'*64,'environment_id':'env','model_binding':None,
        'budget':{'task_timeout_ms':10000,'max_actions':3},'sdk_max_retries':0,
        'timing_policy':'actor-phase-monotonic-v1',
        'lifecycle_limits':{'setup_ms':10000,'evaluation_ms':10000,'finalization_ms':10000,'transport_ms':10000},
        'commands':{stage:command for stage in ('reset','actor','evaluate','cleanup')},
        'traditional_script_ref':ref(script)}
    setup=root/'setup.json';setup.write_text(json.dumps({'sites':['shopping'],
        'start_urls':['__SHOPPING__/start'],'require_login':False}))
    proof=root/'reset.json';proof.write_text('{"data_kind":"SYNTHETIC_TEST"}')
    op={'opportunity_id':'op','environment_id':'env','scope':'synthetic','configuration_sha256':'a'*64,
        'schedule_sha256':'c'*64,'runtime_binding_sha256':digest(binding),'model_binding':None,
        'benchmark':'wav','agent_input':{'benchmark':'wav','intent':'SYNTHETIC CONTROL','task_images':[]},
        'setup_ref':ref(setup),'setup_binding_sha256':digest(ref(setup)), 'evaluation_ref':ref(proof)}
    # A real worker now requires the frozen v3 identity even for synthetic controls.
    from runtime_identity import sha, array_hash
    binding['config_id']='s'
    actor_file=root/'actor-input.json';actor_file.write_text(json.dumps(op['agent_input']))
    original=root/'source.json';original.write_text('SYNTHETIC_TEST')
    task={'task_key':'wav:synthetic-wrapper','benchmark':'wav','official_task_id':'synthetic',
        'application':'synthetic','template_id':'synthetic','source_sha256':sha(original.read_bytes()),
        'agent_input_sha256':sha(actor_file.read_bytes()),'evaluation_sha256':op['evaluation_ref']['sha256'],
        'evaluation_ref_sha256':digest(op['evaluation_ref']),'setup_ref_sha256':digest(op['setup_ref'])}
    raw=json.dumps(task,ensure_ascii=False,separators=(',',':'))
    op.update(task_key=task['task_key'],config_id='s',round='D1',phase='discovery',
        protocol_id='pss-manuscript-v2.1',identity_schema='task-bound-opportunity-v1',
        task_manifest_json=raw,task_manifest_sha256=sha(raw.encode()),
        executor_binding_sha256=digest(binding),runtime_binding_sha256=digest(binding),
        agent_input_json=actor_file.read_text(),source_file=str(original.resolve()),
        evaluation_file=str(proof.resolve()),cost_policy=None)
    op['opportunity_id']=array_hash([op['schedule_sha256'],op['task_manifest_sha256'],
        op['executor_binding_sha256'],op['task_key'],op['config_id'],op['round']])
    store=Store(str(root/'ledger.sqlite'));store.enqueue([op]);op=store.claim()
    store.start(op['opportunity_id'],op['lease_token'])
    base={k:op[k] for k in ('opportunity_id','environment_id','configuration_sha256','scope','lease_token','task_manifest_sha256')}
    base['data_kind']='SYNTHETIC_TEST'
    reset={**base,'restored':True,'baseline_sha256':'b'*64,'closure_sites':['shopping'],'reset_evidence_ref':ref(proof)}
    payload={**base,'input':op['agent_input'],'coordinate_space':'css-pixels','model_binding':None,
        'budget':binding['budget'],'cost_policy':None,'request_ledger':{'database':store.filename,
        'opportunityId':op['opportunity_id'],'leaseToken':op['lease_token'],'capMicroUsd':None}}
    store.event(op['opportunity_id'],'owned-session-reset',{'lease_token':op['lease_token'],'reset_sha256':digest(reset)})
    request={'schema':'pss-owned-session-request-v1','actor_payload':payload,'binding':binding,'reset_receipt':reset}
    return store,request,manifest_ref


class WrapperTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.store,self.request,self.ref=fixture(Path(self.tmp.name))
        self.addCleanup(self.store.close)

    def test_exact_running_ledger_projection_accepted(self):
        _,_,_,payload,_=validate_request(self.request,self.ref)
        self.assertEqual(payload,self.request['actor_payload'])
        self.assertNotIn('reset_receipt',payload);self.assertNotIn('evaluation_ref',payload)

    def test_frozen_budget_model_or_configuration_drift_rejected(self):
        for key,value in (('budget',{'max_actions':999}),('model_binding',{'model':'OTHER'}),('configuration_sha256','x'*64)):
            request=copy.deepcopy(self.request);request['binding'][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):validate_request(request,self.ref)

    def test_added_private_actor_input_or_changed_task_rejected(self):
        for key,value in (('evaluation_ref',{'gold':True}),('input',{'intent':'NEW TASK'})):
            request=copy.deepcopy(self.request);request['actor_payload'][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):validate_request(request,self.ref)

    def test_reset_from_other_lease_or_unrecorded_reset_rejected(self):
        for key,value in (('lease_token','OLD'),('restored',False),('baseline_sha256','x'*64)):
            request=copy.deepcopy(self.request);request['reset_receipt'][key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):validate_request(request,self.ref)

    def test_expired_or_terminal_lease_rejected(self):
        self.store.db.execute('UPDATE opportunities SET lease=0')
        with self.assertRaises(ValueError):validate_request(self.request,self.ref)

    def test_unknown_top_level_input_rejected(self):
        with self.assertRaises(ValueError):validate_request({**self.request,'secret':'NO'},self.ref)


if __name__=='__main__':unittest.main()
