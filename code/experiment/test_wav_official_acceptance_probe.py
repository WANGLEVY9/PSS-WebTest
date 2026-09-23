"""Fast, offline guard against interpreter/framework mismatch before reset."""
import importlib.metadata
import unittest
from unittest.mock import patch

from wav_official_acceptance_probe import require_framework_environment, require_provider_budget


class FrameworkEnvironmentTests(unittest.TestCase):
    def test_browser_use_is_refused_when_invoked_from_agentlab_environment(self):
        def version(name):
            if name == 'browser-use':
                raise importlib.metadata.PackageNotFoundError(name)
            return 'installed'

        with patch('wav_official_acceptance_probe.importlib.metadata.version', side_effect=version):
            with self.assertRaisesRegex(ValueError, 'browser-use'):
                require_framework_environment('browser-use-restricted')

    def test_matching_browser_use_environment_passes(self):
        with patch('wav_official_acceptance_probe.importlib.metadata.version', return_value='installed'):
            require_framework_environment('browser-use-restricted')

    def test_provider_variant_fails_before_fixture_when_spend_cap_is_insufficient(self):
        with patch('wav_official_acceptance_probe.subprocess.run') as run:
            run.return_value.returncode = 2
            with self.assertRaisesRegex(ValueError, 'spend policy'):
                require_provider_budget('qwen3.8-max', 4096, 45000)
            self.assertEqual(run.call_args.kwargs['env']['PSS_LOCAL_MAX_OUTPUT_TOKENS'], '4096')
            self.assertEqual(run.call_args.kwargs['env']['PSS_PROBE_REQUEST_TIMEOUT_MS'], '45000')


if __name__ == '__main__':
    unittest.main()
