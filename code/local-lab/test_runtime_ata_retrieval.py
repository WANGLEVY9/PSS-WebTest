import json
import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import retrieve_ata_postmill as retrieval


class RetrievalGuards(unittest.TestCase):
    def test_no_optin_no_directory_or_download(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'new'
            r=subprocess.run([sys.executable,retrieval.__file__,'--output',str(output)],capture_output=True,text=True)
            self.assertEqual(r.returncode,0);self.assertFalse(output.exists())

    def test_low_capacity_stops_before_download(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'new'
            with patch.object(sys,'argv',['test','--output',str(output),'--download']), \
                 patch.object(retrieval.shutil,'disk_usage',return_value=SimpleNamespace(free=0)), \
                 patch.object(retrieval.subprocess,'run') as call:
                with self.assertRaises(ValueError):retrieval.main()
                call.assert_not_called();self.assertFalse(output.exists())

    def test_synthetic_archive_checksum_required_before_rename(self):
        # Tiny local control only: no downloaded image or benchmark execution.
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'new'
            def fake_download(command,**kwargs):
                (output/'postmill.tar.part').write_bytes(b'tar')
                return SimpleNamespace(returncode=0)
            with patch.object(sys,'argv',['test','--output',str(output),'--download']), \
                 patch.object(retrieval,'SIZE',3),patch.object(retrieval,'SHA1',hashlib.sha1(b'tar').hexdigest()), \
                 patch.object(retrieval.shutil,'disk_usage',return_value=SimpleNamespace(free=10**12)), \
                 patch.object(retrieval.subprocess,'run',side_effect=fake_download):retrieval.main()
            report=json.loads((output/'retrieval-report.json').read_bytes())
            self.assertTrue(report['verified']);self.assertFalse(report['image_loaded'])
            self.assertEqual(report['benchmark_executions'],0)
            self.assertEqual(report['sha256'],hashlib.sha256(b'tar').hexdigest())

if __name__=='__main__':unittest.main()
