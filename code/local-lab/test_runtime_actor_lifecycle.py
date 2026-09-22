"""Real Chromium supervisor lifecycle tests on loopback-only synthetic fixtures.

Use the pinned h-agentlab interpreter (Playwright installed). No external model,
official benchmark task or SUT fixture is executed. Missing Chromium is a failure
when the integration suite is explicitly selected, not an admission success.
"""
import copy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest

from benchmark_actor_lifecycle import run_owned_session, verify_lifecycle, encoded, persist, sha
from journaled_browser import JournaledBrowser
from runtime_store import digest


@unittest.skipUnless(importlib.util.find_spec('playwright'), 'Use pinned h-agentlab Python for Chromium lifecycle integration')
class ActorLifecycleChromiumTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.pw=sync_playwright().start()
        try:cls.browser=cls.pw.chromium.launch(headless=True)
        except BaseException:cls.pw.stop();raise
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                html='''<body style="margin:0"><h1>SYNTHETIC CONTROL</h1>
                <button style="position:absolute;left:20px;top:100px;width:200px;height:60px"
                  onclick="window.open('/popup','_blank')">Open popup</button></body>'''
                self.send_response(200);self.send_header('Content-Type','text/html');self.end_headers()
                self.wfile.write(html.encode())
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close();cls.thread.join(timeout=2)

    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='pss-har-lifecycle-')
        self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name).resolve()
        self.identity={'opportunity_id':'SYNTHETIC_CONTROL','environment_id':'loopback-isolated',
                       'configuration_sha256':'a'*64}
        setup={'sites':['shopping'],'start_urls':['__SHOPPING__/start','__SHOPPING__/second'],
               'require_login':False,'geolocation':None}
        setup_ref=persist(self.root/'setup.json',encoded(setup))
        proof=persist(self.root/'reset-proof.json',encoded({'data_kind':'SYNTHETIC_TEST'}))
        self.input={'intent':'Synthetic popup control','benchmark':'wav','task_images':[]}
        self.op={**self.identity,'scope':'synthetic','agent_input':self.input,
                 'setup_ref':setup_ref,'setup_binding_sha256':digest(setup_ref)}
        self.reset={**self.identity,'restored':True,'baseline_sha256':'b'*64,
                    'closure_sites':['shopping'],'reset_evidence_ref':proof}
        self.payload={**self.identity,'input':self.input,'scope':'synthetic','data_kind':'SYNTHETIC_TEST',
                      'budget':{'max_actions':3,'task_timeout_ms':10000},'model_binding':None}
        self.routes={'__SHOPPING__':f'http://127.0.0.1:{self.server.server_port}'}
        self.captured=[]

    def driver(self,context,page,payload,journal,framework,mode,node,viewport):
        self.captured.append(copy.deepcopy(payload))
        context.tracing.start(screenshots=True,snapshots=True)
        actuator=JournaledBrowser(context,page,journal,viewport,payload['input'],settle_ms=20)
        journal.event('actor-start',framework=framework,mode=mode,scope='synthetic',data_kind='SYNTHETIC_TEST',
                      budget=payload['budget'],model_binding=None)
        actuator.observe(mode)
        actuator.execute({'name':'click','x':60,'y':120})
        page.wait_for_timeout(100)
        actuator.observe(mode)
        actuator.execute({'name':'done','text':'SYNTHETIC_CONTROL'})
        context.tracing.stop(path=str(journal.directory/'trace.zip'))
        result={**self.identity,'terminal_status':'completed','final_answer':'SYNTHETIC_CONTROL',
                'scope':'synthetic','data_kind':'SYNTHETIC_TEST','framework':framework,'mode':mode,
                'trajectory_directory':str(journal.directory),'action_count':2,'budget_met':True,
                'provider_requests':0,'confirmatory_authorized':False}
        journal.event('actor-end',receipt=result)
        self.original=copy.deepcopy(result)
        return result

    def run_fixture(self,name='run',payload=None,driver=None,op=None):
        return run_owned_session(self.browser,op or self.op,self.reset,'b'*64,self.routes,self.root/name,
            payload or self.payload,'SYNTHETIC_DRIVER','visual',None,viewport=(800,600),
            synthetic_driver=driver or self.driver)

    def test_context_close_seals_multi_page_har_and_preserves_actor_end(self):
        envelope=self.run_fixture()
        actor=envelope['actor_result']
        self.assertEqual(actor,self.original)
        self.assertNotIn('network_trace_ref',actor)
        self.assertEqual(self.captured,[self.payload])
        seal=verify_lifecycle(envelope['actor_lifecycle_ref'],actor)
        self.assertTrue(seal['context_close_observed'])
        self.assertGreaterEqual(seal['har_entries'],3)
        self.assertEqual(seal['scope'],'synthetic')
        self.assertEqual(seal['data_kind'],'SYNTHETIC_TEST')
        self.assertFalse(seal['confirmatory_authorized'])
        self.assertIn('browser_trace_ref',seal)
        entries=json.loads(Path(seal['network_trace_ref']['file']).read_bytes())['log']['entries']
        urls=[entry['request']['url'] for entry in entries]
        self.assertTrue(all(url.startswith(self.routes['__SHOPPING__']) for url in urls))
        self.assertTrue(any(url.endswith('/popup') for url in urls))
        self.assertEqual(len(self.browser.contexts),0)

    def test_mutated_actor_and_har_rejected(self):
        envelope=self.run_fixture()
        seal=verify_lifecycle(envelope['actor_lifecycle_ref'],envelope['actor_result'])
        with self.assertRaises(ValueError):
            verify_lifecycle(envelope['actor_lifecycle_ref'],{**envelope['actor_result'],'final_answer':'changed'})
        Path(seal['network_trace_ref']['file']).write_bytes(b'{}')
        with self.assertRaises(ValueError):verify_lifecycle(envelope['actor_lifecycle_ref'],envelope['actor_result'])

    def test_error_closes_context_and_never_claims_seal(self):
        def broken(*args,**kwargs):raise RuntimeError('SYNTHETIC_EXCEPTION')
        with self.assertRaises(RuntimeError):self.run_fixture(driver=broken)
        self.assertEqual(len(self.browser.contexts),0)
        self.assertFalse((self.root/'run/supervisor-lifecycle.json').exists())
        failure=json.loads((self.root/'run/supervisor-failure.json').read_bytes())
        self.assertEqual(failure['context_cleanup'],'closed')
        self.assertFalse(failure['confirmatory_authorized'])

    def test_synthetic_driver_cannot_become_real_or_receive_private_setup(self):
        with self.assertRaises(ValueError):self.run_fixture(op={**self.op,'scope':'diagnostic'})
        with self.assertRaises(ValueError):self.run_fixture(payload={**self.payload,'evaluation_ref':{'GOLD':'forbidden'}})
        with self.assertRaises(ValueError):
            self.run_fixture(payload={**self.payload,'scope':'diagnostic','data_kind':'MEASURED'})
        self.assertEqual(self.captured,[])
        self.assertEqual(len(self.browser.contexts),0)

    def test_actor_receipt_must_match_already_journaled_receipt(self):
        def changed(*args,**kwargs):
            actor=self.driver(*args,**kwargs)
            return {**actor,'final_answer':'CHANGED_AFTER_ACTOR_END'}
        with self.assertRaises(ValueError):self.run_fixture(driver=changed)
        self.assertFalse((self.root/'run/supervisor-lifecycle.json').exists())
        self.assertEqual(len(self.browser.contexts),0)


if __name__=='__main__':unittest.main()
