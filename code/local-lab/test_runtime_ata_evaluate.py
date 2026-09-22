"""Published artifact / synthetic prediction controls; not live ATA runs."""
import json
from pathlib import Path
import unittest
import tempfile
from ata_native_evaluate import parse_prediction,score_reference,verify_source,ARCHIVE_SHA256,evaluate,SCHEMA
from ata_mapping import parser
from benchmark_actor_lifecycle import persist,encoded,seal_context
from journaled_browser import Journal

ROOT=Path(__file__).resolve().parents[1]/'artifacts/benchmark-snapshots'


class AtaReferenceTests(unittest.TestCase):
    def test_prediction_is_never_repaired_or_inferred(self):
        for raw in ('PASS','```json\n{}\n```','{"verdict":"pass","failure_step":null}',
                    '{"verdict":"FAIL","failure_step":true}',
                    '{"verdict":"PASS","failure_step":1}',
                    '{"verdict":null,"verdict":"PASS","failure_step":null}',
                    '{"verdict":"PASS","failure_step":null,"gold":"PASS"}'):
            with self.subTest(raw=raw):self.assertEqual(parse_prediction(raw)['prediction_status'],'malformed')
        self.assertEqual(parse_prediction(None)['prediction_status'],'missing')
        self.assertEqual(parse_prediction('{"verdict":null,"failure_step":null}')['prediction_status'],'abstained')

    def test_confusion_classes_and_localization(self):
        case={'label':'F','steps':[{'step':1},{'step':2},{'step':3}],'failures':[{'step':2}]}
        for step,label in ((1,'AFB'),(2,'AFC'),(3,'AFA'),(None,'Ustep')):
            out=score_reference(case,parse_prediction(json.dumps({'verdict':'FAIL','failure_step':step})))
            self.assertEqual(out['confusion_class'],'TP');self.assertEqual(out['step_class'],label)
        for gold,pred,label in (('F','PASS','FN'),('P','FAIL','FP'),('P','PASS','TN')):
            out=score_reference({**case,'label':gold},parse_prediction(json.dumps({'verdict':pred,'failure_step':None})))
            self.assertEqual(out['confusion_class'],label)
            self.assertEqual(out['verdict_correctness'],int(label=='TN'))
        self.assertIsNone(score_reference(case,parse_prediction(None))['verdict_correctness'])

    def test_ambiguous_source_steps_are_not_renumbered(self):
        case={'label':'F','steps':[{'step':1},{'step':1}],'failures':[{'step':1}]}
        out=score_reference(case,parse_prediction('{"verdict":"FAIL","failure_step":1}'))
        self.assertEqual(out['verdict_correctness'],1)
        self.assertEqual(out['step_assessment_status'],'ambiguous-source-step-labels')
        self.assertIsNone(out['strict_step_correctness'])

    @unittest.skipUnless((ROOT/'ISSTA_ARTEFACT.zip').exists(),'Requires checksum-pinned published ATA archive')
    def test_actual_published_source_and_all_113_reference_rows(self):
        source=ROOT/'ata-zenodo/ISSTA_ARTEFACT'
        catalog,hashes=verify_source({'artifact_root':str(source),'source_archive_ref':{
            'file':str(ROOT/'ISSTA_ARTEFACT.zip'),'sha256':ARCHIVE_SHA256}})
        self.assertEqual(len(catalog['cases']),113);self.assertIn('pinata/evaluation.py',hashes)
        seen=0
        for file in catalog['files']:
            for case in parser.parse_file(source/'benchmark'/file['file']):
                for verdict in ('PASS','FAIL',None):
                    out=score_reference(case,parse_prediction(json.dumps({'verdict':verdict,'failure_step':None})))
                    self.assertEqual(out['verdict'],verdict)
                    self.assertEqual(out['verdict_correctness'],None if verdict is None else int(verdict=={'P':'PASS','F':'FAIL'}[case['label']]))
                seen+=1
        self.assertEqual(seen,113)

    @unittest.skipUnless((ROOT/'ISSTA_ARTEFACT.zip').exists(),'Requires checksum-pinned published ATA archive')
    def test_complete_reference_adapter_with_synthetic_sealed_predictions(self):
        source=ROOT/'ata-zenodo/ISSTA_ARTEFACT'
        manifest={'schema':SCHEMA,'scope':'synthetic','artifact_root':str(source),
            'source_archive_ref':{'file':str(ROOT/'ISSTA_ARTEFACT.zip'),'sha256':ARCHIVE_SHA256}}
        catalog,_=verify_source(manifest);official=catalog['cases'][0]
        case=next(c for c in parser.parse_file(source/'benchmark'/official['source_file']) if c['task_id']==official['source_task_id'])
        with tempfile.TemporaryDirectory(prefix='pss-ata-evaluator-control-') as tmp:
            root=Path(tmp)
            manifest['private_artifact_root']=str(root/'private')
            mref=persist(root/'manifest.json',encoded(manifest))
            gold={'benchmark':'ata','official_task_id':case['task_id'],'application':case['site'],
                'source_sha256':official['source_sha256'],'expected':official['expected'],
                'failures':case['failures'],'source_line':case['source_line'],
                'evaluator_status':'reference-labels-only-live-parity-not-verified'}
            gref=persist(root/'gold.json',encoded(gold))
            for index,raw in enumerate((json.dumps({'verdict':official['expected'],'failure_step':None}),'invalid',None)):
                journal=Journal(root/f'actor-{index}')
                identity={'opportunity_id':f'SYNTHETIC-{index}','environment_id':'offline-fixture','configuration_sha256':'a'*64,
                    'scope':'synthetic','data_kind':'SYNTHETIC_TEST'}
                actor={**identity,'final_answer':raw,'trajectory_directory':str(journal.directory)}
                journal.event('actor-start');journal.event('actor-end',receipt=actor)
                persist(journal.directory/'network.har',encoded({'log':{'entries':[]}}))
                class SyntheticClose:
                    def on(self,event,callback):self.callback=callback
                    def close(self):self.callback()
                envelope=seal_context(SyntheticClose(),journal,actor,'synthetic')
                payload={**identity,**envelope,'evaluation_ref':gref}
                result=evaluate(payload,mref)
                self.assertEqual(result['assessment_status'],'valid')
                self.assertEqual(result['verdict_correctness'],1 if index==0 else None)
                self.assertFalse(result['live_fixture_label_parity_verified'])
                self.assertIsNone(result['operational_correctness'])
                self.assertNotIn('reference_verdict',result)
                with self.assertRaises(ValueError):evaluate({**payload,'opportunity_id':'other'},mref)


if __name__=='__main__':unittest.main()
