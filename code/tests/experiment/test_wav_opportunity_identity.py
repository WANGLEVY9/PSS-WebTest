"""A retry must not reuse the original attempt's shared spend-ledger identity."""

from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "experiment"))
from wav_official_acceptance_probe import opportunity_id


class OpportunityIdentityTests(unittest.TestCase):
    def test_same_job_in_new_batch_has_distinct_stable_identity(self):
        with tempfile.TemporaryDirectory() as root:
            first = Path(root) / "batch-a" / "10-qwen-max-274"
            retry = Path(root) / "batch-b" / "10-qwen-max-274"
            self.assertNotEqual(opportunity_id(first), opportunity_id(retry))
            self.assertEqual(opportunity_id(first), opportunity_id(first))


if __name__ == "__main__":
    unittest.main()
