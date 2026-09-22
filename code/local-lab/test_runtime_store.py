"""SYNTHETIC fixtures; no benchmark execution, model call or measured result."""
import concurrent.futures
import json
import tempfile
import unittest
from pathlib import Path
from runtime_store import Store, digest
from runtime_worker import execute_one, run_command
from ata_mapping import audit_mapping
import hashlib
import sys


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.file = str(Path(self.temp.name) / 'runtime.sqlite')
        self.now = 1000
        self.store = Store(self.file, clock=lambda: self.now)

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def op(self, n=1, env='isolated-test'):
        return {'opportunity_id': str(n), 'environment_id': env, 'schedule_sha256': 'a'*64, 'scope': 'synthetic'}

    def running(self):
        self.store.enqueue([self.op()])
        op = self.store.claim()
        self.store.start(op['opportunity_id'], op['lease_token'])
        return op['lease_token']

    def test_idempotent_enqueue_and_terminal_ack(self):
        self.store.enqueue([self.op(), self.op()])
        self.assertEqual(self.store.summary()['states'], {'queued': 1})
        with self.assertRaisesRegex(ValueError, 'collision'):
            self.store.enqueue([{**self.op(), 'extra': 'drift'}])
        token = self.running()
        self.store.finish('1', token, {'native_score': 1})
        self.store.finish('1', token, {'native_score': 1})
        self.assertIsNone(self.store.claim())
        with self.assertRaises(ValueError):
            self.store.finish('1', token, {'native_score': 0})

    def test_crash_recovery_fences_old_worker_and_blocks_dirty_environment(self):
        token = self.running()
        self.store.enqueue([self.op(2)])
        self.now += 31
        self.store.recover()
        self.assertEqual(self.store.summary()['states'], {'queued': 1, 'uncertain': 1})
        self.assertIsNone(self.store.claim())
        with self.assertRaisesRegex(ValueError, 'Stale'):
            self.store.finish('1', token, {'native_score': 1})
        with self.assertRaises(ValueError):
            self.store.resolve_uncertain('1', 'b'*64)
        self.store.resolve_uncertain('1', 'b'*64, worker_terminated=True)
        self.assertEqual(self.store.claim()['opportunity_id'], '2')

    def test_unstarted_lease_can_be_recovered_without_rerunning_started_cell(self):
        self.store.enqueue([self.op()])
        old = self.store.claim()
        self.now += 31
        self.store.recover()
        new = self.store.claim()
        self.assertNotEqual(old['lease_token'], new['lease_token'])
        with self.assertRaises(ValueError):
            self.store.start('1', old['lease_token'])

    def test_concurrent_claims_are_unique_and_environment_exclusive(self):
        self.store.enqueue([self.op(i, f'env-{i%3}') for i in range(12)])
        def claim(_):
            db = Store(self.file)
            try:
                return db.claim()
            finally:
                db.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            claimed = [x for x in pool.map(claim, range(12)) if x]
        self.assertEqual(len(claimed), 3)
        self.assertEqual(len({x['opportunity_id'] for x in claimed}), 3)

    def test_unknown_usage_reserves_cost_and_late_settlement_is_idempotent(self):
        token = self.running()
        self.store.reserve('1', token, 'r1', {'model': 'fixture'}, 80, 100)
        with self.assertRaisesRegex(ValueError, 'limit'):
            self.store.reserve('1', token, 'r2', {}, 30, 100)
        self.assertIsNone(self.store.summary()['total_micro_usd'])
        self.now += 31
        self.store.recover()
        self.store.settle('r1', {'usage': None}, None)
        self.assertEqual(self.store.summary()['reserved_exposure'], 80)
        self.store.settle('r1', {'usage': None}, None)
        with self.assertRaisesRegex(ValueError, 'Conflicting'):
            self.store.settle('r1', {'usage': 3}, 3)
        self.assertEqual(self.store.summary()['states'], {'uncertain': 1})

    def test_validation_waits_for_discovery_terminal_and_uncertain_cannot_release_it(self):
        self.store.enqueue([{**self.op(1, 'd-env'), 'phase': 'discovery'}, {**self.op(2, 'v-env'), 'phase': 'validation'}])
        d = self.store.claim()
        self.store.start('1', d['lease_token'])
        self.assertIsNone(self.store.claim())
        self.now += 31
        self.store.recover()
        self.assertIsNone(self.store.claim())
        self.store.resolve_uncertain('1', 'a'*64, worker_terminated=True)
        self.assertEqual(self.store.claim()['opportunity_id'], '2')

    def test_actor_identity_and_campaign_cap_are_frozen(self):
        self.store.enqueue([{**self.op(), 'model_binding': {'model': 'fixed', 'provider': 'fixture'}}])
        op = self.store.claim()
        self.store.start('1', op['lease_token'])
        with self.assertRaisesRegex(ValueError, 'identity'):
            self.store.reserve('1', op['lease_token'], 'r', {'model': 'cheap', 'provider': 'fixture'}, 10, 100)
        self.store.reserve('1', op['lease_token'], 'r', {'model': 'fixed', 'provider': 'fixture'}, 10, 100)
        with self.assertRaisesRegex(ValueError, 'cap cannot change'):
            self.store.reserve('1', op['lease_token'], 'r2', {'model': 'fixed', 'provider': 'fixture'}, 10, 1000)
        self.store.settle('r', {'usage': 'fixture'}, 101)
        self.assertTrue(self.store.summary()['reservation_overrun'])

    def test_abrupt_process_exit_preserves_committed_request_and_quarantine(self):
        import subprocess
        child = "from runtime_store import Store; import sys,os; s=Store(sys.argv[1],clock=lambda:1000); s.enqueue([{'opportunity_id':'crashed','environment_id':'env','schedule_sha256':'a'*64}]); o=s.claim(); s.start('crashed',o['lease_token']); s.reserve('crashed',o['lease_token'],'sent',{},40,100); os._exit(9)"
        done = subprocess.run([sys.executable, '-c', child, self.file], cwd=str(Path(__file__).parent), capture_output=True)
        self.assertEqual(done.returncode, 9, done.stderr)
        self.now = 1031
        self.store.recover()
        report = self.store.summary()
        self.assertEqual(report['states'], {'uncertain': 1})
        self.assertEqual(report['attempts'], 1)
        self.assertEqual(report['reserved_exposure'], 40)
        self.assertIsNone(report['total_micro_usd'])
        self.assertIsNone(self.store.claim())

    def test_plan_binder_freezes_model_and_rejects_changed_agent_input(self):
        from bind_runtime_plan import bind
        b = self.binding()
        spec = Path(self.temp.name) / 'input.json'
        spec.write_text('{"intent":"synthetic"}')
        task = {'agent_input_file': str(spec), 'agent_input_sha256': hashlib.sha256(spec.read_bytes()).hexdigest(), 'evaluation_ref': 'private-evaluator-ref'}
        package = {'executors': {'v1': {'wav': b}}, 'tasks': {'t': task}}
        op = {**self.op(), 'protocol_id': 'pss-manuscript-v2.1', 'config_id':'v1', 'benchmark':'wav', 'task_key':'t'}
        bound = list(bind([op], package))[0]
        self.assertEqual(bound['model_binding'], b['model_binding'])
        self.assertEqual(bound['runtime_binding_sha256'], digest(b))
        self.assertNotIn('private-evaluator-ref', json.dumps(bound['agent_input']))
        spec.write_text('{"intent":"modified"}')
        with self.assertRaisesRegex(ValueError, 'source drift'):
            list(bind([op], package))

    def test_database_reopen_preserves_pending_requests(self):
        token = self.running()
        self.store.reserve('1', token, 'r1', {}, 20, 100)
        self.store.close()
        self.store = Store(self.file, clock=lambda: self.now)
        self.assertEqual(self.store.summary()['attempts'], 1)
        with self.assertRaisesRegex(ValueError, 'already reserved'):
            self.store.reserve('1', token, 'r1', {}, 20, 100)

    def binding(self):
        script = Path(self.temp.name) / 'adapter.py'
        script.write_text('import json,sys\np=json.load(sys.stdin)\nprint(json.dumps(p))\n')
        command = {'argv': [sys.executable, str(script)], 'source': str(script), 'sha256': hashlib.sha256(script.read_bytes()).hexdigest(), 'timeout_ms': 1000}
        return {'config_id': 'v1', 'framework': 'agentlab-browsergym', 'framework_revision': 'synthetic-test-only',
                'configuration_sha256': 'c'*64, 'boundary_audit_sha256': 'd'*64, 'environment_id': 'isolated-test',
                'baseline_sha256': 'e'*64, 'model_binding': {'provider':'fixture','model':'fixture'},
                'cost_policy': {'cap_micro_usd':1000, 'request_reservation_micro_usd':100}, 'budget': {'task_timeout_ms': 1000, 'max_actions': 10}, 'sdk_max_retries': 0,
                'commands': {s: {**command, 'stage': s} for s in ('reset', 'actor', 'evaluate', 'cleanup')}}

    def test_worker_resets_every_arm_and_keeps_gold_out_of_actor(self):
        binding = self.binding()
        self.store.enqueue([{**self.op(i), 'config_id': 'v1', 'configuration_sha256': 'c'*64, 'runtime_binding_sha256': digest(binding), 'model_binding': binding['model_binding'], 'agent_input': {'intent': 'synthetic'}, 'evaluation_ref': 'SECRET_GOLD'} for i in (1, 2)])
        calls = []
        def invoke(command, payload, heartbeat):
            heartbeat()
            stage = command['stage']
            calls.append(stage)
            receipt = {k: payload[k] for k in ('opportunity_id', 'environment_id', 'configuration_sha256', 'scope', 'data_kind')}
            if stage == 'reset':
                return {**payload, 'restored': True}
            if stage == 'actor':
                self.assertNotIn('SECRET_GOLD', json.dumps(payload))
                return {**receipt, 'terminal_status': 'completed', 'budget_met': True, 'action_count': 2}
            if stage == 'evaluate':
                return {**receipt, 'assessment_status': 'valid', 'native_score': 1, 'verdict': None}
            return {**receipt, 'cleaned': True}
        for _ in range(2):
            self.assertEqual(execute_one(self.store, binding, invoke)['native_score'], 1)
        self.assertEqual(calls, ['reset', 'actor', 'evaluate', 'cleanup']*2)
        self.assertEqual(self.store.summary()['states'], {'terminal': 2})

    def test_actor_command_cannot_shorten_frozen_budget(self):
        from runtime_worker import validate_commands
        binding = self.binding()
        binding['commands']['actor']['timeout_ms'] = 999
        with self.assertRaisesRegex(ValueError, 'shorten'):
            validate_commands(binding)

    def test_timeout_cleanup_and_quarantine_never_loses_terminal_event(self):
        b = self.binding()
        self.store.enqueue([{**self.op(), 'config_id': 'v1', 'configuration_sha256': 'c'*64, 'runtime_binding_sha256': digest(b), 'model_binding': b['model_binding'], 'agent_input': {}, 'evaluation_ref': None}])
        calls = []
        def invoke(command, payload, heartbeat):
            calls.append(command['stage'])
            if command['stage'] == 'reset':
                raise TimeoutError()
            raise RuntimeError()
        r = execute_one(self.store, b, invoke)
        self.assertEqual(calls, ['reset', 'cleanup'])
        self.assertEqual(r['cleanup_status'], 'unverified')
        self.assertEqual(self.store.summary()['states'], {'uncertain': 1})

    def test_subprocess_bridge_is_bounded_and_real_json_io(self):
        c = self.binding()['commands']['actor']
        self.assertEqual(run_command(c, {'fixture': 1}, lambda: None), {'fixture': 1})
        script = Path(c['source'])
        script.write_text('import time\ntime.sleep(30)\n')
        c['timeout_ms'] = 20
        with self.assertRaises(TimeoutError):
            run_command(c, {}, lambda: None)

    def test_ata_mapping_never_manufactures_balanced_native_subset(self):
        c = {'source_task_id': 'source-1', 'expected': 'FAIL', 'source_sha256': 'f'*64, 'application': 'fixture', 'input_sha256': 'a'*64}
        catalog = {'source_catalog_sha256': 'b'*64, 'cases': [c]}
        self.assertTrue(audit_mapping(catalog, [{**c, 'task_key': 't'}])['mapping_verified'])
        self.assertFalse(audit_mapping(catalog, [{**c, 'task_key': 't', 'expected': 'PASS'}])['mapping_verified'])
        self.assertFalse(audit_mapping(catalog, [{**c, 'task_key': 't'}, {**c, 'task_key': 't2'}])['mapping_verified'])
        self.assertIn('native subset is impossible', ' '.join(audit_mapping(catalog, [], {'FAIL': 56, 'PASS': 56})['errors']))


if __name__ == '__main__':
    unittest.main()
