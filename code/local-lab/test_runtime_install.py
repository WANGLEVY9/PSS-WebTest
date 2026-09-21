"""Installer planning tests; no package installation or network."""
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from bootstrap_sponsor_framework import plan_install


class InstallTests(unittest.TestCase):
    def test_explicit_browser_provisioning_requires_pinned_playwright(self):
        with tempfile.TemporaryDirectory() as tmp:
            lock=Path(tmp)/'lock';lock.write_text('agentlab==0.4.2\n')
            with self.assertRaisesRegex(ValueError,'playwright'):
                plan_install('agentlab',lock,hashlib.sha256(lock.read_bytes()).hexdigest(),Path(tmp)/'new',sys.executable,sys.executable,install_browser=True)
            lock.write_text('agentlab==0.4.2\nplaywright==1.44.0\n')
            result=plan_install('agentlab',lock,hashlib.sha256(lock.read_bytes()).hexdigest(),Path(tmp)/'new',sys.executable,sys.executable,install_browser=True)
            self.assertEqual(result['commands'][-1][1:],['-m','playwright','install','chromium'])

    def test_reviewed_lock_plan_never_claims_host_install(self):
        with tempfile.TemporaryDirectory() as tmp:
            lock = Path(tmp)/'lock'
            lock.write_text('agentlab==0.4.2\n')
            sha = hashlib.sha256(lock.read_bytes()).hexdigest()
            report = plan_install('agentlab', lock, sha, Path(tmp)/'new', sys.executable, sys.executable, system='Darwin', machine='arm64')
            self.assertFalse(report['native_host'])
            self.assertFalse(report['confirmatory_authorized'])
            self.assertFalse((Path(tmp)/'new').exists())

    def test_macos_lock_and_changed_lock_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            lock = Path(tmp)/'lock'
            lock.write_text('browser-use==0.13.10\npyobjc-core==12.2.2\n')
            sha = hashlib.sha256(lock.read_bytes()).hexdigest()
            with self.assertRaisesRegex(ValueError, 'macOS-only'):
                plan_install('browser-use', lock, sha, Path(tmp)/'new', sys.executable, sys.executable)
            with self.assertRaisesRegex(ValueError, 'drift'):
                plan_install('browser-use', lock, 'a'*64, Path(tmp)/'new', sys.executable, sys.executable)


if __name__ == '__main__': unittest.main()
