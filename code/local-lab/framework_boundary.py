"""Information-boundary projection shared by candidate framework adapters.

No raw framework observation is forwarded. Hybrid producers must independently
verify visibility/occlusion; passing this schema alone is NOT that live audit.
"""
import json
import math
from framework_actions import coordinate_contract

ERRORS = {'action-rejected', 'action-timeout', 'target-unavailable', 'browser-error'}


def visible_controls(controls, viewport, observation_index):
    allowed = {'role', 'name', 'value', 'state', 'box', 'visible', 'in_viewport'}
    if not isinstance(controls, list):
        raise ValueError('Explicit visible control projection required')
    projected = []
    for control in controls:
        if not isinstance(control, dict) or set(control) - allowed:
            raise ValueError('Raw DOM/AX attributes are not an allowed projection')
        if control.get('visible') is not True or control.get('in_viewport') is not True:
            continue
        box = control.get('box')
        if not isinstance(box, list) or len(box) != 4 or not all(type(v) in (int, float) and math.isfinite(v) for v in box):
            raise ValueError('Finite bounding box required')
        x, y, w, h = box
        if w <= 0 or h <= 0 or x < 0 or y < 0 or x+w > viewport[0] or y+h > viewport[1]:
            raise ValueError('Unclipped/offscreen control')
        if not all(isinstance(control.get(k, ''), str) for k in ('role', 'name', 'value', 'state')):
            raise ValueError('Projected semantic fields must be strings')
        projected.append({'target_id': f'o{observation_index}-t{len(projected)}',
                          **{k: control.get(k, '') for k in ('role', 'name', 'value', 'state')}, 'box': box})
    return projected


def project_observation(raw, mode, task, index, viewport, coordinate_space='css-pixels'):
    coordinate_contract(coordinate_space)
    if mode not in ('visual', 'hybrid') or type(index) is not int or index < 0:
        raise ValueError('Explicit mode and observation index required')
    if len(viewport) != 2 or not all(type(v) is int and v > 0 for v in viewport):
        raise ValueError('Positive viewport dimensions required')
    # Do not inspect URL, DOM, AX, reward, goal or termination flags, even for
    # progress/stopping decisions. The intent comes from the pinned task input.
    result = {'screenshot': raw['screenshot'], 'intent': task['intent'],
              'task_images': task.get('task_images', []), 'steps': task.get('steps', []),
              'observation_index': index, 'viewport': list(viewport), 'coordinate_space':coordinate_space,
              'action_error': raw.get('action_error') if raw.get('action_error') in ERRORS else None}
    if mode == 'hybrid':
        result['controls'] = visible_controls(raw['visible_controls'], viewport, index)
        if coordinate_space=='qwen-0-999':
            for control in result['controls']:
                control['box']=[v*1000/viewport[i%2] for i,v in enumerate(control['box'])]
    return result


def public_task_text(projected):
    text = projected['intent']
    if projected['steps']:
        text += '\nOfficial test steps and expected behavior:\n' + json.dumps(projected['steps'], ensure_ascii=False)
    if projected['task_images']:
        text += '\nPublic task images, in attached order: ' + ', '.join(f'task-image-{i}' for i in range(len(projected['task_images'])))
    text += ('\nPoint x,y coordinates MUST be normalized to 0..999 independently on each axis; x=1000*pixel_x/image_width and y=1000*pixel_y/image_height. Control boxes use the same normalized axes. Scroll dx,dy remain CSS pixel distances.'
             if projected.get('coordinate_space')=='qwen-0-999' else '\nCoordinates are CSS screenshot pixels.')
    text += '\nTab ordinals are zero-based creation order (closed ordinals are not reused). No tab URLs or titles are supplied.'
    return text
