"""Pinned official WebArena-Verified evaluator subprocess (diagnostic only).

CLI: python wav_native_evaluate.py --manifest FILE --manifest-sha256 SHA
stdin: worker identity, evaluation_ref, actor_result with the SAME identity and
       final_answer (unaltered text or null), plus actor_lifecycle_ref {file,sha256}.

Manifest v1: scope diagnostic|synthetic, source_dir, source_commit,
source_dataset_sha256, environment_config_ref, network_trace_root,
private_artifact_root. The environment config MUST explicitly name the pinned
official dataset; upstream's silent missing-file fallback is not accepted.

No browser/model calls, fixture reset, answer repair, evaluator monkeypatch,
reward averaging, or actor feedback. HAR is read only after the caller closes
the browser context. Its sealed copy and native gold-bearing result remain
private. A hash alone is not reset/isolation provenance: campaign admission and
HAR-to-trajectory attestation are deliberately separate requirements.
"""
import argparse
from contextlib import contextmanager, redirect_stderr, redirect_stdout
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import uuid

from native_eval_contract import wav_endpoint
from prepare_navigation_runtime import PINS
from benchmark_actor_lifecycle import verify_lifecycle

IDENTITY = ('opportunity_id', 'environment_id', 'configuration_sha256')
SCHEMA = 'pss-wav-native-evaluator-v1'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pinned(ref):
    if not isinstance(ref, dict) or set(ref) != {'file', 'sha256'}:
        raise ValueError('Exact pinned file reference required')
    if not isinstance(ref['sha256'], str) or not re.fullmatch('[0-9a-f]{64}', ref['sha256']):
        raise ValueError('SHA256 required')
    path = Path(ref['file'])
    if not path.is_absolute():
        raise ValueError('Absolute pinned path required')
    raw = path.read_bytes()
    if sha(raw) != ref['sha256']:
        raise ValueError('Pinned artifact changed')
    return raw


def private_write(path, raw):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    return {'file': str(path), 'sha256': sha(raw)}


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()


@contextmanager
def private_logging(stream):
    """Subprocess-local log routing, including helper loggers using __name__."""
    names = [''] + [name for name in logging.Logger.manager.loggerDict
                    if name == 'WebArena-Verified' or name.startswith('webarena_verified')]
    names.append('WebArena-Verified')
    loggers = [logging.getLogger(name) for name in dict.fromkeys(names)]
    old = [(logger, list(logger.handlers), logger.propagate) for logger in loggers]
    handler = logging.StreamHandler(stream)
    try:
        for logger in loggers:
            logger.handlers = [handler]
            logger.propagate = False
        yield
    finally:
        for logger, handlers, propagate in old:
            logger.handlers, logger.propagate = handlers, propagate
        handler.close()


def verify_source(source):
    """Check checkout pin AND the actual imported evaluator's complete Python tree."""
    source = Path(source).resolve()
    head = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    dirty = subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain', '--untracked-files=no'], text=True).strip()
    if head != PINS['wav'] or dirty:
        raise ValueError('Clean pinned WAV source required')
    import webarena_verified
    installed = Path(webarena_verified.__file__).resolve().parent
    expected = source / 'src/webarena_verified'
    actual_files = {p.relative_to(installed): p for p in installed.rglob('*.py')}
    expected_files = {p.relative_to(expected): p for p in expected.rglob('*.py')}
    if not actual_files or actual_files.keys() != expected_files.keys():
        raise ValueError('Installed evaluator file set differs from pinned source')
    entries = {}
    for relative, path in sorted(expected_files.items()):
        raw = path.read_bytes()
        if actual_files[relative].read_bytes() != raw:
            raise ValueError('Installed evaluator bytes differ from pinned source')
        entries[str(relative)] = sha(raw)
    return sha(json_bytes(entries))


def validate_identity(payload):
    if not isinstance(payload, dict):
        raise ValueError('Worker payload required')
    identity = {k: payload.get(k) for k in IDENTITY}
    if not all(isinstance(v, str) and v.strip() for v in identity.values()):
        raise ValueError('Nonempty worker identities required')
    if not re.fullmatch('[0-9a-f]{64}', identity['configuration_sha256']):
        raise ValueError('Pinned execution configuration required')
    scope=payload.get('scope')
    kind='MEASURED' if scope=='diagnostic' else 'SYNTHETIC_TEST'
    if scope not in ('synthetic','diagnostic') or payload.get('data_kind')!=kind:
        raise ValueError('Explicit worker provenance required')
    actor = payload.get('actor_result')
    if not isinstance(actor, dict) or any(actor.get(k) != identity[k] for k in IDENTITY):
        raise ValueError('Actor result belongs to another execution')
    if actor.get('scope')!=scope or actor.get('data_kind')!=kind:
        raise ValueError('Actor provenance differs from trusted worker payload')
    if 'final_answer' not in actor or actor['final_answer'] is not None and not isinstance(actor['final_answer'], str):
        raise ValueError('Unaltered final answer text or explicit null required')
    return identity, actor


def evaluate(payload, manifest_ref):
    """Return a worker-compatible public receipt; full native results stay private."""
    identity, actor = validate_identity(payload)
    manifest = json.loads(pinned(manifest_ref))
    required = {'schema', 'scope', 'source_dir', 'source_commit', 'source_dataset_sha256',
                'environment_config_ref', 'network_trace_root', 'private_artifact_root'}
    if not isinstance(manifest, dict) or set(manifest) != required or manifest['schema'] != SCHEMA:
        raise ValueError('Pinned native evaluator manifest required')
    if manifest['scope'] not in ('synthetic', 'diagnostic'):
        raise ValueError('Formal collection is not authorized by this adapter')
    if manifest['scope']!=payload['scope']:
        raise ValueError('Evaluator manifest provenance differs from worker')
    if manifest['source_commit'] != PINS['wav']:
        raise ValueError('Unreviewed official source commit')
    source = Path(manifest['source_dir']).resolve()
    dataset = source / 'assets/dataset/webarena-verified.json'
    dataset_raw = pinned({'file': str(dataset), 'sha256': manifest['source_dataset_sha256']})
    evaluation_ref = payload.get('evaluation_ref')
    gold = json.loads(pinned(evaluation_ref))
    official_id = gold.get('official_task_id')
    if not isinstance(official_id, str) or not re.fullmatch('0|[1-9][0-9]*', official_id):
        raise ValueError('Canonical official WAV task ID required')
    task_id = int(official_id)
    source_rows = json.loads(dataset_raw)
    matches = [row for row in source_rows if type(row.get('task_id')) is int and row['task_id'] == task_id]
    if len(matches) != 1 or len(source_rows) != 812:
        raise ValueError('Official task missing, duplicated, or population drift')
    official_row = matches[0]
    if (gold.get('benchmark') != 'wav' or gold.get('source_commit') != PINS['wav']
            or gold.get('source_sha256') != sha(dataset_raw)
            or gold.get('application') != '+'.join(official_row['sites'])
            or gold.get('official_config') != official_row):
        raise ValueError('Evaluation reference does not match the pinned official task')
    config_raw = pinned(manifest['environment_config_ref'])
    config_dict = json.loads(config_raw)
    configured_data = config_dict.get('test_data_file')
    if not isinstance(configured_data, str) or not Path(configured_data).is_absolute() or Path(configured_data).resolve() != dataset:
        raise ValueError('Config must explicitly bind pinned dataset; fallback forbidden')
    lifecycle_ref=payload.get('actor_lifecycle_ref')
    lifecycle=verify_lifecycle(lifecycle_ref,actor)
    if lifecycle['scope']!=manifest['scope']:
        raise ValueError('Lifecycle/evaluator provenance scope mismatch')
    trace_ref = lifecycle['network_trace_ref']
    trace_raw = pinned(trace_ref)
    trace_root = Path(manifest['network_trace_root']).resolve()
    if trace_root not in Path(trace_ref['file']).resolve().parents:
        raise ValueError('HAR outside declared execution artifact root')
    output_root = Path(manifest['private_artifact_root'])
    if not output_root.is_absolute() or output_root.is_symlink():
        raise ValueError('Absolute nonsymlink private artifact root required')
    # Never silently chmod a shared directory or make existing public artifacts private.
    output_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if stat.S_IMODE(output_root.stat().st_mode) & 0o077:
        raise ValueError('Evaluator artifact root must deny group and other access')
    run_dir = output_root / ('eval-' + uuid.uuid4().hex)
    run_dir.mkdir(mode=0o700)
    log_path = run_dir / 'native-private.log'
    log_fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    # Upstream assertion logs can contain expected answers: suppress propagation,
    # retain them in the evaluator-private directory, and never print exceptions.
    with os.fdopen(log_fd, 'w') as private_log, redirect_stdout(private_log), redirect_stderr(private_log), private_logging(private_log):
        try:
            source_tree_sha = verify_source(source)
            from webarena_verified import WebArenaVerified
            from webarena_verified.types.config import WebArenaVerifiedConfig
            from webarena_verified.types.task import WebArenaVerifiedTask
            config = WebArenaVerifiedConfig.model_validate(config_dict)
            if config.test_data_file.resolve() != dataset:
                raise ValueError('Native dataset fallback detected')
            official = WebArenaVerified(config=config)
            loaded_task = official.get_task(task_id)
            expected_task = WebArenaVerifiedTask.model_validate(official_row)
            if loaded_task.model_dump(mode='json') != expected_task.model_dump(mode='json'):
                raise ValueError('Actually loaded native task differs from frozen task')
            sealed_trace = private_write(run_dir / 'network.har', trace_raw)
            answer_ref = private_write(run_dir / 'actor-answer.json', json_bytes({'final_answer': actor['final_answer']}))
            # Call the recommended upstream API. Pass original text/null, without
            # JSON extraction, status substitution, case fixes, or answer repair.
            result = official.evaluate_task(task_id=task_id, agent_response=actor['final_answer'],
                                            network_trace=Path(sealed_trace['file']))
            native_result = result.model_dump(mode='json')
            if native_result.get('webarena_verified_data_checksum') != sha(dataset_raw):
                raise ValueError('Native evaluator used a different dataset')
            result_ref = private_write(run_dir / 'native-result.json', json_bytes(native_result))
            endpoint = wav_endpoint(native_result, task_id)
        except Exception:
            logging.getLogger('WebArena-Verified').exception('Private native evaluator exception')
            raise
    return {**identity, **endpoint, 'schema': SCHEMA, 'benchmark': 'wav',
            'official_task_id': official_id, 'source_commit': PINS['wav'],
            'source_sha256': sha(dataset_raw), 'installed_source_tree_sha256': source_tree_sha,
            'evaluation_ref': evaluation_ref, 'manifest_sha256': manifest_ref['sha256'],
            'actor_lifecycle_ref': lifecycle_ref, 'source_network_trace_sha256': trace_ref['sha256'],
            'environment_config_sha256': sha(config_raw), 'network_trace_ref': sealed_trace,
            'actor_answer_ref': answer_ref, 'native_result_ref': result_ref,
            'native_log_ref': {'file': str(log_path), 'sha256': sha(log_path.read_bytes())},
            'scope': manifest['scope'], 'data_kind': 'MEASURED' if manifest['scope']=='diagnostic' else 'SYNTHETIC_TEST',
            'confirmatory_authorized': False,
            'reset_isolation_verified_by_adapter': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    args = parser.parse_args()
    try:
        payload = json.load(sys.stdin)
        receipt = evaluate(payload, {'file': args.manifest, 'sha256': args.manifest_sha256})
        print(json.dumps(receipt, ensure_ascii=False, allow_nan=False))
        return 0
    except Exception as exc:
        # Do not turn adapter validation errors into native score=0 or leak gold.
        print(json.dumps({'adapter_error_type': type(exc).__name__,
                          'assessment_status': 'unresolved', 'native_score': None,
                          'verdict': None, 'confirmatory_authorized': False}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
