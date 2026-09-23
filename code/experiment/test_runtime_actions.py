import json
from pathlib import Path
import tempfile
import unittest
from framework_actions import agentlab_action, browser_use_action, validate, to_css
from framework_boundary import project_observation, public_task_text
from journaled_browser import Journal, JournaledBrowser, CaptureContractError, sha, screenshot_stall_signal, verify_pixel_capture
from framework_model import evidence_projection, single_action_schema, ModelOutputValidationError


class ActionTests(unittest.TestCase):
    def test_pixel_capture_must_match_css_action_viewport(self):
        import struct
        png = b'\x89PNG\r\n\x1a\n' + struct.pack('>I',13) + b'IHDR' + struct.pack('>II',1280,720)
        self.assertEqual(verify_pixel_capture(png,[1280,720]),(1280,720))
        for bad,viewport in [(png,[1280,800]),(b'not a png',[1280,720])]:
            with self.assertRaises(CaptureContractError): verify_pixel_capture(bad,viewport)

    def test_misaligned_capture_is_private_engineering_failure_not_actor_input(self):
        import struct
        from types import SimpleNamespace
        png = b'\x89PNG\r\n\x1a\n' + struct.pack('>I',13) + b'IHDR' + struct.pack('>II',2560,1440)
        with tempfile.TemporaryDirectory() as tmp:
            journal = Journal(Path(tmp)/'trace')
            browser = JournaledBrowser.__new__(JournaledBrowser)
            browser.page = SimpleNamespace(screenshot=lambda **kwargs: png)
            browser.viewport = [1280,720]
            browser.journal = journal
            browser.timeout = browser.observation_timeout = 5000
            browser.deadline = float('inf')
            with self.assertRaises(CaptureContractError): browser.screenshot('primary-frame')
            event = json.loads((journal.directory/'trajectory.jsonl').read_text().splitlines()[0])
            self.assertEqual(event['kind'],'observation-error')
            self.assertEqual(event['error_type'],'CaptureContractError')
            self.assertNotIn('screenshot',event)

    def test_stall_signal_uses_only_existing_screenshot_bytes(self):
        previous=sha(b'image')
        self.assertEqual(screenshot_stall_signal(previous,b'image','click',True),'unchanged')
        self.assertIsNone(screenshot_stall_signal(previous,b'changed','click',True))
        self.assertIsNone(screenshot_stall_signal(previous,b'image','wait',True))
        self.assertIsNone(screenshot_stall_signal(previous,b'image','click',False))
        with self.assertRaises(ValueError):
            screenshot_stall_signal(previous,b'image','click','true')
        projected=project_observation({'screenshot':b'image','visual_feedback':'unchanged'},
                                      'visual',{'intent':'public task'},1,[100,100])
        self.assertIn('screenshot is byte-for-byte unchanged',public_task_text(projected))
        with self.assertRaises(ValueError):
            project_observation({'screenshot':b'image','visual_feedback':'url-changed'},
                                'visual',{'intent':'public task'},1,[100,100])

    def test_browser_use_provider_schema_requires_exactly_one_action(self):
        class Output:
            @staticmethod
            def model_json_schema():
                return {'type':'object','properties':{'action':{'type':'array','items':{'type':'object'},'min_items':1}}}
        source=Output.model_json_schema()
        schema=single_action_schema(Output)
        self.assertEqual((schema['properties']['action']['minItems'],schema['properties']['action']['maxItems']),(1,1))
        self.assertNotIn('minItems',source['properties']['action'])
        with self.assertRaises(ModelOutputValidationError):
            single_action_schema(type('NoAction',(),{'model_json_schema':staticmethod(lambda:{'type':'object','properties':{}})}))

    def test_key_schema_and_actuator_share_exact_spelling(self):
        from typing import get_args
        from framework_actions import KeyName, KEYS
        self.assertEqual(set(get_args(KeyName)), KEYS)
        for key in KEYS:
            self.assertEqual(browser_use_action({'pss_key':{'key':key}},[100,100]),{'name':'key','key':key})
        with self.assertRaises(ValueError):
            browser_use_action({'pss_key':{'key':'ctrl+a'}},[100,100])

    def test_explicit_qwen_codec_never_infers_units_or_changes_scroll(self):
        a={'name':'scroll','x':500,'y':500,'dx':0,'dy':200}
        self.assertEqual(to_css(a,[1000,700],'qwen-0-999'),{**a,'y':350})
        self.assertEqual(to_css(a,[1000,700],'css-pixels'),a)
        with self.assertRaises(ValueError):to_css({**a,'y':1000},[1000,700],'qwen-0-999')
        with self.assertRaises(ValueError):to_css(a,[1000,700],'auto-detect')

    def test_no_argument_actions(self):
        for text,name in [('noop()','wait'),('close_task_tab()','tab_close'),('task_back()','back'),('task_forward()','forward')]:
            self.assertEqual(agentlab_action(text,[100,100]),{'name':name})

    def test_native_coordinate_and_upload_mapping(self):
        self.assertEqual(agentlab_action('mouse_click(30, y=40)', [100,100]), {'name':'click','x':30,'y':40})
        a=agentlab_action('upload_task_image(30, 40, "task-image-0")',[100,100],['task-image-0'])
        self.assertEqual(a['name'],'upload')
        self.assertEqual(browser_use_action({'pss_upload':{'x':30,'y':40,'asset_id':'task-image-0'}},[100,100],['task-image-0']),a)

    def test_no_python_path_or_unbounded_actions(self):
        for text in ['mouse_click(1,2); mouse_click(3,4)', 'page.evaluate("1")',
                     'mouse_click(__import__("os"),2)', 'mouse_click(True,2)',
                     'mouse_click(100,2)', 'keyboard_press("Control+L")',
                     'upload_task_image(1,2,"/etc/passwd")', 'noop(100000)',
                     'scroll_at(0,0,0,99999)', 'mouse_click(1,x=2)', 'focus_task_tab(-1)']:
            with self.subTest(text=text), self.assertRaises((ValueError,SyntaxError)):
                agentlab_action(text,[100,100])

    def test_browser_use_extra_actions_and_arguments_rejected(self):
        for a in [{'done':{'text':'x'},'pss_wait':{}}, {'pss_click':{'x':1,'y':2,'selector':'#x'}},
                  {'navigate':{'url':'https://example.test'}}, {'pss_scroll':{'delta_y':True}}]:
            with self.assertRaises(ValueError):browser_use_action(a,[100,100])

    def test_visual_projection_does_not_touch_structure(self):
        class Raw(dict):
            def __getitem__(self,k):
                if k!='screenshot':raise AssertionError('Structure accessed')
                return b'image'
            def get(self,k,d=None):
                if k not in ('action_error','visual_feedback'):raise AssertionError('Structure accessed')
                return d
        out=project_observation(Raw(),'visual',{'intent':'public task'},0,[100,100])
        self.assertNotIn('controls',out)

    def test_journal_append_chain_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            journal=Journal(Path(tmp)/'trace')
            ref=journal.artifact('frame.png',b'pixels')
            a=journal.event('observation',frame=ref)
            journal.event('done')
            lines=(journal.directory/'trajectory.jsonl').read_bytes().splitlines()
            self.assertEqual(json.loads(lines[1])['previous_sha256'],sha(lines[0]))
            self.assertEqual(a['sequence'],0)
            with self.assertRaises(FileExistsError):journal.artifact('frame.png',b'changed')
            with self.assertRaises(FileExistsError):Journal(journal.directory)
            with self.assertRaises(ValueError):journal.artifact('../escape',b'bad')

    def test_request_images_are_deduplicated_and_reconstructable(self):
        import base64
        with tempfile.TemporaryDirectory() as tmp:
            journal=Journal(Path(tmp)/'trace')
            uri='data:image/png;base64,'+base64.b64encode(b'example').decode()
            a=evidence_projection({'screenshot':uri},journal)
            self.assertEqual(evidence_projection({'screenshot':uri},journal),a)
            image=a['screenshot']['image_artifact']
            self.assertEqual((journal.directory/image['file']).read_bytes(),b'example')
            self.assertNotIn('base64',json.dumps(a))

    def test_replay_audit_detects_altered_and_interrupted_evidence(self):
        from replay_audit import audit
        with tempfile.TemporaryDirectory() as tmp:
            j=Journal(Path(tmp)/'trace');ref=j.artifact('frame.png',b'image')
            j.event('observation',frame=ref);j.event('actor-end',receipt={})
            self.assertTrue(audit(j.directory)['passed'])
            (j.directory/'frame.png').write_bytes(b'tampered')
            self.assertFalse(audit(j.directory)['passed'])


if __name__=='__main__':unittest.main()
