"""Real AgentLab GenericAgent with an explicit PSS observation/action boundary.

Candidate component, not a native benchmark/reset/evaluator adapter. Deliberately
does not call GenericAgentArgs.set_benchmark: upstream resets observation/action
flags there. Native task integration must use this projection at every step.
"""
from dataclasses import dataclass
import json
from framework_boundary import project_observation, public_task_text


@dataclass
class RestrictedActionArgs:
    multiaction: bool = False
    strict: bool = True

    def make_action_set(self):
        from browsergym.core.action.highlevel import HighLevelActionSet
        action_set = HighLevelActionSet(subsets=['coord', 'chat'], multiaction=False,
                                       strict=True, retry_with_force=False, demo_mode='off')
        # File upload, arbitrary Python, DOM queries and URL navigation are not
        # model tools. Both modes use the same coordinate/keyboard action space.
        allowed = {'noop', 'mouse_click', 'mouse_dblclick', 'mouse_move', 'scroll_at',
                   'keyboard_press', 'keyboard_type', 'send_msg_to_user'}
        action_set.action_set = {k: v for k, v in action_set.action_set.items() if k in allowed}
        return action_set


def make_agent(chat_model_args, mode):
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
        max_prompt_tokens=None, use_concrete_example=False, use_abstract_example=False)
    # Upstream counts total parser attempts, not retries. 1 means one request;
    # 0 would silently make no request at all.
    return GenericAgent(chat_model_args=chat_model_args, flags=flags, max_retry=1)


def get_action(agent, raw, mode, task, index, viewport):
    projected = project_observation(raw, mode, task, index, viewport)
    # Blank mandatory framework fields rather than letting upstream preprocessor
    # derive structured side channels. Never use native reward/done to select actions.
    goal = [{'type': 'text', 'text': public_task_text(projected)}]
    goal.extend({'type': 'image_url', 'image_url': {'url': i['image_url']}} for i in projected['task_images'])
    observation = {'screenshot': projected['screenshot'], 'goal_object': goal,
                   'pruned_html': '', 'axtree_txt': json.dumps(projected.get('controls', []), ensure_ascii=False) if mode == 'hybrid' else '',
                   'focused_element_bid': '', 'last_action_error': projected['action_error'] or '',
                   'open_pages_urls': [], 'open_pages_titles': [], 'active_page_index': 0}
    return agent.get_action(observation)
