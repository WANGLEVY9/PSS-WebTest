"""Synthetic task binding attacks; no benchmark results or external calls."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from runtime_inputs import task_projection, verify_bound_input, materialize_actor_input
from runtime_store import digest
from bind_runtime_plan import frozen_plan, bind
from framework_boundary import project_observation


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


class BindingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / 'official-fixture.json'
        self.source.write_text('{"fixture":"SYNTHETIC_TEST_NOT_BENCHMARK"}')
        self.input = self.root / 'actor.json'
        self.input.write_text(json.dumps({'schema': 'pss-official-task-input-v1', 'benchmark': 'wav', 'intent': 'Synthetic fixture', 'task_images': []}))
        self.task = {'task_key': 'wav:synthetic:1', 'benchmark': 'wav', 'official_task_id': '1', 'application': 'synthetic',
                     'source_sha256': sha(self.source.read_bytes()), 'template_id': 1, 'agent_input_sha256': sha(self.input.read_bytes())}
        evaluator = self.root / 'evaluator.json'
        evaluator.write_text(json.dumps({**self.task, 'gold': 'EVALUATOR_ONLY_SENTINEL'}))
        adapter = self.root / 'adapter.py'
        adapter.write_text('# SYNTHETIC_TEST\n')
        cmd = {'argv': [sys.executable, str(adapter)], 'source': str(adapter), 'sha256': sha(adapter.read_bytes()), 'timeout_ms': 1000}
        config_id = 'v1'
        framework = 'playwright' if config_id == 's' else 'browser-use-restricted' if config_id.startswith('u') else 'agentlab-browsergym'
        self.binding = {'config_id': config_id, 'framework': framework, 'framework_revision': 'fixture',
                        'configuration_sha256': 'a'*64, 'boundary_audit_sha256': 'b'*64, 'baseline_sha256': 'c'*64,
                        'environment_id': 'fixture', 'model_binding': {'provider': 'fixture', 'model': 'fixture'},
                        'budget': {'task_timeout_ms': 1000, 'max_actions': 3}, 'sdk_max_retries': 0,
                        'cost_policy': {'cap_micro_usd': 100, 'request_reservation_micro_usd': 1},
                        'commands': {k: cmd for k in ('reset', 'actor', 'evaluate', 'cleanup')}}
        self.task.update(evaluation_sha256=sha(evaluator.read_bytes()),
                         evaluation_ref_sha256=digest({'file': str(evaluator), 'sha256': sha(evaluator.read_bytes())}))
        bundle = {'protocol_id': 'pss-manuscript-v2.1', 'scope': 'synthetic', 'tasks': [self.task], 'bindings': {'configurations': {'v1': {'executor_binding_sha256_by_benchmark': {'wav': digest(self.binding)}}}}}
        input_bundle = self.root / 'bundle.json'
        input_bundle.write_text(json.dumps(bundle))
        out = self.root / 'plan'
        subprocess.run(['node', str(Path(__file__).resolve().parent.parent / 'analysis/study-workflow.mjs'), 'plan', str(input_bundle), str(out)], check=True, capture_output=True)
        self.freeze_file = out / 'schedule-freeze.json'
        self.freeze_sha = sha(self.freeze_file.read_bytes())
        self.plan_file = out / 'opportunities.jsonl'
        self.plan, self.freeze = frozen_plan(self.plan_file, self.freeze_file, self.freeze_sha)
        self.package = {'schedule_freeze_sha256': self.freeze_sha,
                        'tasks': {self.task['task_key']: {**self.task, 'source_file': str(self.source), 'agent_input_file': str(self.input),
                                  'evaluation_ref': {'file': str(evaluator), 'sha256': sha(evaluator.read_bytes())}}},
                        'executors': {self.binding['config_id']: {'wav': self.binding}}}

    def tearDown(self):
        self.temp.cleanup()

    def bound(self, package=None):
        return list(bind([p for p in self.plan if p['config_id']=='v1'][:1], package or self.package, self.freeze))[0]

    def test_js_export_to_python_hash_and_identity_roundtrip(self):
        self.assertEqual(len(self.plan), 19*12)
        op = self.bound()
        verify_bound_input(op)
        self.assertNotIn('EVALUATOR_ONLY', json.dumps(op['agent_input']))

    def test_changed_plan_or_freeze_bytes_rejected(self):
        self.plan_file.write_text(self.plan_file.read_text() + '\n')
        with self.assertRaisesRegex(ValueError, 'source drift'):
            frozen_plan(self.plan_file, self.freeze_file, self.freeze_sha)

    def test_wrong_task_source_and_unfrozen_input_rejected(self):
        for field, value in [('official_task_id', '2'), ('application', 'wrong'), ('source_sha256', 'f'*64), ('agent_input_sha256', 'f'*64)]:
            package = copy.deepcopy(self.package)
            package['tasks'][self.task['task_key']][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.bound(package)

    def test_another_valid_actor_file_cannot_be_substituted(self):
        self.input.write_text(json.dumps({'schema': 'pss-official-task-input-v1', 'benchmark': 'wav', 'intent': 'Wrong task', 'task_images': []}))
        self.package['tasks'][self.task['task_key']]['agent_input_sha256'] = sha(self.input.read_bytes())
        with self.assertRaisesRegex(ValueError, 'source drift'):
            self.bound()

    def test_wrong_evaluator_even_with_correct_file_hash_rejected(self):
        task = self.package['tasks'][self.task['task_key']]
        p = Path(task['evaluation_ref']['file'])
        p.write_text(json.dumps({**self.task, 'official_task_id': '2'}))
        task['evaluation_ref']['sha256'] = sha(p.read_bytes())
        with self.assertRaisesRegex(ValueError, 'another official task'):
            self.bound()

    def test_runtime_input_or_gold_drift_is_rejected_before_reset(self):
        op = self.bound()
        op['agent_input']['intent'] = 'modified'
        with self.assertRaisesRegex(ValueError, 'input drift'):
            verify_bound_input(op)
        op = self.bound()
        Path(op['evaluation_ref']['file']).write_text('{}')
        with self.assertRaisesRegex(ValueError, 'source drift'):
            verify_bound_input(op)

    def test_legacy_diagnostic_bypass_rejected(self):
        op = {**next(p for p in self.plan if p['config_id']=='v1'), 'scope': 'diagnostic'}
        with self.assertRaisesRegex(ValueError, 'schedule freeze'):
            list(bind([op], self.package))
        with self.assertRaisesRegex(ValueError, 'correspondence'):
            verify_bound_input(op)


class ProjectionTests(unittest.TestCase):
    def test_nested_gold_is_rejected_but_public_assertion_preserved(self):
        task = {'schema': 'pss-official-task-input-v1', 'benchmark': 'ata', 'intent': 'Synthetic', 'task_images': [],
                'steps': [{'step': 1, 'action': 'Click save', 'expectedResult': 'Show confirmation'}]}
        self.assertEqual(task_projection(task, 'ata')['steps'][0]['expectedResult'], 'Show confirmation')
        task['steps'][0]['expected_failure'] = True
        with self.assertRaises(ValueError):
            task_projection(task, 'ata')

    def test_vwa_missing_or_changed_task_image_not_silently_dropped(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/'img.png'
            p.write_bytes(b'\x89PNG\r\n\x1a\nSYNTHETIC')
            task = {'schema': 'pss-official-task-input-v1', 'benchmark': 'vwa', 'intent': 'Synthetic',
                    'task_images': [{'file': str(p), 'sha256': sha(p.read_bytes()), 'mime_type': 'image/png'}]}
            projected = task_projection(task, 'vwa')
            self.assertEqual(len(projected['task_images']), 1)
            self.assertNotIn('image_url', projected['task_images'][0])
            delivered = materialize_actor_input(projected)
            self.assertNotIn('file', delivered['task_images'][0])
            self.assertTrue(delivered['task_images'][0]['image_url'].startswith('data:image/png;base64,'))
            p.write_bytes(b'changed')
            with self.assertRaises(ValueError): task_projection(task, 'vwa')
            with self.assertRaises(ValueError): materialize_actor_input(projected)

    def test_visual_does_not_read_structural_fields_even_for_progress(self):
        class Poison(dict):
            def __getitem__(self, key):
                if key not in ('screenshot',): raise AssertionError(key)
                return super().__getitem__(key)
            def get(self, key, default=None):
                if key != 'action_error': raise AssertionError(key)
                return default
        out = project_observation(Poison(screenshot=b'pixels'), 'visual', {'intent': 'Synthetic'}, 0, [100, 100])
        self.assertNotIn('controls', out)

    def test_hybrid_visibility_raw_attributes_and_ids(self):
        control = {'role': 'button', 'name': 'Save', 'box': [0, 0, 20, 20], 'visible': True, 'in_viewport': True}
        raw = {'screenshot': b'pixels', 'visible_controls': [control, {**control, 'visible': False}]}
        a = project_observation(raw, 'hybrid', {'intent': 'Synthetic'}, 0, [100, 100])
        b = project_observation(raw, 'hybrid', {'intent': 'Synthetic'}, 1, [100, 100])
        self.assertEqual(len(a['controls']), 1)
        self.assertNotEqual(a['controls'][0]['target_id'], b['controls'][0]['target_id'])
        control['id'] = 'STABLE_APP_ID'
        with self.assertRaises(ValueError): project_observation(raw, 'hybrid', {'intent': 'Synthetic'}, 1, [100, 100])


if __name__ == '__main__': unittest.main()
