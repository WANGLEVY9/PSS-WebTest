"""Offline official-fixture controls, not agent or benchmark task executions."""
import copy
import importlib.util
import io
import json
import logging
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from wav_native_evaluate import evaluate, json_bytes, sha, SCHEMA, PINS, validate_identity, private_logging, verify_source
from benchmark_actor_lifecycle import seal_context
from journaled_browser import Journal

CODE = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get('PSS_WAV_SOURCE',str(CODE / 'artifacts/benchmark-snapshots/webarena-verified'))).resolve()
HAS_NATIVE = importlib.util.find_spec('webarena_verified') is not None and SOURCE.exists()


class EnvelopeTests(unittest.TestCase):
    def test_missing_identity_and_repaired_answer_objects_rejected(self):
        identity = {'opportunity_id':'synthetic', 'environment_id':'fixture', 'configuration_sha256':'a'*64}
        for value in (None, {}, {**identity, 'actor_result':{**identity, 'final_answer':{}}},
                      {**identity, 'actor_result':{**identity, 'opportunity_id':'another', 'final_answer':''}}):
            with self.assertRaises(ValueError):
                validate_identity(value)

    def test_logs_are_private_and_previous_handlers_restored(self):
        public,private=io.StringIO(),io.StringIO()
        logger=logging.getLogger('webarena_verified.synthetic')
        handler=logging.StreamHandler(public)
        old_handlers,old_propagate=list(logger.handlers),logger.propagate
        try:
            logger.handlers=[handler];logger.propagate=False
            with private_logging(private):logger.warning('private control message')
            self.assertEqual(public.getvalue(),'')
            self.assertIn('private control message',private.getvalue())
            self.assertEqual(logger.handlers,[handler])
        finally:
            logger.handlers,logger.propagate=old_handlers,old_propagate


@unittest.skipUnless(HAS_NATIVE, 'Run with .venv-benchmark and pinned official WAV checkout')
class NativeWavTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='pss-wav-evaluator-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.count = 0
        self.dataset = SOURCE / 'assets/dataset/webarena-verified.json'
        self.rows = json.loads(self.dataset.read_bytes())
        self.row = next(row for row in self.rows if row['task_id'] == 22)
        self.identity = {'opportunity_id':'SYNTHETIC_CONTROL_22', 'environment_id':'offline-fixture',
                         'configuration_sha256':'a'*64}
        config = {'test_data_file':str(self.dataset),
                  'environments':{'__SHOPPING__':{'urls':['http://localhost:7770']}}}
        self.manifest = {'schema':SCHEMA, 'scope':'synthetic', 'source_dir':str(SOURCE),
            'source_commit':PINS['wav'], 'source_dataset_sha256':sha(self.dataset.read_bytes()),
            'environment_config_ref':self.write('config',config),
            'network_trace_root':str(self.root), 'private_artifact_root':str(self.root/'private')}
        self.gold = {'benchmark':'wav', 'official_task_id':'22', 'application':'+'.join(self.row['sites']),
            'source_sha256':sha(self.dataset.read_bytes()), 'source_commit':PINS['wav'], 'official_config':self.row}
        self.payload = {**self.identity, 'scope':'synthetic','data_kind':'SYNTHETIC_TEST',
            'evaluation_ref':self.write('gold',self.gold),
            'actor_result':{**self.identity, 'final_answer':json.dumps({'task_type':'RETRIEVE',
                'status':'NOT_FOUND_ERROR','retrieved_data':[]})}}
        self.payload=self.bind_synthetic_lifecycle(self.payload)
        self.har=Path(self.payload['actor_result']['trajectory_directory'])/'network.har'

    def bind_synthetic_lifecycle(self,payload):
        # Offline evaluator fixture only. This fake close event is deliberately
        # SYNTHETIC, never a real browser/reset/isolation attestation. The sibling
        # Chromium integration suite separately checks actual context.close().
        self.count+=1
        journal=Journal(self.root/f'actor-{self.count}')
        (journal.directory/'network.har').write_bytes((SOURCE/'tests/assets/network.har').read_bytes())
        actor={**payload['actor_result'],'trajectory_directory':str(journal.directory),
               'scope':'synthetic','data_kind':'SYNTHETIC_TEST'}
        journal.event('actor-start',scope='synthetic',data_kind='SYNTHETIC_TEST')
        journal.event('actor-end',receipt=actor)
        class SyntheticClose:
            def on(self,event,callback):self.callback=callback
            def close(self):self.callback()
        envelope=seal_context(SyntheticClose(),journal,actor,'synthetic')
        return {**payload,**envelope}

    def write(self,name,value):
        self.count += 1
        path = self.root / f'{name}-{self.count}.json'
        raw = json_bytes(value)
        path.write_bytes(raw)
        return {'file':str(path), 'sha256':sha(raw)}

    def run_native(self,payload=None,manifest=None):
        # If an upstream code path unexpectedly attempts networking, this test
        # fails. No evaluator methods or native result classes are substituted.
        with patch.object(socket.socket, 'connect', side_effect=AssertionError('Network forbidden in offline control')):
            return evaluate(payload or self.payload, self.write('manifest',manifest or self.manifest))

    def test_real_api_success_failure_and_error_keep_native_semantics(self):
        controls = [('NOT_FOUND_ERROR', [], 'success', 1), ('SUCCESS', [], 'failure', 0),
                    ('SUCCESS', ['synthetic-incorrect-answer'], 'error', None)]
        for status,data,expected,score in controls:
            with self.subTest(status=status,data_shape=len(data)):
                payload=copy.deepcopy(self.payload)
                payload['actor_result']['final_answer']=json.dumps({'task_type':'RETRIEVE','status':status,'retrieved_data':data})
                payload=self.bind_synthetic_lifecycle(payload)
                receipt=self.run_native(payload)
                self.assertEqual(receipt['official_status'],expected)
                self.assertEqual(receipt['native_score'],score)
                self.assertEqual(receipt['assessment_status'],'unresolved' if score is None else 'valid')
                self.assertFalse(receipt['confirmatory_authorized'])
                self.assertEqual(receipt['data_kind'],'SYNTHETIC_TEST')
                self.assertEqual(receipt['actor_lifecycle_ref'],payload['actor_lifecycle_ref'])
                self.assertEqual(receipt['network_trace_ref']['sha256'],receipt['source_network_trace_sha256'])
                result=json.loads(Path(receipt['native_result_ref']['file']).read_bytes())
                self.assertEqual(result['status'],expected)
                self.assertEqual(sha(Path(receipt['native_result_ref']['file']).read_bytes()),receipt['native_result_ref']['sha256'])
                self.assertEqual(result['webarena_verified_data_checksum'],self.manifest['source_dataset_sha256'])
                self.assertNotIn('evaluators_results',receipt)
                self.assertNotIn('expected',receipt)
                for key in ('native_result_ref','native_log_ref','network_trace_ref','actor_answer_ref'):
                    self.assertEqual(stat.S_IMODE(Path(receipt[key]['file']).stat().st_mode),0o600)

    def test_answer_text_not_repaired_and_none_preserved(self):
        for text in ('```json\n{}\n```', 'not-json', None):
            payload=copy.deepcopy(self.payload)
            payload['actor_result']['final_answer']=text
            payload=self.bind_synthetic_lifecycle(payload)
            receipt=self.run_native(payload)
            answer=json.loads(Path(receipt['actor_answer_ref']['file']).read_bytes())
            self.assertEqual(answer['final_answer'],text)
            self.assertNotEqual(receipt['official_status'],'success')

    def test_task_source_identity_and_gold_config_tampering_rejected(self):
        for field,value in [('official_task_id','23'),('source_commit','0'*40),('source_sha256','0'*64),
                            ('benchmark','vwa'),('application','reddit'),('official_config',{})]:
            gold={**self.gold,field:value}
            payload={**self.payload,'evaluation_ref':self.write('tampered',gold)}
            with self.subTest(field=field),self.assertRaises(ValueError):
                self.run_native(payload)

    def test_config_cannot_use_fallback_or_alternate_dataset(self):
        for config in ({'environments':{}},{'test_data_file':'/absent/dataset.json'},
                       {'test_data_file':'relative/path.json'}):
            manifest={**self.manifest,'environment_config_ref':self.write('badconfig',config)}
            with self.assertRaises(ValueError):self.run_native(manifest=manifest)

    def test_formal_scope_wrong_source_and_hash_drift_rejected(self):
        for field,value in [('scope','confirmatory'),('source_commit','0'*40),('source_dataset_sha256','0'*64)]:
            with self.subTest(field=field),self.assertRaises(ValueError):
                self.run_native(manifest={**self.manifest,field:value})
        self.har.write_bytes(b'changed')
        with self.assertRaises(ValueError):self.run_native()

    def test_worker_actor_and_manifest_provenance_cannot_be_mixed(self):
        for update in ({'scope':'diagnostic','data_kind':'MEASURED'},
                       {'scope':'synthetic','data_kind':'MEASURED'},
                       {'scope':None}):
            with self.subTest(update=update),self.assertRaises(ValueError):
                self.run_native({**self.payload,**update})
        changed={**self.payload,'actor_result':{**self.payload['actor_result'],'scope':'diagnostic','data_kind':'MEASURED'}}
        with self.assertRaises(ValueError):self.run_native(changed)
        with self.assertRaises(ValueError):
            self.run_native(manifest={**self.manifest,'scope':'diagnostic'})

    def test_trace_outside_declared_root_rejected(self):
        with self.assertRaises(ValueError):
            self.run_native(manifest={**self.manifest,'network_trace_root':str(self.root/'unrelated')})

    def test_imported_package_byte_drift_rejected(self):
        import webarena_verified
        target=Path(webarena_verified.__file__).resolve()
        original=Path.read_bytes
        def changed(path):
            raw=original(path)
            return raw+b'\n# SYNTHETIC_BYTE_DRIFT\n' if path==target else raw
        with patch.object(Path,'read_bytes',changed),self.assertRaises(ValueError):
            verify_source(SOURCE)

    def test_missing_trace_and_public_output_directory_rejected(self):
        payload={**self.payload}
        payload.pop('actor_lifecycle_ref')
        with self.assertRaises(ValueError):self.run_native(payload)
        public=self.root/'public';public.mkdir(mode=0o755)
        os.chmod(public,0o755)
        with self.assertRaises(ValueError):
            self.run_native(manifest={**self.manifest,'private_artifact_root':str(public)})

    def test_repeated_attempts_append_do_not_overwrite(self):
        first,second=self.run_native(),self.run_native()
        self.assertNotEqual(first['native_result_ref']['file'],second['native_result_ref']['file'])
        self.assertTrue(Path(first['native_result_ref']['file']).exists())

    def test_cli_returns_only_public_receipt(self):
        ref=self.write('manifest',self.manifest)
        result=subprocess.run([sys.executable,str(Path(__file__).with_name('wav_native_evaluate.py')),
            '--manifest',ref['file'],'--manifest-sha256',ref['sha256']],input=json.dumps(self.payload),
            text=True,capture_output=True,check=True)
        receipt=json.loads(result.stdout)
        self.assertEqual(receipt['official_task_id'],'22')
        self.assertNotIn('evaluators_results',result.stdout)
        self.assertEqual(result.stderr,'')


if __name__=='__main__':unittest.main()
