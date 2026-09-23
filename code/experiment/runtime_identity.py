"""Validate byte-bound diagnostic plans before any reset/provider side effect."""
import hashlib
import json
from pathlib import Path


def sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def array_hash(value: list) -> str:
    # Same UTF-8 array serialization as the JS scheduler (identity fields are strings).
    return sha(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode())


def task_contract(op: dict) -> dict:
    raw = op.get('task_manifest_json')
    if op.get('identity_schema') != 'task-bound-opportunity-v1' or not isinstance(raw, str) or sha(raw.encode()) != op.get('task_manifest_sha256'):
        raise ValueError('Frozen task manifest identity required; legacy plans must be reconciled')
    task = json.loads(raw)
    if any(task.get(k) != op.get(k) for k in ('task_key', 'benchmark')):
        raise ValueError('Task manifest does not match opportunity')
    expected = array_hash([op['schedule_sha256'], op['task_manifest_sha256'], op.get('executor_binding_sha256'), op['task_key'], op['config_id'], op['round']])
    if expected != op['opportunity_id']:
        raise ValueError('Task/schedule opportunity identity mismatch')
    if op.get('phase') != ('discovery' if op['round'] in ('D1', 'D2') else 'validation') or op['round'] not in ['D1', 'D2'] + [f'V{i}' for i in range(1, 11)]:
        raise ValueError('Frozen round/phase mismatch')
    for key in ('source_sha256', 'agent_input_sha256', 'evaluation_sha256', 'evaluation_ref_sha256'):
        value = task.get(key)
        if not isinstance(value, str) or len(value) != 64 or any(c not in '0123456789abcdef' for c in value):
            raise ValueError('Task must freeze source/input/evaluator digests before scheduling: ' + key)
    return task


def verify_bound_input(op: dict) -> dict:
    task = task_contract(op)
    raw = op.get('agent_input_json')
    if not isinstance(raw, str) or sha(raw.encode()) != task['agent_input_sha256']:
        raise ValueError('Bound agent input differs from frozen task')
    decoded = json.loads(raw)
    if op.get('task_input_binding'):
        from runtime_inputs import task_projection, verify_bound_input as verify_projection
        decoded = task_projection(decoded, op['benchmark'])
        verify_projection(op)
    elif op.get('scope') != 'synthetic':
        raise ValueError('Missing frozen task input correspondence')
    if decoded != op.get('agent_input'):
        raise ValueError('Bound agent input differs from frozen task')
    ref = op.get('evaluation_ref')
    if isinstance(ref, dict):
        from runtime_store import digest
        reference_hash = digest(ref)
        if str(Path(ref.get('file', '')).resolve()) != op.get('evaluation_file') or ref.get('sha256') != task['evaluation_sha256']:
            raise ValueError('Evaluator reference/artifact mismatch')
    else:
        reference_hash = sha(ref.encode()) if isinstance(ref, str) else None
    if reference_hash != task['evaluation_ref_sha256']:
        raise ValueError('Evaluator reference differs from frozen task')
    file = Path(op['evaluation_file'])
    if not file.is_absolute() or sha(file.read_bytes()) != task['evaluation_sha256']:
        raise ValueError('Evaluator artifact differs from frozen task')
    if task.get('setup_ref_sha256') is not None or op.get('setup_ref') is not None:
        from runtime_store import digest
        if digest(op.get('setup_ref')) != task.get('setup_ref_sha256'):
            raise ValueError('Environment setup differs from frozen task')
    source = Path(op['source_file'])
    if not source.is_absolute() or sha(source.read_bytes()) != task['source_sha256']:
        raise ValueError('Original source artifact differs from frozen task')
    return task


def receipt_binding(payload):
    """Preserve optional v3 identities; v3 workers require both on every stage."""
    result = {}
    for key in ('lease_token', 'task_manifest_sha256'):
        if key in payload:
            value = payload[key]
            if not isinstance(value, str) or not value:
                raise ValueError('Nonempty receipt binding required')
            result[key] = value
    return result
