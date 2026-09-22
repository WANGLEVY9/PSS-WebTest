"""Actual pinned VWA router on synthetic local pages. Not official task runs."""
import copy
import io
import json
import os
from pathlib import Path
import tempfile
import threading
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import unittest
from vwa_native_evaluate import load_native,evaluator_requirements,validate_routes,ROUTES,evaluate_live,consume_sealed,SCHEMA
from benchmark_actor_lifecycle import seal_context,persist,encoded,sha
from journaled_browser import Journal
from prepare_navigation_runtime import PINS

SOURCE=Path(os.environ.get('PSS_VWA_SOURCE',str(Path(__file__).resolve().parents[1]/'artifacts/benchmark-snapshots/visualwebarena')))


class VwaRulesTests(unittest.TestCase):
    def test_model_judges_are_explicitly_pending_not_replaced(self):
        for spec in ({'eval_types':['string_match'],'reference_answers':{'fuzzy_match':['x']}},
                     {'eval_types':['program_html'],'program_html':[{'required_contents':{'fuzzy_match':'x'}}]},
                     {'eval_types':['page_image_query'],'page_image_query':[{'eval_vqa':[{'question':'x','answer':'y'}]}]}):
            self.assertTrue(evaluator_requirements({'eval':spec})['unfrozen_judges'])
        with self.assertRaises(ValueError):evaluator_requirements({'eval':{'eval_types':['unknown']}})
        with self.assertRaises(ValueError):validate_routes({})
        with self.assertRaises(ValueError):validate_routes({r:'http://user:password@localhost' for r in ROUTES})

    def test_original_910_task_evaluator_requirements_can_be_classified(self):
        count=0;judge=0
        for file in sorted((SOURCE/'config_files/vwa').glob('*.raw.json')):
            for task in json.loads(file.read_bytes()):
                req=evaluator_requirements(task)
                count+=1;judge+=bool(req['unfrozen_judges'])
        self.assertEqual(count,910);self.assertGreater(judge,0)


class VwaNativeRouterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from PIL import Image
        from playwright.sync_api import sync_playwright
        cls.tmp=tempfile.TemporaryDirectory(prefix='pss-vwa-native-control-')
        cls.root=Path(cls.tmp.name)
        image=Image.new('RGB',(64,64),(50,100,150));buffer=io.BytesIO();image.save(buffer,format='PNG')
        cls.image=buffer.getvalue();(cls.root/'ref.png').write_bytes(cls.image)
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                self.send_response(200)
                self.send_header('Content-Type','image/png' if self.path=='/frame.png' else 'text/html')
                self.end_headers()
                self.wfile.write(cls.image if self.path=='/frame.png' else b'<body><div id="value">SYNTHETIC_EXPECTED</div><img src="/frame.png"></body>')
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.origin=f'http://127.0.0.1:{cls.server.server_port}'
        cls.router,cls.stop,cls.tree=load_native(SOURCE,{r:cls.origin for r in ROUTES})
        cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.tmp.cleanup()

    def control(self,spec,answer='SYNTHETIC_EXPECTED'):
        context=self.browser.new_context();page=context.new_page();page.goto(self.origin+'/final')
        try:
            path=self.root/'SYNTHETIC-config.json';path.write_text(json.dumps({'intent':'SYNTHETIC_TEST','eval':spec}))
            # Native router, native STOP action, actual live Page. No monkeypatches.
            return type(self).router(path)([type(self).stop(answer)],path,page)
        finally:context.close()

    def test_native_string_positive_and_negative(self):
        spec={'eval_types':['string_match'],'reference_answers':{'exact_match':'SYNTHETIC_EXPECTED'}}
        self.assertEqual(self.control(spec),1);self.assertEqual(self.control(spec,'wrong'),0)

    def test_native_url_positive_and_negative(self):
        for suffix,expected in (('/final',1),('/wrong',0)):
            self.assertEqual(self.control({'eval_types':['url_match'],'reference_url':self.origin+suffix}),expected)

    def test_native_dom_positive_and_negative(self):
        spec={'eval_types':['program_html'],'program_html':[{'url':'last',
            'locator':"document.querySelector('#value').textContent",'required_contents':{'exact_match':'SYNTHETIC_EXPECTED'}}]}
        self.assertEqual(self.control(spec),1)
        spec['program_html'][0]['required_contents']['exact_match']='wrong'
        self.assertEqual(self.control(spec),0)

    def test_native_image_ssim_positive_and_negative(self):
        spec={'eval_types':['page_image_query'],'page_image_query':[{'eval_image_class':'',
            'eval_image_url':'last','eval_fuzzy_image_match':str(self.root/'ref.png')}]}
        self.assertEqual(self.control(spec),1)
        from PIL import Image
        Image.new('RGB',(64,64),(255,255,255)).save(self.root/'different.png')
        spec['page_image_query'][0]['eval_fuzzy_image_match']=str(self.root/'different.png')
        self.assertEqual(self.control(spec),0)

    def test_native_unknown_route_raises_not_zero_score(self):
        with self.assertRaises(ValueError):self.control({'eval_types':['unsupported']})

    def test_full_adapter_original_source_binding_preclose_receipt_and_seal(self):
        datasets={site:SOURCE/f'config_files/vwa/test_{site}.raw.json' for site in ('classifieds','shopping','reddit')}
        candidates=[(site,row) for site,file in datasets.items() for row in json.loads(file.read_bytes())
            if row['eval']['eval_types']==['string_match'] and set(row['eval'].get('reference_answers',{}))=={'exact_match'}]
        self.assertTrue(candidates)
        site,row=candidates[0]
        with tempfile.TemporaryDirectory(prefix='pss-vwa-adapter-synthetic-') as tmp:
            root=Path(tmp);journal=Journal(root/'actor')
            identity={'opportunity_id':'SYNTHETIC_CONTROL','environment_id':'local-fixture','configuration_sha256':'a'*64}
            actor={**identity,'scope':'synthetic','data_kind':'SYNTHETIC_TEST',
                'final_answer':str(row['eval']['reference_answers']['exact_match']),
                'trajectory_directory':str(journal.directory)}
            journal.event('actor-start');journal.event('actor-end',receipt=actor)
            gold={'benchmark':'vwa','official_task_id':site+':'+str(row['task_id']),
                'source_commit':PINS['vwa'],'source_sha256':sha(datasets[site].read_bytes()),
                'application':'+'.join(row['sites']),'official_config':row}
            goldref=persist(root/'gold.json',encoded(gold))
            manifest={'schema':SCHEMA,'scope':'synthetic','source_dir':str(SOURCE),'source_commit':PINS['vwa'],
                'source_dataset_sha256':{key:sha(file.read_bytes()) for key,file in datasets.items()},
                'routes':{r:self.origin for r in ROUTES},'private_artifact_root':str(root/'private'),
                'judge_policy':'deterministic-only-fail-closed'}
            mref=persist(root/'manifest.json',encoded(manifest))
            payload={**identity,'scope':'synthetic','data_kind':'SYNTHETIC_TEST','actor_result':actor,'evaluation_ref':goldref}
            context=self.browser.new_context(record_har_path=str(journal.directory/'network.har'))
            page=context.new_page();page.goto(self.origin+'/final')
            try:
                evaluated=evaluate_live(payload,mref,page)
                self.assertEqual(evaluated['native_score'],1);self.assertIsNone(evaluated['verdict'])
                pref=persist(journal.directory/'preclose-evaluation.json',encoded(evaluated))
                envelope=seal_context(context,journal,actor,'synthetic',preclose_evaluation_ref=pref)
                result=consume_sealed({**payload,**envelope},mref)
                self.assertEqual(result['native_score'],1)
                self.assertEqual(result['actor_lifecycle_ref'],envelope['actor_lifecycle_ref'])
                with self.assertRaises(ValueError):consume_sealed({**payload,**envelope,'opportunity_id':'other'},mref)
            finally:context.close()


if __name__=='__main__':unittest.main()
