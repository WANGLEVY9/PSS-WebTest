"""Read-only diagnostic ledger -> normalized research bundle; no admission grant."""
import argparse
import json
import os
from pathlib import Path
import sqlite3
from runtime_identity import task_contract, sha
from runtime_store import canonical


def export_records(database: str, bundle: dict) -> dict:
    if bundle.get('scope') not in ('synthetic', 'diagnostic'):
        raise ValueError('Diagnostic/synthetic export only; formal admission remains separate')
    path = Path(database).resolve()
    db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    records = []
    tasks = {t['task_key']: t for t in bundle['tasks']}
    try:
        db.execute('BEGIN')  # One consistent WAL snapshot, including requests/events.
        for row in db.execute("SELECT * FROM opportunities WHERE state='terminal' ORDER BY rowid"):
            op, result = json.loads(row['payload']), json.loads(row['result'])
            task = task_contract(op)
            if op['scope'] != bundle['scope'] or op['protocol_id'] != bundle['protocol_id'] or task != tasks.get(op['task_key']):
                raise ValueError('Ledger differs from selected bundle')
            started = db.execute("SELECT 1 FROM events WHERE opportunity=? AND kind='actor_started' LIMIT 1", (row['id'],)).fetchone() is not None
            requests = db.execute('SELECT charge FROM requests WHERE opportunity=?', (row['id'],)).fetchall()
            charges = [r['charge'] for r in requests]
            # No requests is not proof that an adapter made no unaccounted API calls.
            total = sum(charges) / 1000000 if charges and all(c is not None for c in charges) else None
            record = {k: v for k, v in op.items() if k in (
                'protocol_id','opportunity_id','task_key','benchmark','config_id','round','phase',
                'matched_block_id','scope','schedule_sha256','identity_schema','task_manifest_json','task_manifest_sha256',
                'configuration_sha256','runtime_binding_sha256','executor_binding_sha256')}
            record.update(data_kind='SYNTHETIC_TEST' if op['scope']=='synthetic' else 'MEASURED',
                source_opportunity_id=row['id'], source_sha256=sha(canonical({'opportunity':op,'result':result}).encode()),
                preparation_status='prepared', started=started, assessment_status=result.get('assessment_status','unresolved'),
                budget_met=result.get('budget_met'), terminal_status=result.get('terminal_status','interrupted'),
                native_score=result.get('native_score'), verdict=result.get('verdict'),
                actor_terminal_status=result.get('actor_terminal_status'),
                execution_charge_usd=total, request_count=len(requests),
                agent_wall_ms=result.get('phase_timings_ms',{}).get('actor'), total_tokens=None)
            if result.get('step_class'): record['step_class'] = result['step_class']
            records.append(record)
        incomplete = dict(db.execute("SELECT state,COUNT(*) FROM opportunities WHERE state!='terminal' GROUP BY state").fetchall())
        db.execute('COMMIT')
    finally:
        db.close()
    return {**bundle, 'records':records, 'runtime_export':{'schema':'diagnostic-ledger-export-v1',
        'terminal_records':len(records), 'nonterminal_states':incomplete,
        'confirmatory_authorized':False, 'note':'Unresolved/quarantined cells remain absent/unknown, not automatically rerun. Request coverage requires separate live reconciliation.'}}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--database', required=True)
    p.add_argument('--bundle', required=True)
    p.add_argument('--output', required=True)
    a = p.parse_args()
    out = export_records(a.database, json.loads(Path(a.bundle).read_text()))
    fd = os.open(a.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(json.dumps(out, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(out['runtime_export']))


if __name__ == '__main__':
    main()
