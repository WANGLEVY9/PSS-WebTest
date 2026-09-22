import subprocess
import sys
import tempfile
from pathlib import Path
import unittest

class OfficialProbeGuards(unittest.TestCase):
    def command(self,output):
        return [sys.executable,str(Path(__file__).with_name('wav_official_acceptance_probe.py')),
            '--framework','agentlab-browsergym','--mode','visual','--manifest','absent',
            '--manifest-sha256','absent','--peer-proof','absent','--peer-proof-sha256','absent',
            '--bindings','absent','--output',str(output),'--port-base','18170']
    def test_no_optin_does_not_read_missing_evidence_or_create_fixture(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'not-created';r=subprocess.run(self.command(output),capture_output=True,text=True,timeout=20)
            self.assertEqual(r.returncode,0,r.stderr);self.assertIn('No execution',r.stdout);self.assertFalse(output.exists())
    def test_missing_evidence_fails_before_creating_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'not-created';r=subprocess.run(self.command(output)+['--live'],capture_output=True,text=True,timeout=20)
            self.assertNotEqual(r.returncode,0);self.assertFalse(output.exists())

if __name__=='__main__':unittest.main()
