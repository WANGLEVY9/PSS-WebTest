"""Adversarial and process-level SYNTHETIC_TEST acceptance. No paid calls."""
import json
from pathlib import Path
import subprocess
import unittest
from bind_runtime_plan import bind
from runtime_identity import sha, verify_bound_input
from runtime_test_fixture import fixture_package, bound_fixture
from export_runtime import export_records
import test_runtime_store as fixtures
from runtime_worker import execute_one
from runtime_store import digest


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.f = fixtures.RuntimeTests(); self.f.setUp()
        self.binding = self.f.binding()

    def tearDown(self):
        self.f.tearDown()

    def test_input_and_declared_hash_cannot_change_under_original_opportunity(self):
        op, package = fixture_package(self.f.temp.name, self.binding)
        task = package['tasks'][op['task_key']]
        Path(task['agent_input_file']).write_text('{"intent":"different"}')
        task['agent_input_sha256'] = sha(Path(task['agent_input_file']).read_bytes())
        with self.assertRaisesRegex(ValueError, 'source drift'):
            list(bind([op], package))

    def test_evaluator_reference_and_file_are_frozen(self):
        for change in ('reference','file'):
            op, package = fixture_package(self.f.temp.name, self.binding)
            task = package['tasks'][op['task_key']]
            if change == 'reference': task['evaluation_ref'] = 'OTHER'
            else: Path(task['evaluation_file']).write_text('{"gold":"changed"}')
            with self.assertRaisesRegex(ValueError, 'Evaluator'):
                list(bind([op], package))

    def test_legacy_plan_and_tampered_round_rejected(self):
        op, package = fixture_package(self.f.temp.name, self.binding)
        for wrong in [{**op,'identity_schema':None},{**op,'round':'V1'}]:
            with self.assertRaises(ValueError): list(bind([wrong],package))

    def test_executor_model_or_budget_cannot_change_under_original_plan(self):
        op, package = fixture_package(self.f.temp.name, self.binding)
        self.binding['budget']['max_actions'] += 1
        with self.assertRaisesRegex(ValueError,'frozen before schedule'):
            list(bind([op],package))

    def test_source_artifact_drift_rejected(self):
        op, package = fixture_package(self.f.temp.name,self.binding)
        Path(package['tasks'][op['task_key']]['source_file']).write_text('not original')
        with self.assertRaisesRegex(ValueError,'Original source artifact'):
            list(bind([op],package))

    def test_bound_input_rechecked_before_external_side_effect(self):
        op = bound_fixture(self.f.temp.name, self.binding)
        op['agent_input']['intent'] = 'tampered after bind'
        self.f.store.enqueue([op]); calls=[]
        with self.assertRaisesRegex(ValueError, 'Bound agent input'):
            execute_one(self.f.store,self.binding,lambda *args:calls.append(args))
        self.assertEqual(calls,[])
        self.assertEqual(self.f.store.summary()['states'],{'leased':1})

    def test_large_pending_validation_queue_uses_one_claim_query(self):
        self.f.store.enqueue([{'opportunity_id':'D','environment_id':'other','schedule_sha256':'a'*64,'config_id':'v2','phase':'discovery'}]+[
            {'opportunity_id':str(i),'environment_id':'env','schedule_sha256':'a'*64,'config_id':'v1','phase':'validation'} for i in range(6000)])
        trace=[]; self.f.store.db.set_trace_callback(trace.append)
        self.assertIsNone(self.f.store.claim(config_id='v1',environment_id='env'))
        self.assertEqual(sum(q.startswith('SELECT') for q in trace),1)

    def test_request_cap_cannot_be_redeclared_by_first_caller(self):
        op=bound_fixture(self.f.temp.name,self.binding);self.f.store.enqueue([op])
        claimed=self.f.store.claim();self.f.store.start(op['opportunity_id'],claimed['lease_token'])
        with self.assertRaisesRegex(ValueError,'frozen opportunity'):
            self.f.store.reserve(op['opportunity_id'],claimed['lease_token'],'r',op['model_binding'],100,1000000)

    def test_real_subprocess_plan_bind_execute_export_import_chain(self):
        # Uses real JSON subprocess transport and SQLite, with a synthetic adapter.
        root=Path(self.f.temp.name); here=Path(__file__).parent
        op, package=fixture_package(self.f.temp.name,self.binding)
        task=json.loads(op['task_manifest_json'])
        # Force cross-language UTF-8 identity parity as well as a real scheduler.
        task['application']='合成验收'
        bundle={'protocol_id':'pss-manuscript-v2.1','scope':'synthetic','tasks':[task]}
        script=root/'adapter.py'
        script.write_text('''import json,sys
p=json.load(sys.stdin);s=sys.argv[1]
keys=('opportunity_id','environment_id','configuration_sha256','lease_token','task_manifest_sha256','evaluation_ref','evaluation_sha256','scope','data_kind')
r={k:p[k] for k in keys if k in p}
if s=='reset':r.update(restored=True,baseline_sha256=p['baseline_sha256'])
elif s=='actor':
 assert 'evaluation_ref' not in p and 'evaluation_file' not in p
 r.update(terminal_status='timeout',budget_met=False,action_count=1)
elif s=='evaluate':r.update(assessment_status='unresolved',native_score=None,verdict=None)
else:r['cleaned']=True
print(json.dumps(r))
''')
        for stage,c in self.binding['commands'].items():
            c.update(argv=[c['argv'][0],str(script),stage],source=str(script),sha256=sha(script.read_bytes()),timeout_ms=2000)
        bundle['bindings']={'configurations':{'v1':{'executor_binding_sha256_by_benchmark':{'wav':digest(self.binding)}}}}
        source=root/'bundle.json';source.write_text(json.dumps(bundle,ensure_ascii=False))
        plan_dir=root/'plan'
        r=subprocess.run(['node',str(here/'study-workflow.mjs'),'plan',str(source),str(plan_dir)],capture_output=True,text=True)
        self.assertEqual(r.returncode,0,r.stderr)
        planned=[json.loads(line) for line in (plan_dir/'opportunities.jsonl').read_text().splitlines()]
        selected=[p for p in planned if p['config_id']=='v1' and p['round'] in ('D1','D2')]
        bound=list(bind(selected,package));self.f.store.enqueue(bound)
        for _ in range(2): execute_one(self.f.store,self.binding)
        normalized=export_records(self.f.file,bundle)
        self.assertEqual(len(normalized['records']),2)
        self.assertTrue(all(r['started'] and r['budget_met'] is False for r in normalized['records']))
        file=root/'normalized.json';file.write_text(json.dumps(normalized,ensure_ascii=False))
        out=root/'analysis'
        result=subprocess.run(['node',str(here/'study-workflow.mjs'),'import',str(file),str(out)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        report=json.loads((out/'analysis.json').read_text())
        row=next(s for s in report['strata'] if s['configuration_id']=='v1')
        self.assertEqual(row['operational']['observed'],2)
        self.assertAlmostEqual(row['operational']['upper'],10/12)
        self.assertFalse(report['confirmatory_authorized'])


if __name__=='__main__':unittest.main()
