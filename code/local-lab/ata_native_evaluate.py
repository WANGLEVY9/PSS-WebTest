"""Independent ATA reference-label evaluation, not an agent-as-gold oracle.

The published evaluation.py couples its agent, remote reset, and metric update.
We do NOT import/run that orchestrator. This adapter independently compares an
unaltered public JSON prediction with the checksum-pinned published CSV labels.
Source and truth-table controls cover the well-defined binary/step domain;
live upstream-orchestrator parity is not claimed. Missing verdicts, unknown verdicts, and ambiguous
source step labels are explicitly unscored; upstream's unknown-as-fail fallback
is deliberately NOT reproduced. Live fixture-label parity remains a separate
reset/admission gate; a source label alone proves no live defect.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import uuid
import zipfile

from ata_mapping import source_catalog, parser
from benchmark_actor_lifecycle import verify_lifecycle

SCHEMA = 'pss-ata-reference-evaluator-v1'
ARCHIVE_SHA256 = 'c0b0a21f3ca5871f8c6db59e7d015e04350c577aef8714091e40246dc8fcb3bf'
CATALOG_SHA256 = '67c27329a41c83b8ac6eacf9ce0e2d9f639a3767e52d6bd111702b807aa1dad1'
IDENTITY = ('opportunity_id', 'environment_id', 'configuration_sha256')


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def pinned(ref):
    if (not isinstance(ref, dict) or set(ref) != {'file', 'sha256'}
            or not isinstance(ref['file'], str) or not Path(ref['file']).is_absolute()
            or not isinstance(ref['sha256'], str) or not re.fullmatch('[0-9a-f]{64}', ref['sha256'])):
        raise ValueError('Exact absolute pinned artifact reference required')
    raw = Path(ref['file']).read_bytes()
    if sha(raw) != ref['sha256']:
        raise ValueError('Pinned artifact changed')
    return raw


def persist(path, value):
    raw = encoded(value)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
    return {'file': str(path), 'sha256': sha(raw)}


def verify_source(manifest):
    """Bind actual extracted critical source bytes to the released ZIP, not HEAD.

The separately installed github.com/Smartesting/pinata checkout is NOT the
Zenodo artifact. Its Git commit must not substitute for the artifact checksum.
"""
    source = Path(manifest['artifact_root'])
    if not source.is_absolute() or source.is_symlink():
        raise ValueError('Absolute nonsymlink extracted artifact root required')
    archive_ref = manifest['source_archive_ref']
    if archive_ref.get('sha256') != ARCHIVE_SHA256:
        raise ValueError('Unreviewed ATA published artifact')
    pinned(archive_ref)
    catalog = source_catalog(source / 'benchmark')
    if catalog['source_catalog_sha256'] != CATALOG_SHA256:
        raise ValueError('Published ATA CSV population drift')
    if len(catalog['cases']) != 113 or sum(c['expected'] == 'PASS' for c in catalog['cases']) != 62:
        raise ValueError('Published ATA 113 / 62 PASS / 51 FAIL population required')
    files = ['pinata/evaluation.py', 'pinata/src/VTAAS/data/testcase.py',
             'pinata/src/VTAAS/schemas/verdict.py', 'README.md']
    files += ['benchmark/' + row['file'] for row in catalog['files']]
    hashes = {}
    with zipfile.ZipFile(archive_ref['file']) as archive:
        for relative in files:
            name = 'ISSTA_ARTEFACT/' + relative
            if archive.namelist().count(name) != 1:
                raise ValueError('Missing or duplicate source archive member')
            path = source / relative
            if path.is_symlink() or path.read_bytes() != archive.read(name):
                raise ValueError('Extracted source differs from published artifact')
            hashes[relative] = sha(path.read_bytes())
    return catalog, hashes


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate prediction key')
        result[key] = value
    return result


def parse_prediction(raw):
    """No regex extraction, Markdown repair, case folding, or gold-guided retry."""
    if raw is None:
        return {'prediction_status': 'missing', 'verdict': None, 'failure_step': None}
    if not isinstance(raw, str):
        raise ValueError('Unaltered final answer must be text or null')
    try:
        value = json.loads(raw, object_pairs_hook=no_duplicate_keys,
                           parse_constant=lambda _: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))
        if not isinstance(value, dict) or set(value) != {'verdict', 'failure_step'}:
            raise ValueError('Exact public prediction schema required')
        verdict, step = value['verdict'], value['failure_step']
        if verdict not in ('PASS', 'FAIL', None):
            raise ValueError('Binary verdict or explicit null required')
        if step is not None and (type(step) is not int or step <= 0):
            raise ValueError('Positive source step label or null required')
        if verdict != 'FAIL' and step is not None:
            raise ValueError('Only FAIL may specify a failure step')
        return {'prediction_status': 'binary' if verdict is not None else 'abstained',
                'verdict': verdict, 'failure_step': step}
    except (ValueError, TypeError):
        return {'prediction_status': 'malformed', 'verdict': None, 'failure_step': None}


def score_reference(case, prediction):
    """Prediction, binary correctness, and failure localization stay separate."""
    expected = {'P': 'PASS', 'F': 'FAIL'}[case['label']]
    verdict, step = prediction['verdict'], prediction['failure_step']
    result = {**prediction, 'verdict_correctness': None, 'confusion_class': None,
              'step_class': None, 'step_assessment_status': 'not-applicable',
              'strict_step_correctness': None}
    if verdict is None:
        result['step_assessment_status'] = 'no-binary-verdict'
        return result
    result['verdict_correctness'] = int(verdict == expected)
    result['confusion_class'] = ('TP' if verdict == 'FAIL' else 'FN') if expected == 'FAIL' else ('TN' if verdict == 'PASS' else 'FP')
    if result['confusion_class'] != 'TP':
        result['strict_step_correctness'] = int(result['confusion_class'] == 'TN')
        return result
    labels = [s['step'] for s in case['steps']]
    failures = case['failures']
    # Native Pinata enumerates executed steps by position, whereas the CSV
    # failure annotation uses display labels. Non-contiguous/repeated labels
    # make those different coordinate systems: never silently renumber them.
    if labels != list(range(1, len(labels) + 1)):
        reason = 'ambiguous-source-step-labels'
    elif len(failures) != 1 or failures[0]['step'] not in labels:
        reason = 'ambiguous-source-failure-annotation'
    elif step not in labels:
        reason = 'missing-or-out-of-range-predicted-step'
    else:
        gold_step = failures[0]['step']
        result['step_class'] = 'AFB' if step < gold_step else 'AFA' if step > gold_step else 'AFC'
        result['step_assessment_status'] = 'resolved'
        result['strict_step_correctness'] = int(result['step_class'] == 'AFC')
        return result
    result['step_class'] = 'Ustep'
    result['step_assessment_status'] = reason
    return result


def evaluate(payload, manifest_ref):
    manifest = json.loads(pinned(manifest_ref))
    fields = {'schema', 'scope', 'artifact_root', 'source_archive_ref', 'private_artifact_root'}
    if (not isinstance(manifest, dict) or set(manifest) != fields or manifest['schema'] != SCHEMA
            or manifest['scope'] not in ('synthetic', 'diagnostic')):
        raise ValueError('Pinned diagnostic ATA evaluator manifest required')
    identity = {key: payload.get(key) for key in IDENTITY}
    if not all(isinstance(v, str) and v.strip() for v in identity.values()) or not re.fullmatch('[0-9a-f]{64}', identity['configuration_sha256']):
        raise ValueError('Execution identity and configuration digest required')
    scope = manifest['scope']
    data_kind = 'MEASURED' if scope == 'diagnostic' else 'SYNTHETIC_TEST'
    actor = payload.get('actor_result')
    if (payload.get('scope') != scope or payload.get('data_kind') != data_kind or not isinstance(actor, dict)
            or any(actor.get(key) != value for key, value in identity.items())
            or actor.get('scope') != scope or actor.get('data_kind') != data_kind):
        raise ValueError('Actor, worker and evaluator identities/provenance differ')
    if 'final_answer' not in actor:
        raise ValueError('Explicit unaltered final answer or null required')
    lifecycle_ref = payload.get('actor_lifecycle_ref')
    lifecycle = verify_lifecycle(lifecycle_ref, actor)
    if lifecycle['scope'] != scope:
        raise ValueError('Lifecycle provenance differs')
    catalog, source_hashes = verify_source(manifest)
    gold_ref = payload.get('evaluation_ref')
    gold = json.loads(pinned(gold_ref))
    source = Path(manifest['artifact_root']) / 'benchmark'
    official = next((row for row in catalog['cases'] if row['source_task_id'] == gold.get('official_task_id')), None)
    if official is None:
        raise ValueError('Unknown official ATA task')
    case = next(case for case in parser.parse_file(source / official['source_file']) if case['task_id'] == official['source_task_id'])
    expected_gold = {'benchmark': 'ata', 'official_task_id': case['task_id'], 'application': case['site'],
        'source_sha256': official['source_sha256'], 'expected': official['expected'],
        'failures': case['failures'], 'source_line': case['source_line'],
        'evaluator_status': 'reference-labels-only-live-parity-not-verified'}
    if gold != expected_gold:
        raise ValueError('Evaluation reference differs from checksum-pinned official case')
    prediction = parse_prediction(actor['final_answer'])
    assessed = score_reference(case, prediction)
    root = Path(manifest['private_artifact_root'])
    if not root.is_absolute() or root.is_symlink():
        raise ValueError('Absolute private artifact root required')
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if stat.S_IMODE(root.stat().st_mode) & 0o077:
        raise ValueError('Private evaluator artifacts cannot be publicly readable')
    directory = root / ('eval-' + uuid.uuid4().hex)
    directory.mkdir(mode=0o700)
    private_result = {**identity, **assessed, 'schema': SCHEMA, 'scope': scope, 'data_kind': data_kind,
        'official_task_id': case['task_id'], 'reference_verdict': official['expected'],
        'source_step_labels': [step['step'] for step in case['steps']], 'source_failures': case['failures'],
        'source_hashes': source_hashes, 'source_archive_sha256': ARCHIVE_SHA256,
        'source_catalog_sha256': CATALOG_SHA256, 'evaluation_ref': gold_ref,
        'actor_lifecycle_ref': lifecycle_ref, 'evaluator_manifest_ref': manifest_ref,
        'reference_authority': 'published-ATA-CSV-not-agent-verdict',
        'live_fixture_label_parity_verified': False, 'confirmatory_authorized': False}
    native_ref = persist(directory / 'reference-result.json', private_result)
    answer_ref = persist(directory / 'actor-answer.json', {**identity, 'final_answer': actor['final_answer']})
    return {**identity, **assessed, 'schema': SCHEMA, 'scope': scope, 'data_kind': data_kind,
        'benchmark':'ata','source_sha256':official['source_sha256'],
        'assessment_status': 'valid', 'native_score': None, 'evaluator_completed': True,
        'official_task_id': case['task_id'], 'source_archive_sha256': ARCHIVE_SHA256,
        'source_catalog_sha256': CATALOG_SHA256, 'source_hashes': source_hashes,
        'native_result_ref': native_ref, 'actor_answer_ref': answer_ref,
        'actor_lifecycle_ref': lifecycle_ref, 'evaluation_ref': gold_ref,
        'evaluator_manifest_ref': manifest_ref, 'live_fixture_label_parity_verified': False,
        'operational_correctness': None, 'confirmatory_authorized': False}


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument('--manifest', required=True)
    cli.add_argument('--manifest-sha256', required=True)
    args = cli.parse_args()
    try:
        receipt = evaluate(json.load(sys.stdin), {'file': args.manifest, 'sha256': args.manifest_sha256})
        print(json.dumps(receipt, ensure_ascii=False, allow_nan=False))
    except Exception as exc:
        # Native/source/gold-bearing exception strings must not reach public logs.
        print(json.dumps({'adapter_error': type(exc).__name__}), file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == '__main__':
    main()
