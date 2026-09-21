"""Restricted Browser Use decision/tool component (NOT the default Agent.run).

Uses upstream Agent.get_model_output and tool registry/schema. The outer native
benchmark adapter must own reset, observations, action execution and evaluation.
This component intentionally blocks the stock run loop until those are bound.
"""
import base64
import json
from framework_boundary import project_observation, public_task_text


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

    @tools.action('Type text at current keyboard focus.')
    async def pss_type(text: str):
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Scroll vertically by CSS pixels; positive means down.')
    async def pss_scroll(delta_y: int):
        raise RuntimeError('Use the benchmark-owned journaled actuator')

    @tools.action('Press a keyboard key.')
    async def pss_key(key: str):
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
                raise ValueError('Exactly one action required; never truncate a model response')
            return output

    return RestrictedAgent(task=task, llm=llm, browser=browser, tools=tools,
        file_system_path=str(private_directory), use_vision=True, use_thinking=False,
        max_actions_per_step=1, use_judge=False, calculate_cost=False,
        directly_open_url=False, enable_planning=False, loop_detection_enabled=False,
        message_compaction=False, final_response_after_failure=False,
        fallback_llm=None, enable_signal_handler=False,
        override_system_message='Execute only the supplied public task with the declared actions and observations. Never infer success from your own completion claim.')


async def get_action(agent, raw, task, index, viewport, accepted_actions=()):
    from browser_use.llm.messages import SystemMessage, UserMessage
    projected = project_observation(raw, 'hybrid', task, index, viewport)
    image = projected['screenshot']
    if not isinstance(image, bytes) or not image.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Original PNG screenshot bytes required')
    # History contains only previously accepted actions from this component.
    for action in accepted_actions:
        validate_action(action, viewport)
    text = json.dumps({'task': public_task_text(projected), 'controls': projected['controls'],
                       'action_error': projected['action_error'], 'accepted_actions': list(accepted_actions)}, ensure_ascii=False)
    content = [{'type': 'text', 'text': text}, {'type': 'image_url', 'image_url':
               {'url': 'data:image/png;base64,' + base64.b64encode(image).decode()}}]
    content.extend({'type': 'image_url', 'image_url': {'url': i['image_url']}} for i in projected['task_images'])
    messages = [SystemMessage(content='Complete the public task. Use one declared action at a time. Coordinates are screenshot CSS pixels.'), UserMessage(content=content)]
    # One upstream decision, no hidden empty-output retry, no model fallback.
    output = await agent.get_model_output(messages)
    if len(output.action) != 1:
        raise ValueError('Exactly one action required')
    action = output.action[0].model_dump(exclude_none=True)
    validate_action(action, viewport)
    return action, messages


def validate_action(action, viewport):
    if not isinstance(action, dict) or len(action) != 1:
        raise ValueError('Single allowed action required')
    name, args = next(iter(action.items()))
    fields = {'pss_click': {'x', 'y'}, 'pss_type': {'text'}, 'pss_scroll': {'delta_y'}, 'pss_key': {'key'}, 'done': {'text'}}
    if name not in fields or not isinstance(args, dict) or set(args) != fields[name]:
        raise ValueError('Undeclared Browser Use action/arguments')
    if name == 'pss_click' and not all(type(args[k]) is int and 0 <= args[k] < viewport[i] for i, k in enumerate(('x', 'y'))):
        raise ValueError('Click outside screenshot')
    if name == 'pss_scroll' and (type(args['delta_y']) is not int or abs(args['delta_y']) > viewport[1]*2):
        raise ValueError('Invalid bounded scroll')
    if name == 'pss_key' and args['key'] not in ('Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Backspace'):
        raise ValueError('Undeclared key')
    if name in ('pss_type', 'done') and not isinstance(args['text'], str):
        raise ValueError('Text required')
