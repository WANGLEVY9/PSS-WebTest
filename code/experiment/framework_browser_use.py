"""Restricted Browser Use decision/tool component (NOT the default Agent.run).

Uses upstream Agent.get_model_output and tool registry/schema. The outer native
benchmark adapter must own reset, observations, action execution and evaluation.
This component intentionally blocks the stock run loop until those are bound.
"""
import base64
import json
from framework_boundary import project_observation, public_task_text
from framework_actions import browser_use_action, KeyName
from framework_model import ModelOutputValidationError


def make_agent(llm, browser, task, private_directory):
    from browser_use import Agent, Tools
    from browser_use.agent.views import ActionResult
    tools = Tools(display_files_in_done_text=False)
    for name in list(tools.registry.registry.actions):
        tools.exclude_action(name)
    # Remove only the exclusion for our replacement done schema; default done
    # had file attachments/success semantics that must not survive the boundary.
    tools.registry.exclude_actions = [name for name in tools.registry.exclude_actions if name != 'done']

    # Actions are returned to a journaled actuator, never executed by a hidden
    # default DOM/JS/file/network tool. Calling these registry stubs is an error.
    @tools.action('Click screenshot CSS pixel coordinates.')
    async def pss_click(x: int, y: int):
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Insert text at current keyboard focus; this does not clear existing text.')
    async def pss_type(text: str):
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Scroll vertically by CSS pixels; positive means down.')
    async def pss_scroll(delta_y: int):
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Press exactly one declared key or chord using the case-sensitive enum spelling.')
    async def pss_key(key: KeyName):
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Click upload control at CSS coordinates and attach a pinned public task image ID.')
    async def pss_upload(x: int, y: int, asset_id: str):
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Focus zero-based creation-order tab ordinal, not a URL or title.')
    async def pss_tab_focus(index: int):
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Close the current tab.')
    async def pss_tab_close():
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Go back in browser history.')
    async def pss_back():
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Go forward in browser history.')
    async def pss_forward():
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Wait briefly for the next screenshot.')
    async def pss_wait():
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Finish and return an answer. This is not an independent success verdict.')
    async def done(text: str):
        return ActionResult(is_done=True, extracted_content=text)

    class RestrictedAgent(Agent):
        async def run(self, *args, **kwargs):
            raise RuntimeError('Default Browser Use observation/control loop is not admitted')

        def _process_messsages_and_replace_long_urls_shorter_ones(self, messages):
            return {}  # preserve screenshot data URLs and legitimate public task text

        async def get_model_output(self, messages):
            # Native implementation normally truncates extra actions silently.
            # Disable truncation here, then reject multi-action output explicitly.
            previous = self.settings.max_actions_per_step
            self.settings.max_actions_per_step = 2**31-1
            try:
                output = await super().get_model_output(messages)
            finally:
                self.settings.max_actions_per_step = previous
            if len(output.action) != 1:
                raise ModelOutputValidationError('Exactly one action required; never truncate a model response')
            return output

    return RestrictedAgent(task=task, llm=llm, browser=browser, tools=tools,
        file_system_path=str(private_directory), use_vision=True, use_thinking=False,
        max_actions_per_step=1, use_judge=False, calculate_cost=False,
        directly_open_url=False, enable_planning=False, loop_detection_enabled=False,
        message_compaction=False, final_response_after_failure=False,
        fallback_llm=None, enable_signal_handler=False,
        override_system_message='Execute only the supplied public task with the declared actions and observations. Never infer success from your own completion claim.')


async def get_action(agent, raw, task, index, viewport, accepted_actions=(), coordinate_space='css-pixels'):
    from browser_use.llm.messages import SystemMessage, UserMessage
    projected = project_observation(raw, 'hybrid', task, index, viewport, coordinate_space)
    image = projected['screenshot']
    if not isinstance(image, bytes) or not image.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Original PNG screenshot bytes required')
    # History contains only previously accepted actions from this component.
    for action in accepted_actions:
        validate_action(action, viewport, [f'task-image-{i}' for i in range(len(task.get('task_images', [])))], coordinate_space)
    text = json.dumps({'task': public_task_text(projected), 'controls': projected['controls'],
                       'action_error': projected['action_error'],
                       'visual_feedback': projected['visual_feedback'],
                       'accepted_actions': list(accepted_actions)}, ensure_ascii=False)
    content = [{'type': 'text', 'text': text}, {'type': 'image_url', 'image_url':
               {'url': 'data:image/png;base64,' + base64.b64encode(image).decode()}}]
    content.extend({'type': 'image_url', 'image_url': {'url': i['image_url']}} for i in projected['task_images'])
    messages = [SystemMessage(content='Complete the public task. Use one declared action at a time. '
        'A native select popup may not appear in a page screenshot. Once a visually identified select '
        'has focus, use Arrow keys and Enter if needed, then confirm its value in the next screenshot. '
        'Do not repeat an unchanged click without considering a different action. '+
        ('Point x,y are normalized 0..999; this overrides generic tool descriptions. Scroll distances remain CSS pixels.' if coordinate_space=='qwen-0-999' else 'Coordinates are screenshot CSS pixels.')), UserMessage(content=content)]
    # One upstream decision, no hidden empty-output retry, no model fallback.
    output = await agent.get_model_output(messages)
    if len(output.action) != 1:
        raise ModelOutputValidationError('Exactly one action required')
    action = output.action[0].model_dump(exclude_none=True)
    validate_action(action, viewport, [f'task-image-{i}' for i in range(len(task.get('task_images', [])))], coordinate_space)
    return action, messages


def validate_action(action, viewport, asset_ids=(), coordinate_space='css-pixels'):
    from framework_actions import to_css, validate
    parsed=browser_use_action(action, [1000,1000] if coordinate_space=='qwen-0-999' else viewport, asset_ids)
    # pss_scroll uses the viewport center internally, not a model point.
    if 'pss_scroll' in action:
        parsed=browser_use_action(action,viewport,asset_ids)
    else: parsed=to_css(parsed,viewport,coordinate_space)
    validate(parsed,viewport,asset_ids)
