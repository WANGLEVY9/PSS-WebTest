"""Public, task-independent output instructions; no evaluator or gold imports.

WAV contract follows FinalAgentResponse at source commit
6473f72db5dcefc97b5725b59e734504edc28a21. This is a public protocol summary,
not a replacement parser. The original answer goes unchanged to native scoring.
"""
import json

WAV_TASK_TYPES = ('RETRIEVE', 'MUTATE', 'NAVIGATE')
WAV_STATUSES = ('SUCCESS', 'ACTION_NOT_ALLOWED_ERROR', 'PERMISSION_DENIED_ERROR',
                'NOT_FOUND_ERROR', 'DATA_VALIDATION_ERROR', 'UNKNOWN_ERROR')


def public_output_instruction(benchmark):
    if benchmark in (None, 'vwa'):
        return ''  # VWA retains its native free-text STOP answer contract.
    if benchmark == 'ata':
        return ('\nAt completion return only a JSON object with exactly two keys: '
                '"verdict": "PASS", "FAIL", or null; "failure_step": a positive '
                'integer official source step label or null. Use null verdict if '
                'no judgment can be reached. Only FAIL may have a non-null failure_step. '
                'No Markdown or extra keys. Report your own observed judgment, '
                'not a claim of ground truth. This output schema is identical for all methods.')
    if benchmark != 'wav':
        raise ValueError('Unknown public benchmark output contract')
    return ('\nOfficial WebArena-Verified final-answer protocol (identical for all methods): '
            'the text of your final completion action must be a JSON object, not Markdown. '
            'Required task_type is one of ' + json.dumps(WAV_TASK_TYPES) +
            '; required status is one of ' + json.dumps(WAV_STATUSES) + '. '
            'Optional retrieved_data is an array or null; array items may be strings, '
            'numbers, booleans, objects, or null (not nested arrays). For retrieval, '
            'return items of a consistent type; use the object format requested by the '
            'task, numeric amounts/counts and boolean true/false rather than strings. '
            'Use an empty array when no items were found, and null for mutate/navigate. '
            'Optional error_details is a string or null: null for SUCCESS, otherwise '
            'a concise explanation. Select these values from your observations; no '
            'expected task type, answer or outcome is supplied by this protocol.')
