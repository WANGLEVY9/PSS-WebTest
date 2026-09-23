"""Synthetic Chromium checks for screenshot/actuator alignment and native menus.

This is engineering evidence only: no model, official task, or evaluator is used.
DOM reads below are test assertions and are never sent to an actor.
"""
import importlib.util
import io
import base64
import struct
import unittest

from framework_actions import to_css


@unittest.skipUnless(importlib.util.find_spec('agentlab'), 'Use pinned AgentLab interpreter')
class AgentLabImageTransportTests(unittest.TestCase):
    def test_actor_prompt_uses_lossless_full_resolution_png(self):
        import numpy as np
        from PIL import Image
        from types import SimpleNamespace
        from agentlab.agents import dynamic_prompting as dp
        from framework_agentlab import get_action

        image = np.zeros((720, 1280, 3), dtype=np.uint8)
        image[90, 1060] = [10, 220, 30]

        class Prompt:
            def __init__(self): self.image = None
            def add_text(self, value): pass
            def add_image(self, value, detail=None): self.image = value

        class Agent:
            def get_action(self, observation):
                obs = object.__new__(dp.Observation)
                obs.flags = SimpleNamespace(use_screenshot=True, use_som=False,
                                             openai_vision_detail='high')
                obs.obs = observation
                prompt = Prompt()
                obs.add_screenshot(prompt)
                self.url = prompt.image
                return 'mouse_click(828, 125)', {}

        agent = Agent()
        get_action(agent, {'screenshot':image}, 'visual', {'intent':'Synthetic visual target'},
                   0, [1280,720], 'qwen-0-999')
        self.assertTrue(agent.url.startswith('data:image/png;base64,'))
        delivered = Image.open(io.BytesIO(base64.b64decode(agent.url.split(',',1)[1])))
        self.assertEqual(delivered.size, (1280,720))
        self.assertEqual(delivered.getpixel((1060,90)), (10,220,30))


@unittest.skipUnless(importlib.util.find_spec('playwright'), 'Use pinned Playwright interpreter')
class VisualCaptureContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.playwright = sync_playwright().start()
        try:
            cls.browser = cls.playwright.chromium.launch(headless=True)
        except BaseException:
            cls.playwright.stop()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(
            viewport={'width': 1280, 'height': 720}, device_scale_factor=1)
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.page.set_content('''<!doctype html><html><body>
          <button id="target" style="position:absolute;left:940px;top:70px;width:240px;height:40px"
            onclick="this.textContent='Clicked'">Search</button>
          <select id="sort" style="position:absolute;left:1000px;top:380px;width:200px;height:40px">
            <option>Default</option><option>Price low</option><option>Price high</option>
          </select></body></html>''')

    def test_qwen_coordinate_codec_hits_visual_target(self):
        png = self.page.screenshot(type='png', scale='css')
        self.assertEqual(struct.unpack('>II', png[16:24]), (1280, 720))
        point = to_css({'name':'click', 'x':828, 'y':125}, [1280, 720], 'qwen-0-999')
        self.page.mouse.click(point['x'], point['y'])
        self.assertEqual(self.page.locator('#target').inner_text(), 'Clicked')

    def test_native_select_keyboard_remains_usable_without_dom_action(self):
        for sequence in [('ArrowDown','Enter'), ('Escape','ArrowDown','Enter'),
                         ('p','Enter'), ('Home','ArrowDown','Enter')]:
            self.page.locator('#sort').select_option('Default')  # test reset only
            self.page.locator('#target').focus()
            before = self.page.screenshot(type='png', scale='css')
            self.page.mouse.click(1100, 400)
            opened = self.page.screenshot(type='png', scale='css')
            self.assertEqual(self.page.evaluate('document.activeElement.id'), 'sort')
            for key in sequence:
                self.page.keyboard.press(key)
            selected = self.page.screenshot(type='png', scale='css')
            from PIL import Image, ImageChops
            difference = ImageChops.difference(Image.open(io.BytesIO(before)).convert('RGB'),
                                               Image.open(io.BytesIO(opened)).convert('RGB'))
            print('native_select_probe=', sequence,
                  'value=', self.page.locator('#sort').input_value(),
                  'open_changes_page_capture=', before != opened,
                  'open_pixel_difference_box=', difference.getbbox(),
                  'selection_changes_capture=', opened != selected)
