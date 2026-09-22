"""Create pinned actor/evaluator separation for the complete published ATA release.

Source preparation only. Does not run/screen any task, supply an actor with a
reference verdict, or authorize formal acquisition. WAV/VWA importers must retain
their native official task IDs, images and evaluator contracts separately.
"""
import argparse
import hashlib
import json
from runtime_store import digest
import os
from pathlib import Path
from ata_mapping import source_catalog, parser as ata_parser


def save(path, value):
    raw = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(raw)
    return hashlib.sha256(raw).hexdigest()


def prepare_ata(source, destination):
    source = Path(source).resolve()
    dest = Path(destination).resolve()
    catalog = source_catalog(source)
    population = json.loads((Path(__file__).resolve().parents[1] / 'config/ata-source-population.v1.json').read_text())
    if catalog['source_catalog_sha256'] != population['source_catalog_sha256']:
        raise ValueError('ATA source differs from reviewed published release')
    cases = [case for filename in sorted(source.glob('*.csv')) for case in ata_parser.parse_file(filename)]
    if len(cases) != 113 or sum(c['label'] == 'P' for c in cases) != 62 or sum(c['label'] == 'F' for c in cases) != 51:
        raise ValueError('Official ATA population drift')
    dest.mkdir(mode=0o700)  # refuse overwrite
    for folder in ('actor', 'evaluator'):
        (dest / folder).mkdir(mode=0o700)
    rows, bindings = [], {}
    for case in cases:
        source_file = source / case['source_file']
        actor_file = dest / 'actor' / (case['task_id'] + '.json')
        gold_file = dest / 'evaluator' / (case['task_id'] + '.json')
        payload = {'schema': 'pss-official-task-input-v1', 'benchmark': 'ata',
                   'intent': case['title'], 'steps': ata_parser.agent_payload(case)['steps'], 'task_images': []}
        input_hash = save(actor_file, payload)
        identity = {'benchmark': 'ata', 'official_task_id': case['task_id'], 'application': case['site'],
                    'source_sha256': hashlib.sha256(source_file.read_bytes()).hexdigest()}
        task_key = 'ata:' + case['task_id']
        expected = {'P': 'PASS', 'F': 'FAIL'}[case['label']]
        # P/F and source path remain on the supervisor/evaluator side only.
        gold_hash = save(gold_file, {**identity, 'expected': expected, 'failures': case['failures'],
                                    'source_line': case['source_line'], 'evaluator_status': 'reference-labels-only-live-parity-not-verified'})
        rows.append({**identity, 'task_key': task_key, 'expected': expected, 'agent_input_sha256': input_hash,
                     'evaluation_sha256': gold_hash, 'evaluation_ref_sha256': digest({'file': str(gold_file), 'sha256': gold_hash})})
        bindings[task_key] = {**identity, 'source_file': str(source_file), 'agent_input_file': str(actor_file),
                              'agent_input_sha256': input_hash, 'evaluation_ref': {'file': str(gold_file), 'sha256': gold_hash}}
    save(dest / 'source-bundle.json', {'protocol_id': 'pss-manuscript-v2.1', 'scope': 'diagnostic', 'tasks': rows})
    save(dest / 'task-bindings.json', {'tasks': bindings, 'executors': {}, 'schedule_freeze_sha256': None})
    report = {'kind': 'ATA_OFFICIAL_INPUT_BINDING_PREPARATION', 'protocol_id': 'pss-manuscript-v2.1',
              'source_catalog_sha256': catalog['source_catalog_sha256'], 'tasks': len(rows), 'expected_pass': 62,
              'expected_fail': 51, 'actor_envelopes': len(bindings), 'evaluator_refs': len(bindings),
              'scope': 'source-preparation-not-screening-or-execution', 'model_requests': 0,
              'benchmark_executions': 0, 'confirmatory_authorized': False}
    save(dest / 'report.json', report)
    return report


if __name__ == '__main__':
    cli = argparse.ArgumentParser()
    cli.add_argument('--source', required=True)
    cli.add_argument('--output', required=True)
    args = cli.parse_args()
    print(json.dumps(prepare_ata(args.source, args.output)))
