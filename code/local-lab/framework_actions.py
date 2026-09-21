"""A non-evaluating, single-action bridge. Never exec model-generated Python.

Coordinates are CSS pixels (not the legacy PSS normalized 0..1000 protocol).
Upload IDs refer only to pinned public task images. No arbitrary filesystem tool.
Tab indices are user-requested creation-order ordinals, never URLs/titles/DOM IDs.
"""
import ast
import math

FIELDS = {'click': {'x', 'y'}, 'double_click': {'x', 'y'}, 'move': {'x', 'y'},
          'type': {'text'}, 'key': {'key'}, 'scroll': {'x', 'y', 'dx', 'dy'},
          'wait': set(), 'done': {'text'}, 'upload': {'x', 'y', 'asset_id'},
          'tab_focus': {'index'}, 'tab_close': set(), 'back': set(), 'forward': set()}
KEYS = {'Enter', 'Tab', 'Shift+Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft',
        'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Backspace', 'Delete',
        'ControlOrMeta+A', 'Control+A', 'Meta+A'}


def coordinate_contract(value):
    if value not in ('css-pixels', 'qwen-0-999'):
        raise ValueError('Explicit supported coordinate codec required')
    return value


def to_css(action, viewport, coordinate_space):
    coordinate_contract(coordinate_space)
    result = dict(action)
    if coordinate_space == 'qwen-0-999' and 'x' in result:
        for key, size in zip(('x','y'),viewport):
            value=result[key]
            if type(value) not in (int,float) or not math.isfinite(value) or not 0<=value<=999:
                raise ValueError('Qwen coordinates require 0..999')
            # Alibaba's documented mapping divides by 1000, not 999. Never
            # infer units from a particular answer, clamp, or snap to a target.
            result[key]=value*size/1000
    return result


def validate(action, viewport, asset_ids=()):
    if not isinstance(action, dict) or action.get('name') not in FIELDS:
        raise ValueError('Undeclared action')
    name = action['name']
    if set(action) != FIELDS[name] | {'name'}:
        raise ValueError('Unexpected or missing action arguments')
    if 'x' in action:
        for field, limit in zip(('x', 'y'), viewport):
            v = action[field]
            if type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v < limit:
                raise ValueError('Coordinates outside screenshot')
    if name == 'scroll' and any(type(action[k]) not in (int, float) or not math.isfinite(action[k]) or abs(action[k]) > viewport[i]*2 for i, k in enumerate(('dx', 'dy'))):
        raise ValueError('Unbounded scroll')
    if name == 'key' and action['key'] not in KEYS:
        raise ValueError('Undeclared key')
    if name in ('type', 'done') and (not isinstance(action['text'], str) or len(action['text']) > 16000):
        raise ValueError('Invalid text')
    if name == 'tab_focus' and (type(action['index']) is not int or not 0 <= action['index'] < 64):
        raise ValueError('Invalid tab ordinal')
    if name == 'upload' and action['asset_id'] not in asset_ids:
        raise ValueError('Upload is not a pinned public task asset')
    return action


def agentlab_action(text, viewport, asset_ids=()):
    if not isinstance(text, str) or len(text) > 20000:
        raise ValueError('Action string required')
    tree = ast.parse(text, mode='exec')
    if len(tree.body) != 1 or not isinstance(tree.body[0], ast.Expr):
        raise ValueError('Exactly one action expression required')
    call = tree.body[0].value
    if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name):
        raise ValueError('No arbitrary Python or attribute access')
    signatures = {
        'mouse_click': ('click', ['x', 'y']), 'mouse_dblclick': ('double_click', ['x', 'y']),
        'mouse_move': ('move', ['x', 'y']), 'keyboard_type': ('type', ['text']),
        'keyboard_press': ('key', ['key']), 'scroll_at': ('scroll', ['x', 'y', 'dx', 'dy']),
        'noop': ('wait', []), 'send_msg_to_user': ('done', ['text']),
        'upload_task_image': ('upload', ['x', 'y', 'asset_id']),
        'focus_task_tab': ('tab_focus', ['index']), 'close_task_tab': ('tab_close', []),
        'task_back': ('back', []), 'task_forward': ('forward', [])}
    if call.func.id not in signatures:
        raise ValueError('Undeclared framework action')
    name, fields = signatures[call.func.id]
    if len(call.args) > len(fields):
        raise ValueError('Extra arguments')
    args = dict(zip(fields, [ast.literal_eval(v) for v in call.args]))
    for kw in call.keywords:
        if kw.arg not in fields or kw.arg in args:
            raise ValueError('Extra or duplicate arguments')
        args[kw.arg] = ast.literal_eval(kw.value)
    return validate({'name': name, **args}, viewport, asset_ids)


def browser_use_action(action, viewport, asset_ids=()):
    if not isinstance(action, dict) or len(action) != 1:
        raise ValueError('Single action required')
    name, args = next(iter(action.items()))
    mapping = {'pss_click': 'click', 'pss_type': 'type', 'pss_key': 'key', 'done': 'done',
               'pss_upload': 'upload', 'pss_tab_focus': 'tab_focus', 'pss_tab_close': 'tab_close',
               'pss_back': 'back', 'pss_forward': 'forward', 'pss_wait': 'wait'}
    if not isinstance(args, dict):
        raise ValueError('Arguments required')
    if name == 'pss_scroll':
        if set(args) != {'delta_y'}:
            raise ValueError('Invalid scroll schema')
        return validate({'name': 'scroll', 'x': viewport[0]/2, 'y': viewport[1]/2,
                         'dx': 0, 'dy': args['delta_y']}, viewport, asset_ids)
    if name not in mapping:
        raise ValueError('Undeclared tool')
    return validate({'name': mapping[name], **args}, viewport, asset_ids)


# These signatures feed the REAL BrowserGym tool-description/parser mechanism.
# Bodies must never execute; the shared journaled actuator dispatches the result.
def upload_task_image(x: float, y: float, asset_id: str):
    """Click the upload control at CSS coordinates and attach a public task image.

    Examples:
        upload_task_image(120, 200, "task-image-0")
    """
    raise RuntimeError('Use the journaled actuator')


def focus_task_tab(index: int):
    """Focus a tab by zero-based creation order, without reading its URL or title.

    Examples:
        focus_task_tab(0)
    """
    raise RuntimeError('Use the journaled actuator')


def close_task_tab():
    """Close the current tab.

    Examples:
        close_task_tab()
    """
    raise RuntimeError('Use the journaled actuator')


def task_back():
    """Use browser history to go back.

    Examples:
        task_back()
    """
    raise RuntimeError('Use the journaled actuator')


def task_forward():
    """Use browser history to go forward.

    Examples:
        task_forward()
    """
    raise RuntimeError('Use the journaled actuator')
