# -*- coding: utf-8 -*-
"""Diagnostic evaluator inputs, NOT arm executions or task-screening decisions."""
import hashlib
import json
from pathlib import Path
from webarena_verified import WebArenaVerified

CODE = Path(__file__).resolve().parents[1]
SOURCE = CODE / 'artifacts/benchmark-snapshots/webarena-verified'
wa = WebArenaVerified(config=CODE / 'experiment/benchmark-config.json')
har = SOURCE / 'tests/assets/network.har'
rows = []
for status, value in [('NOT_FOUND_ERROR', []), ('SUCCESS', []),
                      ('SUCCESS', ['synthetic-incorrect-answer']),
                      ('NOT_FOUND_ERROR', ['synthetic-incorrect-answer'])]:
    response = {'task_type': 'RETRIEVE', 'status': status, 'retrieved_data': value}
    result = wa.evaluate_task(task_id=22, agent_response=json.dumps(response), network_trace=har)
    rows.append({'input_status': status, 'input_shape': 'empty-array' if not value else 'nonempty-array',
                 'official_status': result.status.value, 'official_score': result.score})
report = {'kind': 'OFFICIAL_EVALUATOR_EDGE_CASE_PREFLIGHT', 'task_id': 22,
          'agent_executions': 0, 'confirmatory_authorized': False,
          'source_har_sha256': hashlib.sha256(har.read_bytes()).hexdigest(),
          'rows': rows,
          'interpretation': 'Nonempty answers may trigger a native evaluator error. Keep unresolved and separately report execution status; do not auto-exclude as external infrastructure. No evaluator patch or answer repair.'}
(CODE/'artifacts/local-runtime/wav-evaluator-edge-preflight.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
