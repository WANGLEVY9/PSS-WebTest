"""Prospective, monotonic phase accounting; never infer actor time from subprocess time.

All timestamps belong to one process/boot, never compare absolute monotonic
timestamps across hosts. Reset/cleanup are separately measured by the worker.
Legacy receipts are readable but do not satisfy this policy's admission gate.
"""
import math

POLICY = 'actor-phase-monotonic-v1'
LIMITS = ('setup_ms', 'evaluation_ms', 'finalization_ms', 'transport_ms')


def validate_limits(limits):
    if not isinstance(limits, dict) or set(limits) != set(LIMITS):
        raise ValueError('Explicit frozen lifecycle limits required')
    if any(type(limits[k]) is not int or limits[k] <= 0 for k in LIMITS):
        raise ValueError('Positive integer lifecycle limits required')
    return limits


def envelope_budget(budget, limits):
    validate_limits(limits)
    value = budget.get('task_timeout_ms')
    if type(value) is not int or value <= 0:
        raise ValueError('Frozen actor budget required')
    return value + sum(limits.values())


def window(start, end):
    if type(start) is not int or type(end) is not int or start < 0 or end < start:
        raise ValueError('Ordered monotonic nanoseconds required')
    return {'start_ns': start, 'end_ns': end, 'elapsed_ms': (end-start)/1_000_000}


def verify_window(value):
    if not isinstance(value, dict) or set(value) != {'start_ns', 'end_ns', 'elapsed_ms'}:
        raise ValueError('Exact lifecycle window required')
    expected = window(value['start_ns'], value['end_ns'])
    elapsed = value['elapsed_ms']
    if type(elapsed) not in (float, int) or not math.isfinite(elapsed) or elapsed != expected['elapsed_ms']:
        raise ValueError('Lifecycle elapsed time disagrees with monotonic bounds')
    return expected


def verify_timing(timing, actor, limits=None):
    if not isinstance(timing, dict) or set(timing) != {'policy', 'phases'} or timing['policy'] != POLICY:
        raise ValueError('Current lifecycle timing policy required')
    phases = timing['phases']
    order = ('setup', 'actor', 'evaluation', 'finalization')
    if not isinstance(phases, dict) or set(phases) != set(order):
        raise ValueError('All lifecycle phases must be accounted')
    previous = None
    for name in order:
        part = verify_window(phases[name])
        if previous is not None and part['start_ns'] != previous:
            raise ValueError('Lifecycle phases overlap or leave unaccounted time')
        previous = part['end_ns']
    actor_time = verify_window(actor.get('actor_timing'))
    if actor.get('timing_policy') != POLICY or actor.get('elapsed_ms') != actor_time['elapsed_ms']:
        raise ValueError('Actor receipt uses a different clock definition')
    outer = phases['actor']
    if not outer['start_ns'] <= actor_time['start_ns'] <= actor_time['end_ns'] <= outer['end_ns']:
        raise ValueError('Actor time is outside trusted invocation window')
    if limits is not None:
        validate_limits(limits)
        for name in ('setup', 'evaluation', 'finalization'):
            if phases[name]['elapsed_ms'] > limits[name+'_ms']:
                raise ValueError('Lifecycle administrative phase exceeded frozen limit: '+name)
    return actor_time['elapsed_ms']
