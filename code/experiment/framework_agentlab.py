"""Real AgentLab GenericAgent with an explicit PSS observation/action boundary.

Candidate component, not a native benchmark/reset/evaluator adapter. Deliberately
does not call GenericAgentArgs.set_benchmark: upstream resets observation/action
flags there. Native task integration must use this projection at every step.
"""
from dataclasses import dataclass
import json
from unittest.mock import patch
from framework_boundary import project_observation, public_task_text
from framework_actions import upload_task_image, focus_task_tab, close_task_tab, task_back, task_forward


@dataclass
class RestrictedActionArgs:
    multiaction: bool = False
    strict: bool = True

    def make_action_set(self):
        from browsergym.core.action.highlevel import HighLevelActionSet
        action_set = HighLevelActionSet(subsets=['coord', 'chat', 'custom'],
                                       custom_actions=[upload_task_image, focus_task_tab, close_task_tab, task_back, task_forward], multiaction=False,
                                       strict=True, retry_with_force=False, demo_mode='off')
        # Upload is restricted to task asset IDs; arbitrary paths/Python, DOM
        # queries and goto(URL) are not tools. Both arms share this action space.
        allowed = {'noop', 'mouse_click', 'mouse_dblclick', 'mouse_move', 'scroll_at',
                   'keyboard_press', 'keyboard_type', 'send_msg_to_user',
                   'upload_task_image', 'focus_task_tab', 'close_task_tab', 'task_back', 'task_forward'}
        action_set.action_set = {k: v for k, v in action_set.action_set.items() if k in allowed}
        return action_set


def make_agent(chat_model_args, mode, coordinate_space='css-pixels'):
    from agentlab.agents.generic_agent.generic_agent import GenericAgent
    from agentlab.agents.generic_agent.generic_agent_prompt import GenericPromptFlags
    from agentlab.agents.dynamic_prompting import ObsFlags, ActionFlags
    if mode not in ('visual', 'hybrid') or not chat_model_args.vision_support:
        raise ValueError('Explicit visual/hybrid mode and vision-capable model required')
    flags = GenericPromptFlags(
        obs=ObsFlags(use_html=False, use_ax_tree=mode == 'hybrid', use_tabs=False,
                     use_focused_element=False, use_screenshot=True, use_som=False,
                     use_error_logs=True, use_history=True, use_action_history=True,
                     use_think_history=False, use_diff=False, openai_vision_detail='high'),
        action=ActionFlags(action_set=RestrictedActionArgs()), use_thinking=False,
        use_plan=False, use_memory=False, use_hints=False, enable_chat=False,
        max_prompt_tokens=None, use_concrete_example=False, use_abstract_example=True,
        extra_instructions=('For this run, point x,y use normalized 0..999 axes, NOT the generic tool descriptions\' CSS pixels. Scroll distances remain CSS pixels. ' if coordinate_space=='qwen-0-999' else '') +
        'Return exactly one action inside <action>...</action> tags. '
        'Keep the entire reply to that single action tag; do not narrate the screenshot, '
        'repeat prior steps, or include reasoning or Markdown. '
        'A native select popup may not appear in a page screenshot. After focusing a '
        'visually identified select, keyboard interaction may be necessary; confirm any '
        'selected value in the next screenshot rather than assuming an invisible popup changed. '
        'PSS actuator restrictions override generic action descriptions: no bid IDs; '
        'mouse_click and mouse_dblclick accept only x,y (left button); noop() takes no arguments. '
        'keyboard_press accepts only Enter, Tab, Shift+Tab, Escape, ArrowUp, ArrowDown, ArrowLeft, '
        'ArrowRight, PageUp, PageDown, Home, End, Backspace, Delete, ControlOrMeta+A, Control+A, Meta+A. '
        'Use keyboard_type for all text. Upload uses only the supplied task-image IDs, never filesystem paths.')
    # Upstream counts total parser attempts, not retries. 1 means one request;
    # 0 would silently make no request at all.
    return GenericAgent(chat_model_args=chat_model_args, flags=flags, max_retry=1)


def get_action(agent, raw, mode, task, index, viewport, coordinate_space='css-pixels'):
    from agentlab.agents import dynamic_prompting as dp
    from agentlab.llm.llm_utils import image_to_png_base64_url
    projected = project_observation(raw, mode, task, index, viewport, coordinate_space)
    # Blank mandatory framework fields rather than letting upstream preprocessor
    # derive structured side channels. Never use native reward/done to select actions.
    goal = [{'type': 'text', 'text': public_task_text(projected)}]
    goal.extend({'type': 'image_url', 'image_url': {'url': i['image_url']}} for i in projected['task_images'])
    observation = {'screenshot': projected['screenshot'], 'goal_object': goal,
                   'pruned_html': '', 'axtree_txt': json.dumps(projected.get('controls', []), ensure_ascii=False) if mode == 'hybrid' else '',
                   'focused_element_bid': '', 'last_action_error': projected['action_error'] or '',
                   'open_pages_urls': [], 'open_pages_titles': [], 'active_page_index': 0}
    # AgentLab upstream's Observation.add_screenshot encodes screenshots as
    # lossy JPEG. Keep its real prompt/parser/decision loop while replacing
    # only that image transport with lossless PNG for pixel-grounded actions.
    # Scope the patch to one synchronous decision, never the benchmark process.
    def lossless_add_screenshot(self, prompt):
        if self.flags.use_screenshot:
            if self.flags.use_som:
                raise ValueError('Set-of-marks overlay is outside this boundary')
            prompt.add_text('\n## Screenshot:\nHere is a screenshot of the page:')
            prompt.add_image(image_to_png_base64_url(self.obs['screenshot']),
                             detail=self.flags.openai_vision_detail)
        return prompt
    with patch.object(dp.Observation, 'add_screenshot', lossless_add_screenshot):
        return agent.get_action(observation)
