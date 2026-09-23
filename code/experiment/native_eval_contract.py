"""Normalize official WAV task results, never wrapper reward or actor verdict.

This module does not evaluate a task. Its input must be the task-level result
from the pinned official evaluator, retained independently as hashed evidence.
Errors remain unresolved even when upstream assigns them numeric zero.
"""
import math


def wav_endpoint(result, task_id):
    if type(result.get('task_id')) is not int or result['task_id'] != task_id:
        raise ValueError('Native evaluator task identity mismatch')
    status, score = result.get('status'), result.get('score')
    if status not in ('success', 'failure', 'error'):
        raise ValueError('Expected official task-level status, not evaluator partial reward')
    if type(score) not in (int, float) or not math.isfinite(score) or score not in (0, 1):
        raise ValueError('Native WAV task score must be binary')
    if (status == 'success') != (score == 1):
        raise ValueError('Native WAV status/score contradiction')
    return {'assessment_status': 'unresolved' if status == 'error' else 'valid',
            'native_score': None if status == 'error' else int(score), 'verdict': None,
            'official_status': status, 'official_score': score,
            'failure_attribution': 'unknown' if status == 'error' else None}
