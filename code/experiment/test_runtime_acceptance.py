"""Synthetic acceptance-report checks, never actual benchmark admission."""
import json
from pathlib import Path
import tempfile
import unittest
from benchmark_acceptance import audit, CHECKS
from prepare_official_runtime import save
from runtime_worker import verify_native_endpoint, AdapterReceiptError


class AcceptanceTests(unittest.TestCase):
    def test_native_metrics_are_not_interchangeable(self):
        for benchmark in ('wav', 'vwa'):
            verify_native_endpoint(benchmark, {'assessment_status': 'valid', 'native_score': 1, 'verdict': None})
            with self.assertRaises(AdapterReceiptError):
                verify_native_endpoint(benchmark, {'assessment_status': 'valid', 'native_score': None, 'verdict': 'PASS'})
        verify_native_endpoint('ata', {'assessment_status': 'valid', 'native_score': None, 'verdict': 'FAIL', 'step_class': 'AFB'})
        with self.assertRaises(AdapterReceiptError):
            verify_native_endpoint('ata', {'assessment_status': 'valid', 'native_score': 1, 'verdict': 'PASS'})

    def test_structurally_complete_receipt_still_requires_review_and_detects_peer_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            artifact = Path(tmp)/'synthetic-evidence.json'
            hashed = save(artifact, {'SYNTHETIC_TEST': True})
            evidence = {'status': 'passed', 'artifacts': [{'file': str(artifact), 'sha256': hashed}]}
            identity = {'protocol_id': 'pss-manuscript-v2.1', 'host_id': 'fixture', 'campaign_id': 'synthetic'}
            receipt = {**identity, 'receipt_id': 'unit-fixture', 'benchmark': 'wav', 'profile': 'playwright',
                'data_kind': 'MEASURED', 'strict_success_required_for_admission': False,
                'checks': {k: evidence for k in CHECKS},
                'evaluator_controls': {'positive': 'correct', 'negative': 'incorrect', 'malformed': 'unresolved'},
                'reset_cycles': [{'baseline_sha256': 'a'*64, 'mutated_sha256': 'b'*64, 'after_reset_sha256': 'a'*64,
                                  'fresh_agent_context': True, 'peers': [{'environment_id': 'peer', 'before_sha256': 'c'*64, 'after_sha256': 'c'*64}]} for _ in range(2)]}
            def check(value, name):
                file = Path(tmp)/name
                sha = save(file, value)
                return audit({'schema': 'pss-benchmark-acceptance-v1', **identity, 'receipts': [{'file': str(file), 'sha256': sha}]})
            result = check(receipt, 'receipt.json')
            self.assertEqual(result['ready_cells'], 0)
            self.assertIn('full-cross-instance-content-proof-missing-or-invalid',
                          next(c for c in result['cells'] if c['profile']=='playwright' and c['benchmark']=='wav')['errors'])
            # Artificial byte-level sequence ONLY for verifier regression. This
            # never runs a fixture or exports an actual acceptance receipt.
            from test_runtime_isolation_evidence import IsolationEvidenceTests
            synthetic=IsolationEvidenceTests();synthetic.setUp();self.addCleanup(synthetic.doCleanups)
            proof={**synthetic.package,**identity,'benchmark':'wav','profile':'playwright',
                   'data_kind':'MEASURED','scope':'diagnostic'}
            p=Path(tmp)/'synthetic-isolation.json';h=save(p,proof)
            receipt['cross_instance_isolation_ref']={'file':str(p),'sha256':h}
            self.assertEqual(check(receipt,'with-content.json')['ready_cells'],1)
            self.assertFalse(result['confirmatory_authorized'])
            receipt['reset_cycles'][0]['peers'][0]['after_sha256'] = 'd'*64
            self.assertEqual(check(receipt, 'peer-drift.json')['ready_cells'], 0)

    def test_empty_campaign_has_twelve_blocked_cells_not_vacuous_success(self):
        report = audit({'schema': 'pss-benchmark-acceptance-v1', 'protocol_id': 'pss-manuscript-v2.1', 'campaign_id': 'synthetic', 'host_id': 'fixture', 'receipts': []})
        self.assertEqual(report['ready_cells'], 0)
        self.assertEqual(len(report['cells']), 12)
        self.assertFalse(report['confirmatory_authorized'])

    def test_cross_host_and_synthetic_receipts_never_admit(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'receipt.json'
            hashed = save(p, {'receipt_id': '1', 'benchmark': 'ata', 'profile': 'playwright', 'data_kind': 'SYNTHETIC_TEST', 'host_id': 'other'})
            result = audit({'schema': 'pss-benchmark-acceptance-v1', 'protocol_id': 'pss-manuscript-v2.1', 'campaign_id': 'synthetic', 'host_id': 'fixture', 'receipts': [{'file': str(p), 'sha256': hashed}]})
            self.assertEqual(result['ready_cells'], 0)

    def test_pinned_receipt_mutation_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/'receipt.json'
            hashed = save(p, {'receipt_id': '1'})
            p.write_text('{}')
            with self.assertRaisesRegex(ValueError, 'source drift'):
                audit({'schema': 'pss-benchmark-acceptance-v1', 'protocol_id': 'pss-manuscript-v2.1', 'campaign_id': 'synthetic', 'host_id': 'fixture', 'receipts': [{'file': str(p), 'sha256': hashed}]})


if __name__ == '__main__': unittest.main()
