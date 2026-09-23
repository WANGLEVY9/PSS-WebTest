"""Shared SYNTHETIC_TEST data only. Never official task/source evidence."""
import json
from pathlib import Path
from runtime_identity import sha, array_hash
from runtime_store import digest


def fixture_package(directory: str, binding: dict, round: str = 'D1') -> tuple:
    root = Path(directory)
    spec, evaluation = root / 'input.json', root / 'evaluation.json'
    source = root / 'source.json'; source.write_bytes(b'SYNTHETIC_TEST')
    spec.write_text('{"intent":"synthetic"}')
    evaluation.write_text('{"gold":"SYNTHETIC_EVALUATOR_ONLY"}')
    ref = 'EVALUATOR_ONLY'
    task = {'task_key': 'wav:fixture', 'benchmark': 'wav', 'official_task_id': 'SYNTHETIC',
            'application': 'fixture', 'template_id': 'fixture', 'source_sha256': sha(b'SYNTHETIC_TEST'),
            'agent_input_sha256': sha(spec.read_bytes()), 'evaluation_sha256': sha(evaluation.read_bytes()),
            'evaluation_ref_sha256': sha(ref.encode())}
    raw = json.dumps(task, ensure_ascii=False, separators=(',', ':'))
    op = {'protocol_id': 'pss-manuscript-v2.1', 'scope': 'synthetic', 'schedule_sha256': 'd'*64,
          'task_key': task['task_key'], 'benchmark': 'wav', 'config_id': 'v1', 'round': round,
          'phase': 'discovery' if round.startswith('D') else 'validation',
          'identity_schema': 'task-bound-opportunity-v1', 'task_manifest_json': raw,
          'task_manifest_sha256': sha(raw.encode()), 'executor_binding_sha256':digest(binding)}
    op['opportunity_id'] = array_hash([op['schedule_sha256'],op['task_manifest_sha256'],op['executor_binding_sha256'],op['task_key'],op['config_id'],round])
    package = {'executors': {'v1': {'wav': binding}}, 'tasks': {task['task_key']: {
        'agent_input_file': str(spec), 'agent_input_sha256': task['agent_input_sha256'],
        'source_file': str(source),
        'evaluation_ref': ref, 'evaluation_file': str(evaluation)}}}
    return op, package


def bound_fixture(directory: str, binding: dict, round: str = 'D1') -> dict:
    from bind_runtime_plan import bind
    op, package = fixture_package(directory, binding, round)
    return list(bind([op], package))[0]


def receipt_identity(payload: dict) -> dict:
    keys = ('opportunity_id', 'environment_id', 'configuration_sha256', 'lease_token',
            'task_manifest_sha256', 'evaluation_ref', 'evaluation_sha256', 'scope', 'data_kind')
    return {k: payload[k] for k in keys if k in payload}
