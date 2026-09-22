"""Offline tests against installed upstream libraries; no API or SUT executions.

An injected deterministic LLM tests AgentLab's real prompt+parser pathway.
Browser Use's unmodified prompt is a NEGATIVE control, never an admitted adapter.
"""
import argparse
import json
import importlib.metadata


def agentlab_probe():
    from dataclasses import dataclass
    import numpy as np
    from agentlab.llm.base_api import BaseModelArgs
    from framework_agentlab import make_agent, get_action
    captured = []
    class Model:
        def __call__(self, messages):
            captured.append(messages.to_openai())
            return {'role': 'assistant', 'content': '<action>mouse_click(20, 20)</action>'}
        def get_stats(self):
            return {}
    @dataclass
    class Args(BaseModelArgs):
        def make_model(self):
            return Model()
    counts = {}
    for mode in ('visual', 'hybrid'):
        agent = make_agent(Args(model_name='offline-fixture', vision_support=True), mode)
        raw = {'screenshot': np.zeros((64, 64, 3), dtype=np.uint8),
               'url': 'FORBIDDEN_URL_SENTINEL', 'dom_object': 'FORBIDDEN_DOM_SENTINEL',
               'axtree_object': 'FORBIDDEN_AX_SENTINEL', 'reward': 'FORBIDDEN_GOLD_SENTINEL',
               'last_action_error': 'FORBIDDEN_RAW_ERROR_SENTINEL',
               'visible_controls': [{'role': 'button', 'name': 'VISIBLE_BUTTON_SENTINEL',
                                     'box': [10, 10, 20, 20], 'visible': True, 'in_viewport': True}]}
        for index in range(2):
            action, _ = get_action(agent, raw, mode, {'intent': 'Synthetic boundary check', 'benchmark':'wav'}, index, [64, 64])
            assert action == 'mouse_click(20, 20)', action
            text = json.dumps(captured[-1])
            assert 'FORBIDDEN_' not in text
            assert ('VISIBLE_BUTTON_SENTINEL' in text) == (mode == 'hybrid')
            assert 'data:image/' in text
            assert '<action>' in text and '</action>' in text, 'Native parser grammar must be disclosed in the prompt'
            assert 'mouse_upload_file' not in text
            assert all(field in text for field in ('task_type','retrieved_data','error_details','NOT_FOUND_ERROR'))
        counts[mode] = 2
        for forbidden in ('goto("http://example.test")', 'upload_file("1", "/tmp/file")', 'page.evaluate("1")'):
            try:
                agent.action_set.to_python_code(forbidden)
            except Exception:
                pass
            else:
                raise AssertionError('Forbidden action accepted')
    return {'framework': 'agentlab-browsergym', 'versions': {k: importlib.metadata.version(k) for k in ('agentlab', 'browsergym-core')},
            'component_prompt_checks': counts, 'passed': True, 'live_visibility_audit': 'not-run',
            'benchmark_adapter_admitted': False}


def browser_use_probe():
    import asyncio
    import tempfile
    import io
    from PIL import Image
    from browser_use import Browser
    from browser_use.llm.views import ChatInvokeCompletion
    from framework_browser_use import make_agent, get_action
    from browser_use.agent.prompts import AgentMessagePrompt
    from browser_use.browser.views import BrowserStateSummary, TabInfo
    from browser_use.dom.views import SerializedDOMState
    state = BrowserStateSummary(dom_state=SerializedDOMState(_root=None, selector_map={}),
                                url='https://FORBIDDEN_URL_SENTINEL.test', title='FORBIDDEN_TITLE_SENTINEL',
                                tabs=[TabInfo(url='https://FORBIDDEN_URL_SENTINEL.test', title='FORBIDDEN_TITLE_SENTINEL', target_id='abcd')])
    message = AgentMessagePrompt(state, file_system=None, task='Synthetic boundary check').get_user_message(use_vision=False)
    text = message.model_dump_json()
    assert 'FORBIDDEN_URL_SENTINEL' in text, 'Negative control no longer matches upstream: re-audit new version'
    captured = []
    class Model:
        model = model_name = name = 'offline-fixture'
        provider = 'openai'
        _verified_api_keys = True
        async def ainvoke(self, messages, output_format=None, **kwargs):
            captured.append([m.model_dump() for m in messages])
            return ChatInvokeCompletion(completion=output_format.model_validate({
                'evaluation_previous_goal': '', 'memory': '', 'next_goal': 'Synthetic click',
                'action': [{'pss_click': {'x': 20, 'y': 20}}]}), usage=None)
    async def restricted_check(directory):
        image = io.BytesIO()
        Image.new('RGB', (64, 64)).save(image, format='PNG')
        browser = Browser(headless=True, enable_default_extensions=False)
        agent = make_agent(Model(), browser, 'Synthetic boundary check', directory)
        from framework_actions import KEYS
        key_model = agent.tools.registry.registry.actions['pss_key'].param_model
        assert set(key_model.model_json_schema()['properties']['key']['enum']) == KEYS
        try: key_model.model_validate({'key':'ctrl+a'})
        except ValueError: pass
        else: raise AssertionError('Undeclared key spelling accepted by provider schema')
        raw = {'screenshot': image.getvalue(), 'url': 'FORBIDDEN_URL_SENTINEL',
               'dom_object': 'FORBIDDEN_DOM_SENTINEL', 'visible_controls': [
                   {'role': 'button', 'name': 'VISIBLE_BUTTON_SENTINEL', 'box': [10,10,20,20], 'visible': True, 'in_viewport': True}]}
        action, _ = await get_action(agent, raw, {'intent': 'Synthetic boundary check', 'benchmark':'wav'}, 0, [64,64])
        assert action == {'pss_click': {'x': 20, 'y': 20}}, action
        sent = json.dumps(captured[-1])
        assert 'FORBIDDEN_' not in sent and 'VISIBLE_BUTTON_SENTINEL' in sent and 'data:image/png' in sent
        assert all(field in sent for field in ('task_type','retrieved_data','error_details','NOT_FOUND_ERROR'))
        assert set(agent.tools.registry.registry.actions) == {'pss_click', 'pss_type', 'pss_scroll', 'pss_key', 'done',
            'pss_upload', 'pss_tab_focus', 'pss_tab_close', 'pss_back', 'pss_forward', 'pss_wait'}
        try: await agent.run()
        except RuntimeError: pass
        else: raise AssertionError('Unsafe stock loop accepted')
    with tempfile.TemporaryDirectory() as directory:
        asyncio.run(restricted_check(directory))
    return {'framework': 'browser-use', 'version': importlib.metadata.version('browser-use'),
            'negative_control_detected_default_url_leak': True, 'passed': True,
            'restricted_native_decision_checks': 1, 'stock_loop_blocked': True,
            'benchmark_adapter_admitted': False, 'required': 'Native benchmark observation/actuator/reset/evaluator integration'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--framework', required=True, choices=('agentlab', 'browser-use'))
    args = parser.parse_args()
    result = agentlab_probe() if args.framework == 'agentlab' else browser_use_probe()
    print(json.dumps({'kind': 'FRAMEWORK_NATIVE_COMPONENT_PROBE', 'data_kind': 'SYNTHETIC_TEST',
                      'model_requests': 0, 'benchmark_executions': 0, 'confirmatory_authorized': False, **result}))
