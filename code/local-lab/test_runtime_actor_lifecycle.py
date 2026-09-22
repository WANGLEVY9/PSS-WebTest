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
import time
import unittest

from benchmark_actor_lifecycle import run_owned_session, verify_lifecycle, encoded, persist, sha
from journaled_browser import JournaledBrowser
from runtime_store import digest,Store
from lifecycle_timing import POLICY,window,verify_timing


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

    def traditional(self,source,max_actions=6):
        script=persist(self.root/'reviewed-script.py',source.encode())
        store=Store(str(self.root/'ledger.sqlite'))
        op={**self.op,'schedule_sha256':'c'*64}
        store.enqueue([op]);leased=store.claim();store.start(op['opportunity_id'],leased['lease_token'])
        self.addCleanup(store.close)
        payload={**self.payload,'budget':{'max_actions':max_actions,'task_timeout_ms':10000},
            'request_ledger':{'database':store.filename,'opportunityId':op['opportunity_id'],'leaseToken':leased['lease_token']}}
        return run_owned_session(self.browser,op,self.reset,'b'*64,self.routes,self.root/'traditional',
            payload,'playwright','traditional',None,viewport=(800,600),traditional_script_ref=script,
            lifecycle_limits={'setup_ms':10000,'evaluation_ms':10000,'finalization_ms':10000,'transport_ms':10000})

    def test_traditional_real_locator_popup_read_done_timing_and_replay(self):
        result=self.traditional('''def run(session, task):
    session.get_by_role('button', name='Open popup').click()
    session.focus_tab(0)
    return session.locator('h1').inner_text()
''')
        actor=result['actor_result'];seal=verify_lifecycle(result['actor_lifecycle_ref'],actor)
        self.assertEqual(actor['terminal_status'],'completed')
        self.assertEqual(actor['final_answer'],'SYNTHETIC CONTROL')
        self.assertEqual(actor['action_count'],3);self.assertEqual(actor['script_reads'],1)
        self.assertEqual(actor['provider_requests'],0);self.assertEqual(actor['timing_policy'],POLICY)
        self.assertIn('lifecycle_timing',seal);self.assertTrue(actor['source_tree_unchanged'])
        rows=[json.loads(r) for r in Path(actor['trajectory_directory'],'trajectory.jsonl').read_text().splitlines()]
        self.assertGreaterEqual(sum(r['kind']=='observation' for r in rows),7)
        self.assertEqual(sum(r['kind']=='action-start' for r in rows),3)

    def test_traditional_failed_script_seals_without_fabricated_answer(self):
        result=self.traditional("def run(session, task):\n    raise AssertionError('SYNTHETIC')\n")
        actor=result['actor_result'];verify_lifecycle(result['actor_lifecycle_ref'],actor)
        self.assertEqual(actor['terminal_status'],'execution-error');self.assertIsNone(actor['final_answer'])

    def test_traditional_action_budget_preserves_attempted_action_trace(self):
        result=self.traditional("def run(session, task):\n    session.focus_tab(1)\n    return 'answer'\n",max_actions=1)
        actor=result['actor_result'];verify_lifecycle(result['actor_lifecycle_ref'],actor)
        self.assertEqual(actor['failure_class'],'action-budget-exhausted');self.assertEqual(actor['action_count'],1)
        self.assertIsNone(actor['final_answer'])

    def test_traditional_cannot_override_timeout_or_call_raw_evaluate(self):
        result=self.traditional("def run(session, task):\n    session.get_by_role('button').click(timeout=100000)\n    return 'x'\n")
        actor=result['actor_result'];verify_lifecycle(result['actor_lifecycle_ref'],actor)
        self.assertEqual(actor['failure_class'],'ValueError');self.assertEqual(actor['action_count'],0)

    def test_real_task_wrapper_uses_ledger_and_returns_sealed_traditional_run(self):
        from test_runtime_session_wrapper import fixture
        import subprocess
        import sys
        store,request,manifest=fixture(self.root,self.routes)
        self.addCleanup(store.close)
        proc=subprocess.run([sys.executable,str(Path(__file__).with_name('benchmark_session_wrapper.py')),
            '--manifest',manifest['file'],'--manifest-sha256',manifest['sha256']],
            input=json.dumps(request),capture_output=True,text=True,timeout=60)
        self.assertEqual(proc.returncode,0,proc.stderr)
        envelope=json.loads(proc.stdout)
        actor=envelope['actor_result'];seal=verify_lifecycle(envelope['actor_lifecycle_ref'],actor)
        self.assertEqual(actor['final_answer'],'SYNTHETIC CONTROL')
        self.assertEqual(actor['terminal_status'],'completed')
        self.assertEqual(actor['scope'],'synthetic');self.assertEqual(actor['provider_requests'],0)
        self.assertIn('lifecycle_timing',seal)

    def test_worker_wrapper_subprocess_chain_preserves_negative_synthetic_evaluation(self):
        # Only actor/wrapper/Chromium are real here. Reset, evaluation and cleanup
        # are explicit synthetic callbacks; no official task or fixture is run.
        from test_runtime_session_wrapper import fixture
        from runtime_worker import execute_one,run_command
        old,request,_=fixture(self.root,self.routes)
        op=json.loads(old.db.execute('SELECT payload FROM opportunities').fetchone()['payload']);old.close()
        store=Store(str(self.root/'worker.sqlite'));self.addCleanup(store.close);store.enqueue([op])
        calls=[]
        def invoke(command,payload,heartbeat):
            heartbeat();stage=('reset','actor','evaluate','cleanup')[len(calls)];calls.append(stage)
            if stage=='actor':return run_command(command,payload,heartbeat)
            identity={k:payload[k] for k in ('opportunity_id','environment_id','configuration_sha256','scope','data_kind','lease_token')}
            if stage=='reset':return {**request['reset_receipt'],**identity}
            if stage=='evaluate':return {**identity,'assessment_status':'valid','native_score':0,'verdict':None}
            return {**identity,'cleaned':True}
        result=execute_one(store,request['binding'],invoke)
        self.assertEqual(calls,['reset','actor','evaluate','cleanup'])
        self.assertTrue(result['lifecycle_completed'],result)
        self.assertEqual(result['actor_terminal_status'],'completed')
        self.assertEqual(result['native_score'],0)
        self.assertEqual(result['cleanup_status'],'verified')
        self.assertGreater(result['actor_envelope_elapsed_ms'],result['actor_elapsed_ms'])

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

    def timed_driver(self,context,page,payload,journal,framework,mode,node,viewport,
                     terminal_page_sink,defer_trace_finalization):
        start=time.monotonic_ns()
        self.assertTrue(defer_trace_finalization)
        context.tracing.start(screenshots=True,snapshots=True)
        actuator=JournaledBrowser(context,page,journal,viewport,payload['input'],settle_ms=20)
        journal.event('actor-start',framework=framework,mode=mode)
        actuator.observe(mode)
        actuator.execute({'name':'click','x':60,'y':120})
        actuator.observe(mode)
        actuator.execute({'name':'done','text':'SYNTHETIC_CONTROL'})
        end=time.monotonic_ns()
        actor={**self.identity,'scope':'synthetic','data_kind':'SYNTHETIC_TEST',
               'terminal_status':'completed','final_answer':'SYNTHETIC_CONTROL',
               'trajectory_directory':str(journal.directory),'action_count':2,'budget_met':True,
               'timing_policy':POLICY,'actor_timing':window(start,end),'elapsed_ms':(end-start)/1_000_000}
        journal.event('actor-end',receipt=actor)
        terminal_page_sink(actuator.page)
        return actor

    def run_timed_fixture(self,evaluator):
        return run_owned_session(self.browser,self.op,self.reset,'b'*64,self.routes,self.root/'timed',
            self.payload,'SYNTHETIC_DRIVER','visual',None,viewport=(800,600),
            synthetic_driver=self.timed_driver,native_evaluator=evaluator,
            lifecycle_limits={'setup_ms':10000,'evaluation_ms':10000,'finalization_ms':10000,'transport_ms':1000})

    def test_timing_and_actual_final_popup_preclose_evaluation(self):
        called=[]
        def evaluate(actor,page):
            # The first page and previously opened second tab are NOT this page.
            self.assertTrue(page.url.endswith('/popup'));self.assertFalse(page.is_closed())
            self.assertEqual(json.loads((Path(actor['trajectory_directory'])/'trajectory.jsonl').read_text().splitlines()[-1])['kind'],'actor-end')
            called.append(True)
            time.sleep(.02)
            return {**self.identity,'scope':'synthetic','data_kind':'SYNTHETIC_TEST',
                    'assessment_status':'valid','native_score':0,'verdict':None,
                    'trajectory_ref':{'file':str(Path(actor['trajectory_directory'])/'trajectory.jsonl'),
                        'sha256':sha((Path(actor['trajectory_directory'])/'trajectory.jsonl').read_bytes())}}
        out=self.run_timed_fixture(evaluate)
        seal=verify_lifecycle(out['actor_lifecycle_ref'],out['actor_result'])
        self.assertEqual(called,[True])
        verify_timing(seal['lifecycle_timing'],out['actor_result'],seal['lifecycle_limits'])
        self.assertGreaterEqual(seal['lifecycle_timing']['phases']['evaluation']['elapsed_ms'],20)
        self.assertEqual(len(self.browser.contexts),0)
        self.assertIn('preclose_evaluation_ref',seal)

    def test_native_evaluator_error_closes_and_seals_unresolved(self):
        def broken(actor,page):raise RuntimeError('private evaluator diagnostic')
        out=self.run_timed_fixture(broken)
        seal=verify_lifecycle(out['actor_lifecycle_ref'],out['actor_result'])
        receipt=json.loads(Path(seal['preclose_evaluation_ref']['file']).read_bytes())
        self.assertEqual(receipt['assessment_status'],'unresolved')
        self.assertIsNone(receipt['native_score'])
        self.assertEqual(out['actor_result']['terminal_status'],'completed')
        self.assertEqual(len(self.browser.contexts),0)

    def test_real_agentlab_driver_uses_current_clock_and_deferred_trace(self):
        from native_framework_driver import run_actor
        class OfflineModel:
            identity={'model':'SYNTHETIC_OFFLINE'}
            requests=0
            def __call__(self,messages):
                self.requests+=1
                return {'role':'assistant','content':'<action>send_msg_to_user("SYNTHETIC_CONTROL")</action>'}
            def get_stats(self):return {}
        for mode in ('visual','hybrid'):
            database=self.root/f'{mode}.sqlite'
            store=Store(str(database))
            try:
                store.enqueue([{**self.op,'schedule_sha256':'synthetic-not-benchmark'}])
                claimed=store.claim();store.start(self.op['opportunity_id'],claimed['lease_token'])
                payload={**self.payload,'request_ledger':{'database':str(database),'opportunityId':self.op['opportunity_id'],
                    'leaseToken':claimed['lease_token']}}
                def driver(*args,**kwargs):return run_actor(*args,backend=OfflineModel(),**kwargs)
                envelope=run_owned_session(self.browser,self.op,self.reset,'b'*64,self.routes,self.root/f'real-{mode}',
                    payload,'agentlab-browsergym',mode,None,viewport=(800,600),synthetic_driver=driver,
                    lifecycle_limits={'setup_ms':10000,'evaluation_ms':10000,'finalization_ms':10000,'transport_ms':1000})
                actor=envelope['actor_result']
                self.assertEqual(actor['terminal_status'],'completed')
                self.assertTrue(actor['budget_met']);self.assertEqual(actor['action_count'],1)
                seal=verify_lifecycle(envelope['actor_lifecycle_ref'],actor)
                self.assertIn('browser_trace_ref',seal)
                self.assertEqual(actor['timing_policy'],POLICY)
                store.finish(self.op['opportunity_id'],claimed['lease_token'],actor)
            finally:store.close()


if __name__=='__main__':unittest.main()
