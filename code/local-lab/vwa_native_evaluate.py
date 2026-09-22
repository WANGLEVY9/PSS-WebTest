"""Trusted live-page adapter to the pinned VisualWebArena evaluator router.

Call evaluate_live AFTER immutable actor-end, BEFORE browser context closure.
The exact final active Page must be provided by the supervisor-owned actuator;
the initial page or last-opened tab is NOT an equivalent substitute. No actor
may resume after evaluation (native HTML/image evaluators can navigate pages).

This adapter uses the official source, not BrowserGym wrapper reward. It rejects
unfrozen LLM/VQA judges before evaluation; these tasks remain pending and are
not excluded or scored zero. Official deterministic text, URL, DOM and image
SSIM routes are available. Synthetic controls never authorize a real fixture.
"""
from contextlib import redirect_stdout, redirect_stderr
import copy
import importlib
import json
import math
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
from urllib.parse import urlparse
import uuid

from benchmark_actor_lifecycle import checked_actor
from prepare_navigation_runtime import PINS
from wav_native_evaluate import (pinned, private_write, json_bytes, sha,
                                 validate_identity, private_logging)

SCHEMA = 'pss-vwa-native-evaluator-v1'
ROUTES = ('__CLASSIFIEDS__', '__SHOPPING__', '__REDDIT__', '__WIKIPEDIA__', '__HOMEPAGE__')
SOURCE_PACKAGES = ('browser_env', 'evaluation_harness', 'llms')


class UnfrozenJudgeError(ValueError):
    """Task is retained as evaluation-blocked, never an agent capability failure."""


def validate_routes(routes):
    if not isinstance(routes, dict) or set(routes) != set(ROUTES):
        raise ValueError('All five explicitly frozen VWA endpoint routes required')
    for endpoint in routes.values():
        if not isinstance(endpoint, str):
            raise ValueError('Endpoint must be a URL')
        p = urlparse(endpoint)
        if (p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password
                or p.query or p.fragment or p.path not in ('', '/') or endpoint.endswith('/')):
            raise ValueError('VWA routes must be origin-only URLs without trailing slash')
    return dict(routes)


def verify_source(source):
    source = Path(source).resolve()
    head = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    dirty = subprocess.check_output(['git', '-C', str(source), 'status', '--porcelain', '--untracked-files=no'], text=True).strip()
    if head != PINS['vwa'] or dirty:
        raise ValueError('Clean pinned VWA source required')
    manifest = {}
    for package in SOURCE_PACKAGES:
        for path in sorted((source / package).rglob('*.py')):
            if path.is_symlink():
                raise ValueError('Native source symlink forbidden')
            manifest[str(path.relative_to(source))] = sha(path.read_bytes())
    if not manifest:
        raise ValueError('VWA evaluator source missing')
    return sha(json_bytes(manifest))


def load_native(source, routes):
    """Fresh dedicated process required; environment values cannot change mid-run.

    Upstream imports an OpenAI client even for deterministic evaluators. A dummy
    key is used only if none exists; all model-judged configurations are rejected
    independently before router invocation. No LLM method is replaced.
    """
    source = Path(source).resolve()
    tree_sha = verify_source(source)
    validate_routes(routes)
    desired = {'DATASET': 'visualwebarena', **{key.strip('_'): value for key, value in routes.items()}}
    if any(name in sys.modules for name in SOURCE_PACKAGES):
        for key, value in desired.items():
            if os.environ.get(key) != value:
                raise ValueError('Native evaluator already imported with different endpoint routes')
    for key, value in desired.items():
        os.environ[key] = value
    # This token is only an import prerequisite, never a usable reset credential.
    os.environ.setdefault('CLASSIFIEDS_RESET_TOKEN', 'NOT-A-RESET-CREDENTIAL')
    os.environ.setdefault('OPENAI_API_KEY', 'not-used-by-deterministic-vwa-evaluation')
    sys.path.insert(0, str(source))
    evaluators = importlib.import_module('evaluation_harness.evaluators')
    actions = importlib.import_module('browser_env.actions')
    # Refuse accidental BrowserGym/installed-port imports and mixed source trees.
    for name, module in list(sys.modules.items()):
        if name.split('.')[0] in SOURCE_PACKAGES and getattr(module, '__file__', None):
            path = Path(module.__file__).resolve()
            if source not in path.parents:
                raise ValueError('Native evaluator imported a different upstream implementation')
    return evaluators.evaluator_router, actions.create_stop_action, tree_sha


def evaluator_requirements(config):
    """Classify original upstream requirements before invoking any judge/network."""
    spec = config.get('eval')
    if not isinstance(spec, dict) or not isinstance(spec.get('eval_types'), list) or not spec['eval_types']:
        raise ValueError('Nonempty official evaluator list required')
    allowed = {'string_match', 'url_match', 'program_html', 'page_image_query'}
    if set(spec['eval_types']) - allowed or len(set(spec['eval_types'])) != len(spec['eval_types']):
        raise ValueError('Unsupported or repeated official evaluator type')
    judges = []
    if 'string_match' in spec['eval_types']:
        answers = spec.get('reference_answers')
        if not isinstance(answers, dict) or not answers:
            raise ValueError('Explicit native string comparison rules required')
        known = {'exact_match', 'required_values', 'must_include', 'must_exclude', 'one_of', 'fuzzy_match'}
        if set(answers) - known:
            raise ValueError('Unknown string rule would be silently ignored upstream')
        if 'fuzzy_match' in answers:
            judges.append('upstream-llm-fuzzy-or-unachievable-match')
    if 'url_match' in spec['eval_types'] and not isinstance(spec.get('reference_url'), str):
        raise ValueError('Native URL reference required')
    if 'program_html' in spec['eval_types']:
        targets = spec.get('program_html')
        if not isinstance(targets, list) or not targets:
            raise ValueError('Native HTML targets required')
        for target in targets:
            contents = target.get('required_contents', {})
            if not contents:
                raise ValueError('Native HTML comparison rules required')
            if 'fuzzy_match' in contents:
                judges.append('upstream-llm-html-fuzzy-match')
    if 'page_image_query' in spec['eval_types']:
        queries = spec.get('page_image_query')
        if not isinstance(queries, list) or not queries:
            raise ValueError('Native image queries required')
        for query in queries:
            if query.get('eval_vqa'):
                judges.append('upstream-captioning-vqa')
            if not query.get('eval_vqa') and 'eval_fuzzy_image_match' not in query:
                raise ValueError('Image query lacks a native decision rule')
    return {'eval_types': list(spec['eval_types']), 'unfrozen_judges': sorted(set(judges)),
            'uses_live_page': bool(set(spec['eval_types']) - {'string_match'})}


def materialize_config(official, routes, source):
    """Same five text substitutions as pinned scripts/generate_test_data.py.

    Only evaluator-local relative image references are additionally resolved to
    the pinned checkout, equivalent to upstream's repo-root working directory.
    The caller remains free to run concurrent isolated processes; no chdir().
    """
    validate_routes(routes)
    text = json.dumps(official, ensure_ascii=False)
    for key, value in routes.items():
        text = text.replace(key, value)
    config = json.loads(text)
    if re.search(r'__[A-Z_]+__', json.dumps(config)):
        # __last_url__ and __page__ are lowercase official helper placeholders.
        raise ValueError('Unresolved official endpoint placeholder')
    source = Path(source).resolve()
    assets = []
    for query in config.get('eval', {}).get('page_image_query', []):
        if 'eval_fuzzy_image_match' not in query:
            continue
        resolved = []
        for value in query['eval_fuzzy_image_match'].split(' |OR| '):
            if value.startswith(('http://', 'https://')):
                resolved.append(value)
                continue
            path = (source / value).resolve()
            if source not in path.parents or not path.is_file() or path.is_symlink():
                raise ValueError('Native reference image outside pinned checkout')
            assets.append({'file': str(path), 'sha256': sha(path.read_bytes())})
            resolved.append(str(path))
        query['eval_fuzzy_image_match'] = ' |OR| '.join(resolved)
    return config, assets


def load_official(payload, manifest):
    source = Path(manifest['source_dir']).resolve()
    gold = json.loads(pinned(payload['evaluation_ref']))
    match = re.fullmatch(r'(classifieds|shopping|reddit):(0|[1-9][0-9]*)', str(gold.get('official_task_id', '')))
    if not match:
        raise ValueError('Site-scoped official VWA identity required')
    site, number = match.groups()
    file = source / f'config_files/vwa/test_{site}.raw.json'
    dataset_raw = file.read_bytes()
    if manifest['source_dataset_sha256'].get(site) != sha(dataset_raw):
        raise ValueError('Frozen VWA dataset bytes changed')
    rows = json.loads(dataset_raw)
    matches = [row for row in rows if type(row.get('task_id')) is int and row['task_id'] == int(number)]
    if len(matches) != 1:
        raise ValueError('Missing or duplicate VWA source task')
    row = matches[0]
    if (gold.get('benchmark') != 'vwa' or gold.get('source_commit') != PINS['vwa']
            or gold.get('source_sha256') != sha(dataset_raw)
            or gold.get('application') != '+'.join(row['sites']) or gold.get('official_config') != row):
        raise ValueError('Evaluation binding differs from pinned official task')
    return gold, row


def evaluate_live(payload, manifest_ref, page):
    """Supervisor-only callback; it never returns or appends feedback to actor."""
    identity, actor = validate_identity(payload)
    manifest = json.loads(pinned(manifest_ref))
    required = {'schema', 'scope', 'source_dir', 'source_commit', 'source_dataset_sha256',
                'routes', 'private_artifact_root', 'judge_policy'}
    if not isinstance(manifest, dict) or set(manifest) != required or manifest.get('schema') != SCHEMA:
        raise ValueError('Exact pinned VWA evaluator manifest required')
    if manifest['scope'] != payload['scope'] or manifest['source_commit'] != PINS['vwa']:
        raise ValueError('Evaluator manifest scope or source mismatch')
    if manifest['judge_policy'] != 'deterministic-only-fail-closed':
        raise ValueError('LLM and VQA judge admission not implemented; do not substitute actor model')
    if set(manifest['source_dataset_sha256']) != {'classifieds', 'shopping', 'reddit'}:
        raise ValueError('All three VWA source namespace hashes required')
    gold, original = load_official(payload, manifest)
    requirements = evaluator_requirements(original)
    if requirements['unfrozen_judges']:
        raise UnfrozenJudgeError('Official evaluator requires a separately frozen and audited judge')
    directory = Path(actor['trajectory_directory']).resolve()
    before = checked_actor(directory, actor)
    if page.is_closed() or page not in page.context.pages:
        raise ValueError('Same live final active Page required before context closure')
    output = Path(manifest['private_artifact_root'])
    if not output.is_absolute() or output.is_symlink():
        raise ValueError('Absolute private artifact root required')
    output.mkdir(mode=0o700, parents=True, exist_ok=True)
    if stat.S_IMODE(output.stat().st_mode) & 0o077:
        raise ValueError('Evaluator artifacts must deny group/other access')
    run = output / ('eval-' + uuid.uuid4().hex)
    run.mkdir(mode=0o700)
    config, images = materialize_config(original, manifest['routes'], manifest['source_dir'])
    config_ref = private_write(run / 'native-config.json', json_bytes(config))
    # Private only: the evaluator is permitted to inspect page state, actors are not.
    final_state_ref = private_write(run / 'pre-evaluation-page.json', json_bytes({
        'url': page.url, 'open_page_count': len(page.context.pages),
        'active_page_index': page.context.pages.index(page)}))
    answer_ref = private_write(run / 'actor-answer.json', json_bytes({'final_answer': actor['final_answer']}))
    started = time.monotonic()
    raw_score = None
    error_type = None
    log = run / 'native-private.log'
    with os.fdopen(os.open(log, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
        with redirect_stdout(stream), redirect_stderr(stream), private_logging(stream):
            router, stop_action, source_tree_sha = load_native(manifest['source_dir'], manifest['routes'])
            # Pinned evaluators consume only trajectory[-1]['answer']; no inspected
            # page fields or fabricated prior actions/states are sent as trajectory.
            # Upstream run.py appends STOP("") at environment truncation. For no
            # final answer use exactly that terminal convention, not guessed text.
            stop = stop_action(actor['final_answer'] if actor['final_answer'] is not None else '')
            try:
                raw_score = router(config_ref['file'])(trajectory=[stop], config_file=config_ref['file'], page=page)
            except Exception as exc:
                error_type = type(exc).__name__
                import traceback
                traceback.print_exc(file=stream)
    elapsed = (time.monotonic() - started) * 1000
    if checked_actor(directory, actor) != before:
        raise ValueError('Actor journal changed during evaluator phase')
    valid = isinstance(raw_score, (int, float)) and not isinstance(raw_score, bool) and math.isfinite(raw_score) and raw_score in (0, 1)
    status = 'valid' if valid and error_type is None else 'unresolved'
    score = int(raw_score) if status == 'valid' else None
    native = {'raw_score': raw_score if isinstance(raw_score, (int, float)) and math.isfinite(raw_score) else None,
              'exception_type': error_type, 'native_evaluator_types': requirements['eval_types'],
              'evaluator_elapsed_ms': elapsed, 'stop_answer_convention': 'verbatim' if actor['final_answer'] is not None else 'upstream-empty-stop-on-truncation'}
    result_ref = private_write(run / 'native-result.json', json_bytes(native))
    receipt = {**identity, 'schema': SCHEMA, 'benchmark': 'vwa', 'official_task_id': gold['official_task_id'],
        'scope': payload['scope'], 'data_kind': payload['data_kind'], 'assessment_status': status,
        'native_score': score, 'verdict': None,
        'official_status': 'error' if score is None else ('success' if score else 'failure'),
        'evaluation_ref': payload['evaluation_ref'], 'source_commit': PINS['vwa'],
        'source_sha256': gold['source_sha256'], 'installed_source_tree_sha256': source_tree_sha,
        'manifest_sha256': manifest_ref['sha256'], 'native_config_ref': config_ref,
        'pre_evaluation_page_ref': final_state_ref, 'native_result_ref': result_ref,
        'native_log_ref': {'file': str(log), 'sha256': sha(log.read_bytes())},
        'actor_answer_ref': answer_ref, 'reference_image_refs': images,
        'trajectory_ref': {'file': str(directory / 'trajectory.jsonl'), 'sha256': sha(before)},
        'evaluated_after_actor_end_before_context_close': True, 'actor_journal_unchanged': True,
        'evaluator_elapsed_ms': elapsed, 'confirmatory_authorized': False,
        'reset_isolation_verified_by_adapter': False}
    private_write(run / 'receipt.json', json_bytes(receipt))
    return receipt


def consume_sealed(payload, manifest_ref):
    """Consume only the recorded pre-close score; never re-evaluate a new page."""
    from benchmark_actor_lifecycle import verify_lifecycle
    identity,actor=validate_identity(payload)
    manifest=json.loads(pinned(manifest_ref))
    if manifest.get('scope')!=payload['scope'] or manifest.get('schema')!=SCHEMA:
        raise ValueError('Evaluator manifest provenance mismatch')
    gold,_=load_official(payload,manifest)
    seal=verify_lifecycle(payload['actor_lifecycle_ref'],actor)
    receipt=json.loads(pinned(seal['preclose_evaluation_ref']))
    if (receipt.get('schema')!=SCHEMA or any(receipt.get(k)!=v for k,v in identity.items())
        or receipt.get('scope')!=payload['scope'] or receipt.get('data_kind')!=payload['data_kind']
        or receipt.get('evaluation_ref')!=payload['evaluation_ref']
        or receipt.get('official_task_id')!=gold['official_task_id']
        or receipt.get('source_sha256')!=gold['source_sha256']
        or receipt.get('source_commit')!=PINS['vwa']
        or receipt.get('manifest_sha256')!=manifest_ref['sha256']
        or receipt.get('trajectory_ref')!=seal['trajectory_ref']
        or receipt.get('evaluated_after_actor_end_before_context_close') is not True
        or receipt.get('actor_journal_unchanged') is not True):
        raise ValueError('Pre-close native evaluation not bound to this exact actor/task/source')
    if receipt['installed_source_tree_sha256']!=verify_source(manifest['source_dir']):
        raise ValueError('Evaluator source changed after execution')
    for key in ('native_config_ref','native_result_ref','native_log_ref','actor_answer_ref','pre_evaluation_page_ref'):
        pinned(receipt[key])
    for ref in receipt['reference_image_refs']:pinned(ref)
    from runtime_worker import verify_native_endpoint
    verify_native_endpoint('vwa',receipt)
    return {**receipt,'actor_lifecycle_ref':payload['actor_lifecycle_ref'],
            'preclose_evaluation_ref':seal['preclose_evaluation_ref']}


if __name__=='__main__':
    import argparse
    cli=argparse.ArgumentParser()
    cli.add_argument('--manifest',required=True)
    cli.add_argument('--manifest-sha256',required=True)
    args=cli.parse_args()
    try:
        print(json.dumps(consume_sealed(json.load(sys.stdin),{'file':args.manifest,'sha256':args.manifest_sha256}),allow_nan=False))
    except Exception as exc:
        print(json.dumps({'adapter_error':type(exc).__name__}),file=sys.stderr)
        raise SystemExit(2) from None
