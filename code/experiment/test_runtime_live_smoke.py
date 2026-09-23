"""Offline guards for the opt-in live component control (no model requests)."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class LiveControlGuards(unittest.TestCase):
    def test_no_optin_has_no_side_effects_or_paid_requests(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'must-not-exist'
            result=subprocess.run([sys.executable,str(Path(__file__).with_name('lifecycle-live-smoke.py')),
                '--framework','agentlab-browsergym','--mode','visual','--output',str(output)],
                capture_output=True,text=True,timeout=20)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertIn('No execution',result.stdout)
            self.assertFalse(output.exists())

    def test_incompatible_framework_refused_before_fixture_or_api(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'must-not-exist'
            result=subprocess.run([sys.executable,str(Path(__file__).with_name('lifecycle-live-smoke.py')),
                '--framework','browser-use-restricted','--mode','visual','--output',str(output),'--live'],
                capture_output=True,text=True,timeout=20)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('Explicit compatible framework/mode required',result.stderr)
            self.assertFalse(output.exists())


if __name__=='__main__':unittest.main()
