"""Bind an exported study plan to real pinned adapters and separate agent inputs.

This creates executable DIAGNOSTIC opportunities only. It neither infers global
missing records nor authorizes confirmatory collection.
"""
import argparse
import json
from pathlib import Path
from runtime_store import digest
from runtime_worker import validate_commands
from runtime_inputs import read_pinned, task_projection
import hashlib


def frozen_plan(filename, freeze_file, freeze_sha256):
    freeze = json.loads(read_pinned(freeze_file, freeze_sha256))
    if freeze.get('schema') != 'pss-schedule-freeze-v1' or freeze.get('protocol_id') != 'pss-manuscript-v2.1':
        raise ValueError('Active schedule freeze required')
    rows = [json.loads(line) for line in read_pinned(filename, freeze['opportunities_file_sha256']).splitlines() if line.strip()]
    if len(rows) != freeze['scheduled']:
        raise ValueError('Frozen opportunity count mismatch')
    tasks = {t['task_key']: t for t in freeze['tasks']}
    if len(tasks) != len(freeze['tasks']):
        raise ValueError('Duplicate selected task identity')
    seen = set()
    configs = {f'{prefix}{i}' for prefix in ('v', 'h', 'u') for i in range(1, 7)} | {'s'}
    rounds = {'D1', 'D2'} | {f'V{i}' for i in range(1, 11)}
    if len(rows) != len(tasks) * len(configs) * len(rounds):
        raise ValueError('Schedule must preserve every task/configuration/round opportunity')
    for op in rows:
        task = tasks.get(op.get('task_key'))
        if not task or op.get('benchmark') != task['benchmark'] or any(op.get(k) != freeze[k] for k in ('protocol_id', 'scope', 'schedule_sha256')):
            raise ValueError('Opportunity differs from frozen selection')
        identity = json.dumps([op['schedule_sha256'], op['task_key'], op['config_id'], op['round']], ensure_ascii=False, separators=(',', ':'))
        if hashlib.sha256(identity.encode()).hexdigest() != op['opportunity_id'] or op['opportunity_id'] in seen:
            raise ValueError('Frozen opportunity identity mismatch/duplicate')
        seen.add(op['opportunity_id'])
        if op['config_id'] not in configs or op['round'] not in rounds:
            raise ValueError('Configuration/round outside adopted manuscript design')
        if op['phase'] != ('discovery' if op['round'] in ('D1', 'D2') else 'validation'):
            raise ValueError('D/V schedule drift')
    return rows, freeze


def bind(plan, package, freeze=None):
    seen = set()
    for op in plan:
        if op.get('scope') not in ('synthetic', 'diagnostic') or op.get('protocol_id') != 'pss-manuscript-v2.1':
            raise ValueError('Diagnostic/synthetic active-study plan required')
        if op['opportunity_id'] in seen:
            raise ValueError('Duplicate opportunity')
        seen.add(op['opportunity_id'])
        b = package['executors'][op['config_id']][op['benchmark']]
        validate_commands(b)
        if b['config_id'] != op['config_id']:
            raise ValueError('Configuration mismatch')
        if freeze is not None:
            framework = 'playwright' if op['config_id'] == 's' else 'browser-use-restricted' if op['config_id'].startswith('u') else 'agentlab-browsergym'
            if b['framework'] != framework:
                raise ValueError('Framework differs from frozen configuration identity')
        task = package['tasks'][op['task_key']]
        # Specs and evaluator references live in separate files; no implicit P/F IDs.
        raw = Path(task['agent_input_file']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != task['agent_input_sha256']:
            raise ValueError('Outcome-free input source drift')
        if freeze is None:
            if op['scope'] != 'synthetic':
                raise ValueError('Official diagnostic binding requires a byte-pinned schedule freeze')
            payload, evidence, ref = json.loads(raw), None, task['evaluation_ref']
        else:
            selected = next(t for t in freeze['tasks'] if t['task_key'] == op['task_key'])
            for field in ('benchmark', 'official_task_id', 'application', 'source_sha256'):
                if task.get(field) != selected.get(field) or task.get(field) is None:
                    raise ValueError('Official task source correspondence mismatch: ' + field)
            if task['agent_input_sha256'] != selected.get('agent_input_sha256'):
                raise ValueError('Actor input was not frozen with the selected official task')
            # The source file itself and the evaluator-only mapping are independently pinned.
            read_pinned(task['source_file'], selected['source_sha256'])
            ref = task['evaluation_ref']
            gold = json.loads(read_pinned(ref['file'], ref['sha256']))
            for field in ('benchmark', 'official_task_id', 'application', 'source_sha256'):
                if gold.get(field) != selected.get(field):
                    raise ValueError('Evaluator mapped to another official task')
            payload = task_projection(json.loads(raw), op['benchmark'])
            evidence = {k: op[k] for k in ('task_key', 'benchmark', 'schedule_sha256')}
            evidence.update(official_task_id=selected['official_task_id'], source_sha256=selected['source_sha256'],
                input_file_sha256=task['agent_input_sha256'], agent_payload_sha256=digest(payload),
                evaluation_ref_sha256=digest(ref), schedule_freeze_sha256=package['schedule_freeze_sha256'])
        yield {**op, 'configuration_sha256': b['configuration_sha256'],
               'runtime_binding_sha256': digest(b), 'model_binding': b.get('model_binding'), 'environment_id': b['environment_id'],
               'agent_input': payload, 'evaluation_ref': ref, **({'task_input_binding': evidence} if evidence else {})}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--plan', required=True)
    p.add_argument('--bindings', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--freeze', required=True, help='schedule-freeze.json produced alongside this exact plan')
    a = p.parse_args()
    package = json.loads(Path(a.bindings).read_text())
    plan, freeze = frozen_plan(a.plan, a.freeze, package['schedule_freeze_sha256'])
    rows = list(bind(plan, package, freeze))
    import os
    fd = os.open(a.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        for row in rows:
            f.write(json.dumps(row) + '\n')
    print(json.dumps({'bound': len(rows), 'executions': 0, 'confirmatory_authorized': False}))


if __name__ == '__main__':
    main()
