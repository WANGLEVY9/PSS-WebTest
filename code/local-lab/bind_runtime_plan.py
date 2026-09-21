"""Bind an exported study plan to real pinned adapters and separate agent inputs.

This creates executable DIAGNOSTIC opportunities only. It neither infers global
missing records nor authorizes confirmatory collection.
"""
import argparse
import json
from pathlib import Path
from runtime_store import digest
from runtime_worker import validate_commands


def bind(plan, package):
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
        task = package['tasks'][op['task_key']]
        # Specs and evaluator references live in separate files; no implicit P/F IDs.
        raw = Path(task['agent_input_file']).read_bytes()
        import hashlib
        if hashlib.sha256(raw).hexdigest() != task['agent_input_sha256']:
            raise ValueError('Outcome-free input source drift')
        yield {**op, 'configuration_sha256': b['configuration_sha256'],
               'runtime_binding_sha256': digest(b), 'model_binding': b.get('model_binding'), 'environment_id': b['environment_id'],
               'agent_input': json.loads(raw), 'evaluation_ref': task['evaluation_ref']}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--plan', required=True)
    p.add_argument('--bindings', required=True)
    p.add_argument('--output', required=True)
    a = p.parse_args()
    package = json.loads(Path(a.bindings).read_text())
    with open(a.plan) as f:
        rows = list(bind((json.loads(line) for line in f if line.strip()), package))
    with open(a.output, 'x') as f:
        for row in rows:
            f.write(json.dumps(row) + '\n')
    print(json.dumps({'bound': len(rows), 'executions': 0, 'confirmatory_authorized': False}))


if __name__ == '__main__':
    main()
