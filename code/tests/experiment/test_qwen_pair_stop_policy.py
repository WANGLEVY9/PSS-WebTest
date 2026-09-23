"""Fail-closed dispatch policy for bounded Qwen WAV diagnostic jobs."""

import ast
import importlib.util
from pathlib import Path
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location(
    "run_wav_qwen_pair",
    Path(__file__).resolve().parents[2] / "experiment" / "run_wav_qwen_pair.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class StopPolicyTests(unittest.TestCase):
    def report(self, **overrides):
        return {"owned_cleanup_completed": True, "assessment_status": "valid", **overrides}

    def test_native_task_failure_is_not_an_infrastructure_stop(self):
        self.assertIsNone(MODULE.issue(self.report(actor_status="failed", failure_class="action-budget-exhausted"), 0))

    def test_invalid_model_action_is_kept_and_dispatch_continues(self):
        self.assertIsNone(MODULE.issue(self.report(actor_status="invalid-action", failure_class="invalid-model-action"), 0))

    def test_unattributed_execution_error_stops(self):
        self.assertEqual(MODULE.issue(self.report(actor_status="execution-error", failure_class="ValueError"), 0),
                         "unattributed-actor-execution-error")

    def test_provider_or_cleanup_error_stops(self):
        self.assertEqual(MODULE.issue(self.report(failure_class="provider-timeout"), 0), "provider-timeout")
        self.assertEqual(MODULE.issue(self.report(owned_cleanup_completed=False), 0),
                         "cleanup-or-native-evaluation-unverified")

    def test_source_gate_excludes_unrelated_files_but_detects_runtime_drift(self):
        code = Path(__file__).resolve().parents[2]
        tree = ast.parse((code / "experiment" / "run_wav_qwen_pair.py").read_text())
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "source_fingerprint")
        names = next(ast.literal_eval(n.value) for n in function.body
                     if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "names" for t in n.targets))
        with tempfile.TemporaryDirectory() as root:
            fixture = Path(root)
            lab = fixture / "experiment"
            lab.mkdir()
            for name in names:
                (lab / name).write_bytes((code / "experiment" / name).read_bytes())
            original = MODULE.source_fingerprint(fixture)
            (lab / "unrelated-new-tool.mjs").write_text("export const probe = true;\n")
            self.assertEqual(MODULE.source_fingerprint(fixture), original)
            (lab / "provider.mjs").write_bytes((lab / "provider.mjs").read_bytes() + b"\n")
            self.assertNotEqual(MODULE.source_fingerprint(fixture), original)


if __name__ == "__main__":
    unittest.main()
