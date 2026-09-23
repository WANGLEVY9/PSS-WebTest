"""Fast, offline guard against interpreter/framework mismatch before reset."""
import importlib.metadata
import unittest
from unittest.mock import patch

from wav_official_acceptance_probe import require_framework_environment


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


if __name__ == '__main__':
    unittest.main()
