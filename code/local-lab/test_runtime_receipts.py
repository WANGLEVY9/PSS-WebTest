"""Synthetic adapter receipts, never benchmark observations or admission evidence."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
import hashlib
from runtime_store import Store, digest
from runtime_worker import execute_one, validate_commands
from runtime_test_fixture import bound_fixture, receipt_identity


class ReceiptTests(unittest.TestCase):
    def scenario(self, actor_override=None, wrong_stage=None, wrong_field='opportunity_id', evaluator_override=None, delayed=False):
        with tempfile.TemporaryDirectory() as tmp:
            script = Path(tmp) / 'fixture.py'
            script.write_text('# SYNTHETIC_TEST\n')
            cmd = {'argv': [sys.executable, str(script)], 'source': str(script), 'sha256': hashlib.sha256(script.read_bytes()).hexdigest(), 'timeout_ms': 1000}
            binding = {'config_id': 'v1', 'framework': 'agentlab-browsergym', 'framework_revision': 'synthetic-test',
                'configuration_sha256': 'a'*64, 'boundary_audit_sha256': 'b'*64, 'baseline_sha256': 'c'*64,
                'environment_id': 'fixture', 'model_binding': {'provider': 'fixture', 'model': 'fixture'},
                'budget': {'task_timeout_ms': 1000, 'max_actions': 3}, 'sdk_max_retries': 0,
                'cost_policy': {'cap_micro_usd': 1000, 'request_reservation_micro_usd': 100},
                'commands': {s: {**cmd, 'stage': s} for s in ('reset', 'actor', 'evaluate', 'cleanup')}}
            store = Store(str(Path(tmp) / 'ledger.sqlite'))
            op = bound_fixture(tmp, binding)
            store.enqueue([op])
            clock = [0.0]
            calls = []
            def invoke(command, payload, heartbeat):
                heartbeat()
                stage = command['stage']; calls.append(stage)
                out = receipt_identity(payload)
                if stage == 'reset': out.update(restored=True, baseline_sha256=payload['baseline_sha256'])
                elif stage == 'actor':
                    self.assertNotIn('evaluation_ref', payload)
                    out.update(terminal_status='completed', budget_met=True, action_count=2)
                    out.update(actor_override or {})
                    if delayed: clock[0] += 2
                elif stage == 'evaluate':
                    out.update(assessment_status='valid', native_score=1, verdict=None)
                    out.update(evaluator_override or {})
                else: out['cleaned'] = True
                if stage == wrong_stage: out[wrong_field] = 'OTHER_CELL'
                return out
            try:
                with patch('runtime_worker.time.monotonic', side_effect=lambda: clock[0]):
                    result = execute_one(store, binding, invoke)
                return result, store.summary(), calls
            finally: store.close()

    def test_timeout_cannot_be_rescued_by_late_native_score(self):
        result, ledger, calls = self.scenario({'terminal_status': 'timeout', 'budget_met': False})
        self.assertEqual(result['native_score'], 1)
        self.assertEqual(result['terminal_status'], 'timeout')
        self.assertFalse(result['protocol_completed'])
        self.assertFalse(result['budget_met'])
        self.assertEqual(ledger['states'], {'terminal': 1})
        self.assertEqual(calls, ['reset', 'actor', 'evaluate', 'cleanup'])

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
            for field in ('opportunity_id', 'environment_id', 'configuration_sha256', 'lease_token', 'task_manifest_sha256'):
                with self.subTest(stage=stage, field=field):
                    result, ledger, _ = self.scenario(wrong_stage=stage, wrong_field=field)
                    self.assertEqual(ledger['states'], {'uncertain': 1})
                    if stage != 'cleanup':
                        self.assertIsNone(result['native_score'])
                        self.assertEqual(result['assessment_status'], 'unresolved')
                    else: self.assertEqual(result['cleanup_status'], 'unverified')

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

    def test_wrong_oracle_reference_or_bytes_are_quarantined(self):
        for field in ('evaluation_ref', 'evaluation_sha256'):
            result, ledger, _ = self.scenario(evaluator_override={field: 'WRONG'})
            self.assertEqual(result['terminal_status'], 'evaluator-error')
            self.assertIsNone(result['native_score'])
            self.assertEqual(ledger['states'], {'uncertain': 1})


if __name__ == '__main__': unittest.main()
