"""Artificial evidence fixtures test rejection logic, not actual admission."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
import sys
from acceptance_coverage import audit, FRAMEWORK_SOURCES
from benchmark_acceptance import BENCHMARKS, PROFILES
from prepare_acceptance_cohort import select_tasks
from prepare_official_runtime import save
from runtime_store import digest
from journaled_browser import Journal
from replay_audit import audit as audit_replay
from lifecycle_timing import POLICY,window


class CoverageTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.counter=0
        self.source=self.ref({'kind':'SYNTHETIC_TEST'})
        self.tasks=[];self.bindings={}
        for b in BENCHMARKS:
            rows={}
            for i in range(20):
                key=f'{b}:{i}'
                actor={'schema':'pss-official-task-input-v1','benchmark':b,'intent':'SYNTHETIC_TEST','task_images':[]}
                if b=='ata':actor['steps']=[{'step':1,'action':'Do it','expectedResult':'Observed'}]
                ar=self.ref(actor)
                identity={'benchmark':b,'official_task_id':str(i),'application':'fixture','source_sha256':self.source['sha256']}
                er=self.ref({**identity,'expected':'PASS' if i%2 else 'FAIL'})
                row={**identity,'source_file':self.source['file'],'agent_input_file':ar['file'],
                     'agent_input_sha256':ar['sha256'],'evaluation_ref':er}
                if b!='ata':row['setup_ref']=self.ref({'start_urls':['http://fixture']})
                rows[key]=row
            self.bindings[b]={'tasks':rows}
            self.tasks+=select_tasks(self.bindings[b],b,'unit-fixture')
        self.manifest={'schema':'pss-development-cohort-v1','protocol_id':'pss-manuscript-v2.1',
            'scope':'diagnostic','campaign_id':'unit-fixture','profiles':list(PROFILES),'tasks':self.tasks}
        self.package={'schema':'pss-development-coverage-v1','manifest_ref':self.ref(self.manifest),
            'host_id':'unit-host','candidate_version':'unit-version','execution_receipts':[]}

    def ref(self,value):
        self.counter+=1;p=self.root/f'{self.counter}.json';h=save(p,value)
        return {'file':str(p),'sha256':h}

    def test_empty_cohort_reports_all_360_missing_not_vacuous_pass(self):
        r=audit(self.package)
        self.assertEqual(r['required_executions'],360)
        self.assertEqual(r['evidence_ready_executions'],0)
        self.assertFalse(r['delivery_evidence_ready'])

    def test_selection_deterministic_without_outcome_files(self):
        a=select_tasks(self.bindings['ata'],'ata','unit-fixture')
        b=select_tasks(self.bindings['ata'],'ata','unit-fixture')
        self.assertEqual(a,b)
        self.assertEqual(sum(t['stage']==2 for t in a),2)
        self.assertEqual(sum(t['stage']<=10 for t in a),10)
        self.assertEqual(sum(t['stability_repeat'] for t in a),5)

    def test_duplicate_execution_never_selects_best_attempt(self):
        t=self.tasks[0]
        r={'task_key':t['task_key'],'profile':'playwright','repetition':'A1','opportunity_id':'one'}
        self.package['execution_receipts']=[self.ref(r),self.ref(r)]
        with self.assertRaisesRegex(ValueError,'duplicate'):audit(self.package)

    def test_binding_and_file_drift_are_rejected(self):
        self.manifest['tasks'][0]['binding']['agent_input_sha256']='0'*64
        self.package['manifest_ref']=self.ref(self.manifest)
        with self.assertRaises(ValueError):audit(self.package)

    def test_incomplete_wrong_host_receipt_does_not_count(self):
        t=self.tasks[0]
        r={'task_key':t['task_key'],'profile':'playwright','repetition':'A1','opportunity_id':'one',
           'host_id':'wrong','result':{'lifecycle_completed':True}}
        self.package['execution_receipts']=[self.ref(r)]
        out=audit(self.package)
        self.assertEqual(out['received_executions'],1)
        self.assertEqual(out['evidence_ready_executions'],0)
        row=next(row for row in out['rows'] if row['task_key']==t['task_key'] and row['profile']=='playwright' and row['repetition']=='A1')
        self.assertIn('identity-or-provenance-mismatch',row['errors'])

    def complete_failure(self,benchmark='wav'):
        t=next(t for t in self.tasks if t['benchmark']==benchmark);profile='playwright'
        script=self.root/'fixture.py';script.write_text('# SYNTHETIC_TEST: never executed\n')
        import hashlib
        command={'argv':[sys.executable,str(script)],'source':str(script),
                 'sha256':hashlib.sha256(script.read_bytes()).hexdigest(),'timeout_ms':5000}
        binding={'framework':'playwright','framework_revision':'unit-fixture','configuration_sha256':'a'*64,
            'boundary_audit_sha256':'b'*64,'baseline_sha256':'c'*64,'environment_id':'unit-fixture',
            'budget':{'task_timeout_ms':1000,'max_actions':10},'sdk_max_retries':0,
            'timing_policy':POLICY,'lifecycle_limits':{'setup_ms':1000,'evaluation_ms':1000,'finalization_ms':1000,'transport_ms':1000},
            'commands':{s:command for s in ('reset','actor','evaluate','cleanup')}}
        binding['traditional_script_ref']={'file':str(script),'sha256':command['sha256']}
        from traditional_actor import SOURCES
        binding['actor_source_refs']={name:binding['traditional_script_ref'] for name in SOURCES}
        self.package['runtime_binding_refs']={t['benchmark']+'/'+profile:self.ref(binding)}
        # Deliberately model an admissible envelope to unit-test the checker.
        # These artificial claims exist only under TemporaryDirectory; never
        # export this test fixture into a runtime ledger or public evidence.
        ident={'opportunity_id':'one','environment_id':'unit-fixture','configuration_sha256':'a'*64,
               'scope':'diagnostic','data_kind':'MEASURED'}
        native={**ident,'assessment_status':'valid','native_score':0,'verdict':None,
                **{k:t['binding'][k] for k in ('benchmark','official_task_id','source_sha256','evaluation_ref')}}
        nr=self.ref(native)
        actor={**ident,'terminal_status':'completed','budget_met':True,'action_count':1,
               'elapsed_ms':100,'source_tree_unchanged':True}
        artifacts={
            'reset':self.ref({**ident,'restored':True,'baseline_sha256':binding['baseline_sha256']}),
            'actor':self.ref(actor),
            'native_evaluation':nr,'cleanup':self.ref({**ident,'cleaned':True}),
            'failure_review':self.ref({**ident,'failure_attribution':'capability',
                'reviewer':'SYNTHETIC_TEST','rationale':'Fixture for valid negative outcome', 'evidence_refs':[nr]})}
        result={**ident,'task_key':t['task_key'],'profile':profile,'repetition':'A1',
            'campaign_id':self.manifest['campaign_id'],'host_id':'unit-host','candidate_version':'unit-version',
            'protocol_id':self.manifest['protocol_id'],'manifest_sha256':self.package['manifest_ref']['sha256'],
            'task_binding_sha256':t['binding_sha256'],'data_kind':'MEASURED','scope':'diagnostic',
            'runtime_binding_sha256':digest(binding),'model_binding':None,'artifacts':artifacts,
            'failure_attribution':'capability','result':{**native,'lifecycle_completed':True,
                'terminal_status':'completed','actor_terminal_status':'completed','cleanup_status':'verified',
                'action_count':1,'budget_met':True,'protocol_completed':True,'phase_timings_ms':{'actor':110}}}
        self.attach_replay(result, actor, binding)
        return result

    def read(self,ref):
        return json.loads(Path(ref['file']).read_text())

    def attach_replay(self,receipt,actor,binding,observations=True,start_override=None):
        """Hash-chained artificial evidence, never an actual benchmark run."""
        self.counter+=1
        journal=Journal(self.root/f'SYNTHETIC_TEST_replay_{self.counter}')
        actor['timing_policy']=POLICY
        actor['actor_timing']=window(1_000_000,1_000_000+int(actor['elapsed_ms']*1_000_000))
        end=actor['actor_timing']['end_ns']
        timing={'policy':POLICY,'phases':{'setup':window(0,1_000_000),
            'actor':window(1_000_000,end),'evaluation':window(end,end+1_000_000),
            'finalization':window(end+1_000_000,end+2_000_000)}}
        receipt['result'].update(timing_policy=POLICY,lifecycle_timing=timing,actor_elapsed_ms=actor['elapsed_ms'])
        actor['trajectory_directory']=str(journal.directory)
        source_refs=(binding['actor_source_refs'] if binding['framework']!='playwright' else
                     {**binding['actor_source_refs'],Path(binding['traditional_script_ref']['file']).name:binding['traditional_script_ref']})
        sources={name:journal.artifact('source-'+name+'.txt',Path(ref['file']).read_bytes())
                 for name,ref in source_refs.items()}
        journal.event('source-snapshot',sources=sources)
        start={k:binding.get(k) for k in ('framework','mode','model_binding','budget')}
        start.update(start_override or {})
        journal.event('actor-start',**start)
        if observations:
            frame=journal.artifact('fixture.png',b'\x89PNG\r\n\x1a\nSYNTHETIC_TEST')
            journal.event('observation',frame=frame)
        for index in range(actor.get('action_count',0)):
            action={'name':'done','text':'SYNTHETIC_TEST'}
            journal.event('action-start',action=action)
            journal.event('action-end',action=action,action_error=None)
        for index in range(actor.get('provider_requests',0)):
            journal.event('provider-start',request_id=f'SYNTHETIC_TEST_{index}')
            journal.event('provider-end',request_id=f'SYNTHETIC_TEST_{index}')
        journal.event('actor-end',receipt=actor)
        report=audit_replay(journal.directory)
        identity={k:receipt[k] for k in ('opportunity_id','environment_id','configuration_sha256')}
        receipt['artifacts']['actor']=self.ref(actor)
        receipt['artifacts']['replay']=self.ref({**identity,'schema':'pss-replay-evidence-v1',
            'scope':'diagnostic','data_kind':'MEASURED','integrity_audit':report,
            'trajectory_ref':{'file':str(journal.directory/'trajectory.jsonl'),'sha256':report['trajectory_sha256']}})
        if True:
            # Artificial positive-control envelope. No browser was closed and
            # no measured benchmark data exists; all files are deleted with the
            # unit-test TemporaryDirectory. Never send these claims to a ledger.
            from benchmark_actor_lifecycle import persist, encoded, pinned_ref
            actor_ref=persist(journal.directory/'actor-receipt.json',encoded(actor))
            har_ref=persist(journal.directory/'network.har',encoded({'log':{'entries':[]}}))
            seal={**identity,'schema':'pss-actor-lifecycle-v1','scope':'diagnostic','data_kind':'MEASURED',
                  'actor_receipt_ref':actor_ref,'trajectory_ref':pinned_ref(journal.directory/'trajectory.jsonl'),
                  'network_trace_ref':har_ref,'har_entries':0,'context_close_observed':True,
                  'context_closed_after_actor_end':True,'journal_unchanged_on_close':True,
                  'lifecycle_timing':timing,'lifecycle_limits':binding['lifecycle_limits'],
                  'confirmatory_authorized':False}
            seal_ref=persist(journal.directory/'supervisor-lifecycle.json',encoded(seal))
            receipt['artifacts']['actor_lifecycle']=seal_ref
            native=self.read(receipt['artifacts']['native_evaluation'])
            native.update(actor_lifecycle_ref=seal_ref,source_network_trace_sha256=har_ref['sha256'],network_trace_ref=har_ref)
            receipt['artifacts']['native_evaluation']=self.ref(native)

    def test_zero_native_score_can_be_valid_evidence_not_delivery_success(self):
        r=self.complete_failure();self.package['execution_receipts']=[self.ref(r)]
        report=audit(self.package)
        self.assertEqual(report['evidence_ready_executions'],1)
        self.assertFalse(report['delivery_evidence_ready'])

    def test_vwa_cannot_use_postclose_or_missing_native_evaluation(self):
        r=self.complete_failure('vwa')
        self.rejected(r,'vwa-preclose-native-evaluation-unverified')

    def test_ata_reference_labels_do_not_prove_live_fixture_parity(self):
        r=self.complete_failure('ata')
        self.rejected(r,'ata-live-fixture-label-parity-unverified')

    def test_summary_cannot_replace_native_outcome_and_external_failure_not_admitted(self):
        r=self.complete_failure();r['result']['native_score']=1
        self.package['execution_receipts']=[self.ref(r)]
        self.assertEqual(audit(self.package)['evidence_ready_executions'],0)
        r=self.complete_failure();r['failure_attribution']='external'
        self.package['execution_receipts']=[self.ref(r)]
        self.assertEqual(audit(self.package)['evidence_ready_executions'],0)

    def rejected(self,receipt,error):
        self.package['execution_receipts']=[self.ref(receipt)]
        report=audit(self.package)
        self.assertEqual(report['evidence_ready_executions'],0)
        row=next(row for row in report['rows'] if row['task_key']==receipt['task_key']
                 and row['profile']==receipt['profile'] and row['repetition']==receipt['repetition'])
        self.assertIn(error,row['errors'])

    def test_missing_or_invalid_actual_budget_is_rejected(self):
        for changes in [{'action_count':None},{'budget_met':None},{'elapsed_ms':None},{'elapsed_ms':-1}]:
            with self.subTest(changes=changes):
                r=self.complete_failure();actor=self.read(r['artifacts']['actor']);actor.update(changes)
                r['artifacts']['actor']=self.ref(actor)
                self.rejected(r,'actor-budget-accounting-incomplete')

    def test_summary_cannot_hide_budget_excess(self):
        r=self.complete_failure();r['result']['phase_timings_ms']['actor']=2000
        self.rejected(r,'lifecycle-timing-unverified')
        r=self.complete_failure();actor=self.read(r['artifacts']['actor']);actor['action_count']=11
        r['artifacts']['actor']=self.ref(actor)
        self.rejected(r,'executed-beyond-frozen-action-budget')

    def test_bound_environment_and_reset_baseline_cannot_be_substituted(self):
        r=self.complete_failure();r['environment_id']='OTHER_ENV'
        for name,ref in list(r['artifacts'].items()):
            value=self.read(ref);value['environment_id']='OTHER_ENV';r['artifacts'][name]=self.ref(value)
        self.rejected(r,'unfrozen-runtime-configuration')
        r=self.complete_failure();reset=self.read(r['artifacts']['reset']);reset['baseline_sha256']='wrong'
        r['artifacts']['reset']=self.ref(reset)
        self.rejected(r,'reset-baseline-mismatch')

    def test_provider_error_cannot_hide_behind_completed_summary(self):
        r=self.complete_failure();actor=self.read(r['artifacts']['actor']);actor['terminal_status']='provider-error'
        r['artifacts']['actor']=self.ref(actor);r['result']['actor_terminal_status']='provider-error'
        self.rejected(r,'actor-non-capability-terminal')

    def test_replay_boolean_or_another_opportunity_is_not_evidence(self):
        r=self.complete_failure();r['artifacts']['replay']=self.ref({'passed':True})
        self.rejected(r,'replay-contents-unverified')
        r=self.complete_failure();replay=self.read(r['artifacts']['replay']);replay['opportunity_id']='OTHER_TASK'
        r['artifacts']['replay']=self.ref(replay)
        self.rejected(r,'replay:execution-identity-mismatch')

    def test_replay_must_verify_real_frames_and_frozen_model_and_actions(self):
        for override,observations in [({'model_binding':{'provider':'other','model':'other'}},True),({},False)]:
            with self.subTest(override=override,observations=observations):
                r=self.complete_failure();actor=self.read(r['artifacts']['actor'])
                binding=self.read(next(iter(self.package['runtime_binding_refs'].values())))
                self.attach_replay(r,actor,binding,observations=observations,start_override=override)
                self.rejected(r,'replay-contents-unverified')

    def test_fully_accounted_budget_timeout_is_valid_negative_evidence(self):
        r=self.complete_failure();actor=self.read(r['artifacts']['actor'])
        actor.update(terminal_status='timeout',budget_met=False)
        binding=self.read(next(iter(self.package['runtime_binding_refs'].values())))
        self.attach_replay(r,actor,binding)
        r['result'].update(terminal_status='timeout',actor_terminal_status='timeout',budget_met=False,protocol_completed=False)
        self.package['execution_receipts']=[self.ref(r)]
        self.assertEqual(audit(self.package)['evidence_ready_executions'],1)

    def complete_agent_failure(self):
        r=self.complete_failure()
        binding=self.read(next(iter(self.package['runtime_binding_refs'].values())))
        model={'provider':'SYNTHETIC_TEST','model':'SYNTHETIC_TEST'}
        binding.update(framework='agentlab-browsergym',mode='visual',model_binding=model,
                       cost_policy={'cap_micro_usd':1000,'request_reservation_micro_usd':100})
        binding['actor_source_refs']={name:binding['traditional_script_ref'] for name in FRAMEWORK_SOURCES}
        r.update(profile='agentlab-visual',model_binding=model,runtime_binding_sha256=digest(binding))
        self.package['runtime_binding_refs']={r['task_key'].split(':')[0]+'/'+r['profile']:self.ref(binding)}
        actor=self.read(r['artifacts']['actor']);actor['provider_requests']=1
        self.attach_replay(r,actor,binding)
        identity={k:r[k] for k in ('opportunity_id','environment_id','configuration_sha256')}
        r['artifacts']['provider_accounting']=self.ref({**identity,'model_binding':model,
            'scope':'diagnostic','data_kind':'MEASURED','all_requests_settled':True,'requests':1})
        return r,binding

    def test_zero_score_agent_evidence_requires_matching_provider_accounting(self):
        r,binding=self.complete_agent_failure()
        self.package['execution_receipts']=[self.ref(r)]
        self.assertEqual(audit(self.package)['evidence_ready_executions'],1)
        for change in [{'requests':2},{'model_binding':{'provider':'other','model':'other'}},
                       {'environment_id':'other'},{'all_requests_settled':False}]:
            with self.subTest(change=change):
                r,binding=self.complete_agent_failure()
                accounting=self.read(r['artifacts']['provider_accounting']);accounting.update(change)
                r['artifacts']['provider_accounting']=self.ref(accounting)
                error=('provider_accounting:execution-identity-mismatch' if 'environment_id' in change
                       else 'provider-accounting-incomplete')
                self.rejected(r,error)

    def test_missing_frozen_budget_or_model_cannot_be_admitted(self):
        for missing in ('budget','model_binding'):
            with self.subTest(missing=missing):
                r,binding=self.complete_agent_failure();binding.pop(missing)
                self.package['runtime_binding_refs']={r['task_key'].split(':')[0]+'/'+r['profile']:self.ref(binding)}
                r['runtime_binding_sha256']=digest(binding)
                self.rejected(r,'unfrozen-runtime-configuration')

    def test_all_components_need_explicit_measured_diagnostic_provenance(self):
        for component in ('reset','actor','native_evaluation','replay','cleanup','failure_review','provider_accounting','actor_lifecycle'):
            for change in ({'scope':'synthetic'},{'data_kind':'SYNTHETIC_TEST'},{'scope':None},{'data_kind':None}):
                with self.subTest(component=component,change=change):
                    r,binding=self.complete_agent_failure()
                    value=self.read(r['artifacts'][component]);value.update(change)
                    if component=='actor': self.attach_replay(r,value,binding)
                    else: r['artifacts'][component]=self.ref(value)
                    self.rejected(r,component+':non-measured-or-nondiagnostic-component')

    def test_native_outcome_must_bind_official_task_source_and_evaluator_ref(self):
        for change in ({'benchmark':'ata'},{'official_task_id':'OTHER'}, {'source_sha256':'0'*64},
                       {'evaluation_ref':None}, {'evaluation_ref':{'file':'/does-not-exist','sha256':'0'*64}}):
            with self.subTest(change=change):
                r=self.complete_failure();native=self.read(r['artifacts']['native_evaluation']);native.update(change)
                r['artifacts']['native_evaluation']=self.ref(native)
                self.rejected(r,'native-official-task-binding-mismatch')

    def test_wav_evaluator_cannot_substitute_har_or_lifecycle(self):
        for change in ({'source_network_trace_sha256':'0'*64},{'actor_lifecycle_ref':None},
                       {'network_trace_ref':{'file':'/missing','sha256':'0'*64}}):
            with self.subTest(change=change):
                r=self.complete_failure();native=self.read(r['artifacts']['native_evaluation']);native.update(change)
                r['artifacts']['native_evaluation']=self.ref(native)
                self.rejected(r,'wav-actor-lifecycle-unverified')

    def test_frozen_script_and_actor_source_stability_are_required(self):
        r=self.complete_failure();actor=self.read(r['artifacts']['actor']);actor['source_tree_unchanged']=False
        binding=self.read(next(iter(self.package['runtime_binding_refs'].values())))
        self.attach_replay(r,actor,binding)
        self.rejected(r,'replay-contents-unverified')
        for actor_profile in ('script','agent'):
            with self.subTest(actor_profile=actor_profile):
                if actor_profile=='agent':r,binding=self.complete_agent_failure();binding.pop('actor_source_refs')
                else:
                    r=self.complete_failure();binding=self.read(next(iter(self.package['runtime_binding_refs'].values())))
                    binding.pop('traditional_script_ref')
                self.package['runtime_binding_refs']={r['task_key'].split(':')[0]+'/'+r['profile']:self.ref(binding)}
                r['runtime_binding_sha256']=digest(binding)
                self.rejected(r,'replay-contents-unverified')
        r,binding=self.complete_agent_failure()
        binding['actor_source_refs'][FRAMEWORK_SOURCES[0]]=self.ref({'kind':'OTHER_SYNTHETIC_SOURCE'})
        self.package['runtime_binding_refs']={r['task_key'].split(':')[0]+'/'+r['profile']:self.ref(binding)}
        r['runtime_binding_sha256']=digest(binding)
        self.rejected(r,'replay-contents-unverified')


if __name__=='__main__':unittest.main()
