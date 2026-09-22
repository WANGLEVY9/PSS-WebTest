"""Synthetic adapter receipts, never benchmark observations or admission evidence."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
import hashlib
from runtime_store import Store, digest
from runtime_worker import execute_one, validate_commands, run_command, AdapterReceiptError, unpack_actor_envelope, verify_receipt
from lifecycle_timing import POLICY,window


class ReceiptTests(unittest.TestCase):
    def test_component_provenance_must_match_trusted_opportunity(self):
        identity={'opportunity_id':'SYNTHETIC_CONTROL','environment_id':'fixture',
                  'configuration_sha256':'a'*64,'scope':'diagnostic','data_kind':'MEASURED'}
        for change in ({'scope':'synthetic'}, {'data_kind':'SYNTHETIC_TEST'}, {'scope':None}, {'data_kind':None}):
            with self.subTest(change=change),self.assertRaises(AdapterReceiptError):
                verify_receipt({**identity,**change},identity)
        with self.assertRaises(AdapterReceiptError):
            unpack_actor_envelope({**identity,'scope':'synthetic','data_kind':'SYNTHETIC_TEST'},identity)
        with self.assertRaises(AdapterReceiptError):
            unpack_actor_envelope({'actor_result':{**identity,'scope':'synthetic'},
                                  'actor_lifecycle_ref':{'file':'/no-read','sha256':'b'*64}},identity)

    def test_supervisor_envelope_never_changes_actor_receipt(self):
        identity={'opportunity_id':'SYNTHETIC_TEST','environment_id':'fixture','configuration_sha256':'a'*64}
        actor={**identity,'final_answer':'unchanged'}
        ref={'file':'/synthetic-only/no-real-file','sha256':'b'*64}
        with patch('benchmark_actor_lifecycle.verify_lifecycle',return_value={'scope':'synthetic'}) as verify:
            output,seal=unpack_actor_envelope({'actor_result':actor,'actor_lifecycle_ref':ref},identity)
            self.assertIs(output,actor)
            self.assertEqual(seal,ref)
            self.assertNotIn('actor_lifecycle_ref',actor)
            verify.assert_called_once_with(ref,actor)
        with self.assertRaises(AdapterReceiptError):
            unpack_actor_envelope({'actor_result':actor},identity)
        with patch('benchmark_actor_lifecycle.verify_lifecycle',side_effect=ValueError('drift')):
            with self.assertRaises(AdapterReceiptError):
                unpack_actor_envelope({'actor_result':actor,'actor_lifecycle_ref':ref},identity)

    def test_malformed_subprocess_receipt_is_untrusted_not_ordinary_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            script=Path(tmp)/'invalid.py';script.write_text('print("not-json")\n')
            with self.assertRaises(AdapterReceiptError):
                run_command({'argv':[sys.executable,str(script)],'timeout_ms':1000},{},lambda:None)

    def scenario(self, actor_override=None, wrong_stage=None, wrong_field='opportunity_id', evaluator_override=None, delayed=False, coordinate_space='css-pixels', current_timing=False, envelope_timeout=False):
        with tempfile.TemporaryDirectory() as tmp:
            script = Path(tmp) / 'fixture.py'
            script.write_text('# SYNTHETIC_TEST\n')
            cmd = {'argv': [sys.executable, str(script)], 'source': str(script), 'sha256': hashlib.sha256(script.read_bytes()).hexdigest(), 'timeout_ms': 1000}
            binding = {'config_id': 'v1', 'framework': 'agentlab-browsergym', 'framework_revision': 'synthetic-test',
                'configuration_sha256': 'a'*64, 'boundary_audit_sha256': 'b'*64, 'baseline_sha256': 'c'*64,
                'environment_id': 'fixture', 'model_binding': {'provider': 'fixture', 'model': 'fixture'},
                'coordinate_space': coordinate_space,
                'budget': {'task_timeout_ms': 1000, 'max_actions': 3}, 'sdk_max_retries': 0,
                'cost_policy': {'cap_micro_usd': 1000, 'request_reservation_micro_usd': 100},
                'commands': {s: {**cmd, 'stage': s} for s in ('reset', 'actor', 'evaluate', 'cleanup')}}
            if current_timing:
                binding.update(timing_policy=POLICY,lifecycle_limits={'setup_ms':1000,'evaluation_ms':1000,'finalization_ms':1000,'transport_ms':1000})
                binding['commands']['actor']['timeout_ms']=5000
            store = Store(str(Path(tmp) / 'ledger.sqlite'))
            op = {'opportunity_id': 'one', 'scope': 'synthetic', 'schedule_sha256': 'd'*64,
                  'config_id': 'v1', 'environment_id': 'fixture', 'configuration_sha256': 'a'*64,
                  'runtime_binding_sha256': digest(binding), 'model_binding': binding['model_binding'],
                  'agent_input': {'intent': 'synthetic'}, 'evaluation_ref': 'EVALUATOR_ONLY'}
            store.enqueue([op])
            clock = [0.0]
            calls = []
            seal={'lifecycle_limits':binding.get('lifecycle_limits'),'lifecycle_timing':{'policy':POLICY,'phases':{
                'setup':window(0,900_000_000),'actor':window(900_000_000,1_000_000_000),
                'evaluation':window(1_000_000_000,1_100_000_000),'finalization':window(1_100_000_000,1_900_000_000)}}}
            def invoke(command, payload, heartbeat):
                heartbeat()
                stage = command['stage']; calls.append(stage)
                out = {k: payload[k] for k in ('opportunity_id', 'environment_id', 'configuration_sha256', 'scope', 'data_kind')}
                if stage == 'reset': out.update(restored=True, baseline_sha256=payload['baseline_sha256'])
                elif stage == 'actor':
                    if envelope_timeout:raise TimeoutError('synthetic outer deadline')
                    self.assertNotIn('evaluation_ref', payload)
                    self.assertEqual(payload['coordinate_space'], coordinate_space)
                    out.update(terminal_status='completed', budget_met=True, action_count=2)
                    out.update(actor_override or {})
                    if delayed: clock[0] += 2
                    if current_timing:
                        self.assertEqual(command['timeout_ms'],5000)
                        out.update(timing_policy=POLICY,actor_timing=window(900_000_000,1_000_000_000),elapsed_ms=100.0)
                        out.update(actor_override or {})
                        return {'actor_result':out,'actor_lifecycle_ref':{'file':'/synthetic-only/seal','sha256':'a'*64}}
                elif stage == 'evaluate':
                    out.update(assessment_status='valid', native_score=1, verdict=None)
                    out.update(evaluator_override or {})
                else: out['cleaned'] = True
                if stage == wrong_stage: out[wrong_field] = 'OTHER_CELL'
                return out
            try:
                with patch('runtime_worker.time.monotonic', side_effect=lambda: clock[0]),patch('benchmark_actor_lifecycle.verify_lifecycle',return_value=seal):
                    result = execute_one(store, binding, invoke)
                return result, store.summary(), calls
            finally: store.close()

    def test_timeout_cannot_be_rescued_by_late_native_score(self):
        result, ledger, calls = self.scenario({'terminal_status': 'timeout', 'budget_met': False})
        self.assertEqual(result['native_score'], 1)
        self.assertEqual(result['terminal_status'], 'timeout')
        self.assertFalse(result['protocol_completed'])
        self.assertFalse(result['budget_met'])
        self.assertTrue(result['lifecycle_completed'])
        self.assertEqual(ledger['states'], {'terminal': 1})
        self.assertEqual(calls, ['reset', 'actor', 'evaluate', 'cleanup'])

    def test_frozen_normalized_coordinate_units_reach_actor(self):
        result, _, _ = self.scenario(coordinate_space='qwen-0-999')
        self.assertTrue(result['protocol_completed'])
        with self.assertRaisesRegex(ValueError, 'coordinate'):
            self.scenario(coordinate_space='normalized-unknown')

    def test_reported_timeout_overrules_contradictory_budget_claim(self):
        result, _, _ = self.scenario({'terminal_status': 'timeout', 'budget_met': True})
        self.assertEqual(result['terminal_status'], 'timeout')
        self.assertFalse(result['budget_met'])

    def test_supervisor_wall_time_and_action_limit_overrule_completed_claim(self):
        for override, delayed in [({'action_count': 4}, False), ({}, True), ({'budget_met': False}, False)]:
            with self.subTest(override=override, delayed=delayed):
                result, _, _ = self.scenario(override, delayed=delayed)
                self.assertEqual(result['native_score'], 1)
                self.assertEqual(result['terminal_status'], 'timeout')
                self.assertFalse(result['protocol_completed'])

    def test_provider_failure_is_not_rewritten_as_completed(self):
        result, _, _ = self.scenario({'terminal_status': 'provider-error'})
        self.assertEqual(result['terminal_status'], 'provider-error')
        self.assertEqual(result['native_score'], 1)
        self.assertFalse(result['protocol_completed'])

    def test_every_receipt_checks_task_environment_and_configuration_identity(self):
        for stage in ('reset', 'actor', 'evaluate', 'cleanup'):
            for field in ('opportunity_id', 'environment_id', 'configuration_sha256'):
                with self.subTest(stage=stage, field=field):
                    result, ledger, _ = self.scenario(wrong_stage=stage, wrong_field=field)
                    self.assertEqual(ledger['states'], {'uncertain': 1})
                    if stage != 'cleanup':
                        self.assertIsNone(result['native_score'])
                        self.assertEqual(result['assessment_status'], 'unresolved')
                    else: self.assertEqual(result['cleanup_status'], 'unverified')
                    self.assertFalse(result['lifecycle_completed'])

    def test_invalid_actor_and_evaluator_outputs_remain_unresolved(self):
        for override in [{'terminal_status': None}, {'budget_met': None}, {'action_count': True}, {'action_count': -1}]:
            result, ledger, _ = self.scenario(override)
            self.assertIsNone(result['native_score'])
            self.assertEqual(ledger['states'], {'uncertain': 1})
        for score in [True, 1.0, 0.5, '1']:
            result, ledger, _ = self.scenario(evaluator_override={'native_score': score})
            self.assertIsNone(result['native_score'])
            self.assertEqual(result['terminal_status'], 'evaluator-error')
            self.assertEqual(ledger['states'], {'uncertain': 1})

    def test_valid_completion_and_cleanup_still_work(self):
        result, ledger, _ = self.scenario()
        self.assertEqual(result['terminal_status'], 'completed')
        self.assertTrue(result['protocol_completed'])
        self.assertTrue(result['budget_met'])
        self.assertIsNone(result['operational_correctness'])
        self.assertEqual(ledger['states'], {'terminal': 1})

    def test_current_policy_excludes_setup_and_finalization_from_actor_budget(self):
        result,ledger,_=self.scenario(current_timing=True,delayed=True)
        self.assertEqual(result['actor_elapsed_ms'],100)
        self.assertEqual(result['actor_envelope_elapsed_ms'],2000)
        self.assertTrue(result['budget_met']);self.assertTrue(result['protocol_completed'])
        self.assertEqual(ledger['states'],{'terminal':1})

    def test_current_outer_timeout_is_not_fabricated_actor_timeout(self):
        result,ledger,_=self.scenario(current_timing=True,envelope_timeout=True)
        self.assertEqual(result['failure_class'],'lifecycle-envelope-timeout')
        self.assertEqual(result['terminal_status'],'execution-error')
        self.assertIsNone(result['actor_terminal_status']);self.assertIsNone(result['budget_met'])
        self.assertEqual(ledger['states'],{'uncertain':1})

    def test_child_duration_cannot_exceed_parent_clock_or_fake_actor_window(self):
        result,ledger,_=self.scenario(current_timing=True,delayed=False)
        self.assertEqual(ledger['states'],{'uncertain':1})
        result,ledger,_=self.scenario(current_timing=True,delayed=True,actor_override={'elapsed_ms':99})
        self.assertEqual(ledger['states'],{'uncertain':1})


if __name__ == '__main__': unittest.main()
