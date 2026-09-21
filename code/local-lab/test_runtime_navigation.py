import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from prepare_navigation_runtime import split_public, image_refs
from benchmark_task_session import resolve_setup
from runtime_store import digest
import hashlib


class NavigationTests(unittest.TestCase):
    def test_setup_requires_fresh_full_closure_reset_and_auth(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            setup={'sites':['shopping','reddit'],'start_urls':['__SHOPPING__','__REDDIT__/r/test'],
                   'require_login':False,'geolocation':None}
            f=root/'setup.json';f.write_text(json.dumps(setup))
            ref={'file':str(f),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
            proof=root/'reset.json';proof.write_text('{}')
            op={'scope':'synthetic','opportunity_id':'op','environment_id':'env','configuration_sha256':'c'*64,
                'setup_ref':ref,'setup_binding_sha256':digest(ref)}
            reset={k:op[k] for k in ('opportunity_id','environment_id','configuration_sha256')}
            reset.update(restored=True,baseline_sha256='b'*64,closure_sites=['shopping','reddit'],
                         reset_evidence_ref={'file':str(proof),'sha256':hashlib.sha256(proof.read_bytes()).hexdigest()})
            routes={'__SHOPPING__':'http://localhost:7770','__REDDIT__':'http://localhost:9999'}
            result=resolve_setup(op,reset,'b'*64,routes)
            self.assertEqual(result['start_urls'],['http://localhost:7770','http://localhost:9999/r/test'])
            for bad in [{**reset,'restored':False},{**reset,'opportunity_id':'other'},
                        {**reset,'closure_sites':['shopping']},{**reset,'reset_evidence_ref':None}]:
                with self.assertRaises(ValueError):resolve_setup(op,bad,'b'*64,routes)
            with self.assertRaises(ValueError):resolve_setup(op,reset,'b'*64,{'__SHOPPING__':'http://localhost:7770'})
            setup['require_login']=True;f.write_text(json.dumps(setup));ref['sha256']=hashlib.sha256(f.read_bytes()).hexdigest()
            op['setup_binding_sha256']=digest(ref)
            with self.assertRaisesRegex(ValueError,'authentication'):resolve_setup(op,reset,'b'*64,routes)

    def test_wav_task_intent_unchanged_and_multiple_start_pages_private(self):
        t={'intent':'Official task','start_urls':['__SHOPPING__','__REDDIT__'],'sites':['shopping','reddit'],
           'eval':[{'expected':'SECRET'}],'reference_answer':'SECRET'}
        actor,setup=split_public(t,'wav',Path('/unused'))
        self.assertEqual(actor['intent'],t['intent']);self.assertEqual(setup['start_urls'],t['start_urls'])
        self.assertNotIn('SECRET',json.dumps(actor));self.assertNotIn('start_urls',actor)

    def test_vwa_preserves_image_and_multisite_start_order(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'sample.png').write_bytes(b'\x89PNG\r\n\x1a\nexample')
            t={'intent':'Upload supplied image','sites':['classifieds','reddit'],
               'start_url':'__CLASSIFIEDS__ |AND| __REDDIT__','image':'sample.png','eval':{'expected':'GOLD'}}
            actor,setup=split_public(t,'vwa',root)
            self.assertEqual(len(actor['task_images']),1)
            self.assertEqual(setup['start_urls'],['__CLASSIFIEDS__','__REDDIT__'])
            self.assertNotIn('GOLD',json.dumps(actor));self.assertTrue(setup['reset_before_each_arm'])

    def test_missing_remote_and_escaping_image_is_never_silently_dropped(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ['missing.png','https://example.test/image.png','../escape.png']:
                with self.assertRaises((ValueError,FileNotFoundError)):
                    image_refs({'image':name},Path(tmp))


if __name__=='__main__':unittest.main()
