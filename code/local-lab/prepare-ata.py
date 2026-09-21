# -*- coding: utf-8 -*-
"""Extract published ATA specs and keep outcome annotations evaluator-only.

This is artifact preparation, NOT task execution or human screening.
"""
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'artifacts/benchmark-snapshots/ata-zenodo/ISSTA_ARTEFACT/benchmark'
OUT = ROOT / 'artifacts/local-runtime/ata-preparation'


def parse_file(source):
    cases = []
    current = None
    with source.open(encoding='utf-8-sig', newline='') as stream:
        for line, row in enumerate(csv.reader(stream), 1):
            if not row or len(row) < 2:
                continue
            match = re.fullmatch(r'TC-(\d+)-([PF]) :: (.+)', row[1].strip())
            if match:
                key = hashlib.sha256((source.name + ':' + match[0]).encode()).hexdigest()[:20]
                current = {'task_id': 'ata-' + key, 'site': source.name.split('_')[0],
                           'title': match[3], 'steps': [], 'label': match[2],
                           'source_file': source.name, 'source_line': line, 'failures': []}
                cases.append(current)
            elif current and row[0].strip().isdigit():
                action = row[1].strip()
                assertion = row[2].strip() if len(row) > 2 else ''
                if action == 'Actions':
                    continue
                current['steps'].append({'step': int(row[0]), 'action': action, 'expectedResult': assertion})
                annotation = row[3].strip() if len(row) > 3 else ''
                if annotation and annotation != 'Expected Failure':
                    current['failures'].append({'step': int(row[0]), 'annotation': annotation})
    return cases


def agent_payload(case):
    """Strict nested allowlist: specifications only, never published outcomes."""
    return {**{k: case[k] for k in ['task_id', 'site', 'title']},
            'steps': [{k: step[k] for k in ['step', 'action', 'expectedResult']}
                      for step in case['steps']]}


def main():
    (OUT / 'agent-inputs').mkdir(parents=True, exist_ok=True)
    gold, warnings, counts, files = {}, [], Counter(), []
    for source in sorted(SOURCE.glob('*.csv')):
        cases = parse_file(source)
        files.append({'file': source.name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'cases': len(cases)})
        for case in cases:
            key = case['task_id']
            if key in gold:
                raise ValueError('duplicate task ID')
            # No original TC-*-P/F name, source filename or failure annotation enters the input.
            payload = agent_payload(case)
            (OUT / 'agent-inputs' / (key + '.json')).write_text(json.dumps(payload, ensure_ascii=False, indent=2))
            gold[key] = {k: case[k] for k in ['label', 'source_file', 'source_line', 'failures']}
            gold[key]['input_sha256'] = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
            counts[f"{case['site']}:{case['label']}"] += 1
            if not case['steps'] or (case['label'] == 'F' and len(case['failures']) != 1):
                warnings.append({'task_id': key, 'issue': 'empty steps or non-single failure annotation', 'failure_annotations': len(case['failures'])})
            if [s['step'] for s in case['steps']] != list(range(1, len(case['steps']) + 1)):
                warnings.append({'task_id': key, 'issue': 'non-contiguous official step indices'})
    if len(gold) != 112:
        warnings.append({'issue': 'frozen-v1 marker inventory differs from parsed task headers',
                         'frozen_v1_count': 112, 'parsed_count': len(gold),
                         'source': 'postmill_failing.csv:1 uses í instead of ►; original task header remains valid',
                         'action': 'quarantine population revision pending adjudication; do not overwrite frozen manifests'})
    (OUT / 'evaluator-only.json').write_text(json.dumps(gold, indent=2))
    report = {'kind': 'ATA_ARTIFACT_PREPARATION', 'executions': 0, 'confirmatory_eligible': False,
              'published_tasks': len(gold), 'counts': dict(counts), 'files': files, 'warnings': warnings,
              'gold_authority': 'Published P/F identifiers and Expected Failure column, not an agent verdict',
              'not_verified': ['live environment reproduces labels', 'reset equivalence', 'human eligibility review', 'live adapter'],
              'public_input_fields': ['task_id', 'site', 'title', 'steps'],
              'leakage_audit': 'Stock TestCase.__str__ includes P/F in full_name; PSS inputs instead use opaque IDs. Assertions remain legitimate task specifications.'}
    (OUT / 'summary.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
