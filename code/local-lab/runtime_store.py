"""Single-host durable execution ledger. SQLite WAL; not a distributed/NFS lock.

A logical opportunity is never retried after it may have touched the SUT. An
expired started lease is quarantined, including its environment, until reviewed.
"""
import contextlib
import hashlib
import json
import os
import sqlite3
import time
import uuid


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


class Store:
    def __init__(self, filename, clock=time.time):
        self.filename = os.path.abspath(filename)
        self.clock = clock
        self.db = sqlite3.connect(filename, timeout=30, isolation_level=None)
        if filename != ':memory:':
            os.chmod(filename, 0o600)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('PRAGMA synchronous=FULL')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS opportunities(
          id TEXT PRIMARY KEY, payload TEXT NOT NULL, environment TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'queued', token TEXT, lease REAL, result TEXT);
        CREATE UNIQUE INDEX IF NOT EXISTS scientific_cell ON opportunities(
          json_extract(payload,'$.schedule_sha256'), json_extract(payload,'$.task_key'),
          json_extract(payload,'$.config_id'), json_extract(payload,'$.round'))
          WHERE json_extract(payload,'$.task_key') IS NOT NULL;
        CREATE TABLE IF NOT EXISTS environment_locks(
          environment TEXT PRIMARY KEY, opportunity TEXT UNIQUE NOT NULL, token TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events(
          sequence INTEGER PRIMARY KEY, at REAL NOT NULL, opportunity TEXT, kind TEXT NOT NULL, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS requests(
          id TEXT PRIMARY KEY, opportunity TEXT NOT NULL REFERENCES opportunities(id),
          identity TEXT NOT NULL, reservation INTEGER NOT NULL, response TEXT, charge INTEGER);
        ''')

    def close(self):
        self.db.close()

    @contextlib.contextmanager
    def transaction(self):
        self.db.execute('BEGIN IMMEDIATE')
        try:
            yield
            self.db.execute('COMMIT')
        except BaseException:
            self.db.execute('ROLLBACK')
            raise

    def event(self, op, kind, payload):
        self.db.execute('INSERT INTO events(at,opportunity,kind,payload) VALUES(?,?,?,?)',
                        (self.clock(), op, kind, canonical(payload)))

    def enqueue(self, opportunities):
        with self.transaction():
            for op in opportunities:
                encoded = canonical(op)
                if not op.get('opportunity_id') or not op.get('environment_id') or not op.get('schedule_sha256'):
                    raise ValueError('Bound opportunity and environment identity required')
                old = self.db.execute('SELECT payload FROM opportunities WHERE id=?', (op['opportunity_id'],)).fetchone()
                if old:
                    if old['payload'] != encoded:
                        raise ValueError('Opportunity identity collision; never replace source')
                    continue
                self.db.execute('INSERT INTO opportunities(id,payload,environment) VALUES(?,?,?)',
                                (op['opportunity_id'], encoded, op['environment_id']))
                self.event(op['opportunity_id'], 'enqueued', {'payload_sha256': digest(op)})

    def recover(self):
        with self.transaction():
            for row in self.db.execute("SELECT * FROM opportunities WHERE state IN ('leased','running') AND lease<=?", (self.clock(),)).fetchall():
                state = 'uncertain' if row['state'] == 'running' else 'queued'
                self.db.execute('UPDATE opportunities SET state=? WHERE id=?', (state, row['id']))
                if state == 'queued':
                    self.db.execute('DELETE FROM environment_locks WHERE opportunity=?', (row['id'],))
                self.event(row['id'], 'lease_expired', {'state': state, 'old_token': row['token']})

    def claim(self, lease_seconds=30, config_id=None, environment_id=None):
        if lease_seconds <= 0:
            raise ValueError('Positive lease required')
        with self.transaction():
            candidates = self.db.execute("SELECT * FROM opportunities WHERE state='queued' AND environment NOT IN (SELECT environment FROM environment_locks) ORDER BY rowid").fetchall()
            row = None
            for candidate in candidates:
                payload = json.loads(candidate['payload'])
                if config_id is not None and payload.get('config_id') != config_id:
                    continue
                if environment_id is not None and payload.get('environment_id') != environment_id:
                    continue
                if payload.get('phase') == 'validation':
                    pending = self.db.execute("SELECT 1 FROM opportunities WHERE state!='terminal' AND json_extract(payload,'$.phase')='discovery' AND json_extract(payload,'$.schedule_sha256')=? LIMIT 1", (payload['schedule_sha256'],)).fetchone()
                    if pending:
                        continue
                row = candidate
                break
            if not row:
                return None
            token = uuid.uuid4().hex
            self.db.execute('INSERT INTO environment_locks VALUES(?,?,?)', (row['environment'], row['id'], token))
            self.db.execute("UPDATE opportunities SET state='leased',token=?,lease=? WHERE id=?", (token, self.clock()+lease_seconds, row['id']))
            self.event(row['id'], 'claimed', {'token': token})
            return {**json.loads(row['payload']), 'lease_token': token}

    def owned(self, op, token, states=('leased', 'running')):
        row = self.db.execute('SELECT * FROM opportunities WHERE id=?', (op,)).fetchone()
        if not row or row['token'] != token or row['state'] not in states or row['lease'] <= self.clock():
            raise ValueError('Stale or invalid worker lease')
        return row

    def start(self, op, token):
        with self.transaction():
            self.owned(op, token, ('leased',))
            # Commit BEFORE reset or any other external side effect.
            self.db.execute("UPDATE opportunities SET state='running' WHERE id=?", (op,))
            self.event(op, 'started_before_reset', {})

    def heartbeat(self, op, token, seconds=30):
        if seconds <= 0:
            raise ValueError('Positive lease required')
        with self.transaction():
            self.owned(op, token)
            self.db.execute('UPDATE opportunities SET lease=? WHERE id=?', (self.clock()+seconds, op))

    def finish(self, op, token, result):
        encoded = canonical(result)
        with self.transaction():
            old = self.db.execute('SELECT * FROM opportunities WHERE id=?', (op,)).fetchone()
            if old and old['state'] == 'terminal' and old['token'] == token and old['result'] == encoded:
                return  # Lost acknowledgement: exact replay is safe.
            self.owned(op, token, ('running',))
            self.db.execute("UPDATE opportunities SET state='terminal', result=? WHERE id=?", (encoded, op))
            self.db.execute('DELETE FROM environment_locks WHERE opportunity=?', (op,))
            self.event(op, 'terminal', result)

    def quarantine(self, op, token, reason):
        with self.transaction():
            self.owned(op, token, ('running',))
            self.db.execute("UPDATE opportunities SET state='uncertain' WHERE id=?", (op,))
            self.event(op, 'quarantined', {'reason': reason})

    def resolve_uncertain(self, op, evidence_sha256, worker_terminated=False):
        if not worker_terminated or len(evidence_sha256) != 64 or any(c not in '0123456789abcdef' for c in evidence_sha256):
            raise ValueError('Termination and reconciliation evidence required')
        with self.transaction():
            row = self.db.execute('SELECT state FROM opportunities WHERE id=?', (op,)).fetchone()
            if not row or row['state'] != 'uncertain':
                raise ValueError('Not quarantined')
            result = {'terminal_status': 'interrupted', 'assessment_status': 'unresolved', 'reconciliation_sha256': evidence_sha256}
            self.db.execute("UPDATE opportunities SET state='terminal',result=? WHERE id=?", (canonical(result), op))
            self.db.execute('DELETE FROM environment_locks WHERE opportunity=?', (op,))
            self.event(op, 'reconciled_without_rerun', result)

    def reserve(self, op, token, request_id, identity, maximum_micro_usd, cap_micro_usd):
        if type(maximum_micro_usd) is not int or maximum_micro_usd < 0 or type(cap_micro_usd) is not int or cap_micro_usd < 0:
            raise ValueError('Nonnegative integer cost bounds required')
        with self.transaction():
            owned = self.owned(op, token, ('running',))
            binding = json.loads(owned['payload']).get('model_binding')
            if binding and (identity.get('provider') != binding.get('provider') or identity.get('model') != binding.get('model')):
                raise ValueError('Request identity changed frozen actor')
            if self.db.execute('SELECT 1 FROM requests WHERE id=?', (request_id,)).fetchone():
                raise ValueError('Request already reserved; ambiguous delivery must not be replayed')
            cap = self.db.execute("SELECT value FROM metadata WHERE key='cap_micro_usd'").fetchone()
            if cap and int(cap['value']) != cap_micro_usd:
                raise ValueError('Campaign cost cap cannot change within ledger')
            if not cap:
                self.db.execute("INSERT INTO metadata VALUES('cap_micro_usd',?)", (str(cap_micro_usd),))
            committed = self.db.execute('SELECT COALESCE(SUM(COALESCE(charge,reservation)),0) FROM requests').fetchone()[0]
            if committed + maximum_micro_usd > cap_micro_usd:
                raise ValueError('Campaign cost reservation limit')
            self.db.execute('INSERT INTO requests(id,opportunity,identity,reservation) VALUES(?,?,?,?)',
                            (request_id, op, canonical(identity), maximum_micro_usd))
            self.event(op, 'request_reserved', {'request_id': request_id, 'identity': identity, 'maximum_micro_usd': maximum_micro_usd})

    def settle(self, request_id, response, charge_micro_usd=None):
        if charge_micro_usd is not None and (type(charge_micro_usd) is not int or charge_micro_usd < 0):
            raise ValueError('Charge must be nonnegative integer or unknown')
        encoded = canonical(response)
        with self.transaction():
            row = self.db.execute('SELECT * FROM requests WHERE id=?', (request_id,)).fetchone()
            if not row:
                raise ValueError('Missing request reservation')
            if row['response'] is not None:
                if row['response'] == encoded and row['charge'] == charge_micro_usd:
                    return
                raise ValueError('Conflicting settlement')
            # Late billing is retained even after lease expiry; it cannot alter outcomes.
            self.db.execute('UPDATE requests SET response=?,charge=? WHERE id=?', (encoded, charge_micro_usd, request_id))
            self.event(row['opportunity'], 'request_settled', {'request_id': request_id, 'charge_micro_usd': charge_micro_usd})

    def summary(self):
        states = dict(self.db.execute('SELECT state,COUNT(*) FROM opportunities GROUP BY state').fetchall())
        r = self.db.execute('SELECT COUNT(*) AS attempts, COALESCE(SUM(charge),0) AS known_micro_usd, SUM(CASE WHEN charge IS NULL THEN 1 ELSE 0 END) AS unknown, COALESCE(SUM(COALESCE(charge,reservation)),0) AS reserved_exposure FROM requests').fetchone()
        cap = self.db.execute("SELECT value FROM metadata WHERE key='cap_micro_usd'").fetchone()
        return {'states': states, 'cap_micro_usd': int(cap['value']) if cap else None, 'reservation_overrun': bool(cap and r['reserved_exposure'] > int(cap['value'])), **dict(r), 'total_micro_usd': None if r['unknown'] else r['known_micro_usd'], 'distributed_safe': False}
