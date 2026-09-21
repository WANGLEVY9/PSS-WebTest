"""Evaluator-only ATA source mapping. Never feed this catalog to an actor."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare_ata', Path(__file__).with_name('prepare-ata.py'))
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)


def source_catalog(root):
    files, cases = [], []
    for source in sorted(Path(root).glob('*.csv')):
        sha = hashlib.sha256(source.read_bytes()).hexdigest()
        files.append({'file': source.name, 'sha256': sha})
        for c in parser.parse_file(source):
            cases.append({'source_task_id': c['task_id'], 'source_file': c['source_file'],
                          'source_line': c['source_line'], 'source_sha256': sha,
                          'expected': {'P': 'PASS', 'F': 'FAIL'}[c['label']],
                          'application': c['site'], 'step_ids': [s['step'] for s in c['steps']],
                          'input_sha256': hashlib.sha256(json.dumps(parser.agent_payload(c), sort_keys=True).encode()).hexdigest()})
    if not files or len({c['source_task_id'] for c in cases}) != len(cases):
        raise ValueError('Missing source or duplicate official task identity')
    return {'files': files, 'cases': cases, 'source_catalog_sha256': hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()}


def audit_mapping(catalog, selected, expected_counts=None):
    by_id = {c['source_task_id']: c for c in catalog['cases']}
    errors, seen_source, seen_study = [], set(), set()
    for row in selected:
        sid, tid = row.get('source_task_id'), row.get('task_key')
        if not tid or tid in seen_study or sid in seen_source:
            errors.append('Missing/duplicate study or source task identity')
        seen_study.add(tid)
        seen_source.add(sid)
        official = by_id.get(sid)
        if not official:
            errors.append(f'{tid}: unknown official source task')
            continue
        for field in ('expected', 'source_sha256', 'application', 'input_sha256'):
            if row.get(field) != official[field]:
                errors.append(f'{tid}: {field} differs from original source; cannot claim native subset')
    counts = dict(Counter(r.get('expected') for r in selected))
    if expected_counts is not None and counts != expected_counts:
        errors.append('Selected class counts differ from current study manifest')
    published = dict(Counter(r['expected'] for r in catalog['cases']))
    if expected_counts and any(n > published.get(label, 0) for label, n in expected_counts.items()):
        errors.append('Requested class count exceeds official release; a native subset is impossible')
    return {'kind': 'ATA_SOURCE_MAPPING_AUDIT', 'source_catalog_sha256': catalog['source_catalog_sha256'],
            'published': published, 'selected': counts, 'mapping_verified': not errors and bool(selected),
            'native_subset': not errors and bool(selected), 'errors': errors,
            'confirmatory_authorized': False, 'executions': 0}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True)
    selection = p.add_mutually_exclusive_group()
    selection.add_argument('--mapping')
    selection.add_argument('--all-official', action='store_true', help='Map the entire published release; does not authorize execution')
    p.add_argument('--output', required=True)
    args = p.parse_args()
    catalog = source_catalog(args.source)
    population = json.loads((Path(__file__).resolve().parents[1] / 'config/ata-source-population.v1.json').read_text())
    if catalog['source_catalog_sha256'] != population['source_catalog_sha256']:
        raise ValueError('Official source differs from pinned population; require a versioned amendment')
    selected = [{**c, 'task_key': 'ata:' + c['source_task_id'], 'official_task_id': c['source_task_id'], 'benchmark': 'ata'} for c in catalog['cases']] if args.all_official else json.loads(Path(args.mapping).read_text()) if args.mapping else []
    report = audit_mapping(catalog, selected, {'PASS': population['expected_pass'], 'FAIL': population['expected_fail']})
    report['selection_status'] = 'official-source-mapped-not-live-admitted' if report['mapping_verified'] else 'mapping-pending'
    report['population_policy'] = population['selection_policy']
    with Path(args.output).open('x') as f:
        json.dump({'catalog': catalog, 'selected_mapping': selected, 'audit': report}, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
