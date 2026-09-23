"""Shared, single-host API budget. Never expire or discard ambiguous reservations.

All monetary values are integer micro-CNY. This ledger must live outside run
directories and be shared by every admitted provider transport on the host.
"""
import contextlib
import hashlib
import json
import os
import sqlite3
import sys
import time


def validate_policy(policy):
    if policy.get('schema') != 'pss-spend-policy-v1':
        raise ValueError('Invalid spend policy schema')
    for key in ('cap_micro_cny', 'warning_micro_cny', 'critical_micro_cny',
                'stop_new_tasks_micro_cny', 'task_cap_micro_cny',
                'task_max_requests', 'task_timeout_ms', 'task_max_actions', 'request_timeout_ms'):
        if type(policy.get(key)) is not int or not 0 < policy[key] <= 2**53-1:
            raise ValueError('Positive integer policy field required: ' + key)
    if not (policy['warning_micro_cny'] < policy['critical_micro_cny'] <
            policy['stop_new_tasks_micro_cny'] < policy['cap_micro_cny']):
        raise ValueError('Budget thresholds must be ordered')
    if policy['task_cap_micro_cny'] > policy['cap_micro_cny']:
        raise ValueError('Task cap exceeds shared budget')


class SpendGuard:
    def __init__(self, filename, policy, clock=time.time):
        validate_policy(policy)
        self.policy, self.clock = policy, clock
        os.makedirs(os.path.dirname(os.path.abspath(filename)), mode=0o700, exist_ok=True)
        self.db = sqlite3.connect(filename, timeout=10, isolation_level=None)
        os.chmod(filename, 0o600)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
          CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, started REAL NOT NULL);
          CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY, task TEXT NOT NULL,
            reserved INTEGER NOT NULL, charge INTEGER, settled INTEGER NOT NULL DEFAULT 0,
            at REAL NOT NULL, identity TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS requests_task ON requests(task);
          CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY, at REAL NOT NULL,
            kind TEXT NOT NULL UNIQUE, exposure INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS reconciliations(request TEXT PRIMARY KEY,
            at REAL NOT NULL, charge INTEGER NOT NULL, evidence_sha256 TEXT NOT NULL);''')
        encoded = json.dumps(policy, sort_keys=True, separators=(',', ':'), allow_nan=False)
        self.fingerprint = hashlib.sha256(encoded.encode()).hexdigest()
        with self.transaction():
            row = self.db.execute("SELECT value FROM settings WHERE key='policy'").fetchone()
            used = self.db.execute('SELECT COUNT(*) FROM requests').fetchone()[0]
            if row and row['value'] != self.fingerprint and used:
                # Never silently reset or enlarge a budget by swapping its policy.
                raise ValueError('Budget policy differs from durable ledger; audited migration required')
            self.db.execute("INSERT OR REPLACE INTO settings VALUES('policy',?)", (self.fingerprint,))

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

    def exposure(self, task=None):
        sql = 'SELECT COALESCE(SUM(COALESCE(charge,reserved)),0) FROM requests'
        return self.db.execute(sql + (' WHERE task=?' if task else ''), (task,) if task else ()).fetchone()[0]

    def alert(self, kind):
        self.db.execute('INSERT OR IGNORE INTO alerts(at,kind,exposure) VALUES(?,?,?)',
                        (self.clock(), kind, self.exposure()))

    def thresholds(self):
        for key in ('warning', 'critical', 'stop_new_tasks', 'cap'):
            if self.exposure() >= self.policy[key + '_micro_cny']:
                self.alert(key)

    def reserve(self, request_id, task_id, maximum_micro_cny, identity):
        if not isinstance(request_id, str) or not request_id or not isinstance(task_id, str) or not task_id:
            raise ValueError('Stable request and task identities required')
        if type(maximum_micro_cny) is not int or maximum_micro_cny <= 0:
            raise ValueError('Positive worst-case request reservation required')
        error = None
        with self.transaction():
            task = self.db.execute('SELECT started FROM tasks WHERE id=?', (task_id,)).fetchone()
            count = self.db.execute('SELECT COUNT(*) FROM requests WHERE task=?', (task_id,)).fetchone()[0]
            paused = self.db.execute("SELECT value FROM settings WHERE key='paused'").fetchone()
            if self.db.execute('SELECT 1 FROM requests WHERE id=?', (request_id,)).fetchone():
                error = 'duplicate-request'
            elif paused and paused['value'] == '1':
                error = 'paused'
            elif self.db.execute("SELECT 1 FROM alerts WHERE kind='reservation-overrun'").fetchone():
                error = 'reservation-overrun'
            elif self.exposure() + maximum_micro_cny > self.policy['cap_micro_cny']:
                error = 'global-cap'
            elif not task and self.exposure() >= self.policy['stop_new_tasks_micro_cny']:
                error = 'stop-new-tasks'
            elif self.exposure(task_id) + maximum_micro_cny > self.policy['task_cap_micro_cny']:
                error = 'task-cap'
            elif count >= self.policy['task_max_requests']:
                error = 'task-request-limit'
            elif task and (self.clock()-task['started'])*1000 >= self.policy['task_timeout_ms']:
                error = 'task-deadline'
            if error:
                self.alert(error)
            else:
                self.db.execute('INSERT OR IGNORE INTO tasks VALUES(?,?)', (task_id, self.clock()))
                self.db.execute('INSERT INTO requests(id,task,reserved,at,identity) VALUES(?,?,?,?,?)',
                                (request_id, task_id, maximum_micro_cny, self.clock(), json.dumps(identity)))
                self.thresholds()
        if error:
            raise ValueError('Spend guard blocked: ' + error)
        started = task['started'] if task else self.clock()
        return {'remaining_ms': max(1, int(self.policy['task_timeout_ms']-(self.clock()-started)*1000))}

    def settle(self, request_id, charge_micro_cny):
        if charge_micro_cny is not None and (type(charge_micro_cny) is not int or charge_micro_cny < 0):
            raise ValueError('Invalid charge')
        with self.transaction():
            row = self.db.execute('SELECT * FROM requests WHERE id=?', (request_id,)).fetchone()
            if not row:
                raise ValueError('Missing reservation')
            if row['settled']:
                if row['charge'] != charge_micro_cny:
                    raise ValueError('Conflicting settlement')
                return
            self.db.execute('UPDATE requests SET charge=?,settled=1 WHERE id=?', (charge_micro_cny, request_id))
            if charge_micro_cny is None:
                self.alert('charge-unknown')
            if charge_micro_cny is not None and charge_micro_cny > row['reserved']:
                self.alert('reservation-overrun')
            self.thresholds()

    def pause(self, paused, reason='operator-pause'):
        if type(paused) is not bool or reason not in ('operator-pause', 'provider-budget', 'provider-auth', 'provider-model-mismatch'):
            raise ValueError('Explicit pause state required')
        with self.transaction():
            self.db.execute("INSERT OR REPLACE INTO settings VALUES('paused',?)", ('1' if paused else '0',))
            if paused:
                self.alert(reason)

    def reconcile(self, request_id, charge_micro_cny, evidence_sha256):
        """Explicit billing reconciliation, never an automatic timeout refund."""
        if (type(charge_micro_cny) is not int or charge_micro_cny < 0 or
                not isinstance(evidence_sha256, str) or len(evidence_sha256) != 64 or
                any(c not in '0123456789abcdef' for c in evidence_sha256)):
            raise ValueError('Final billing amount and evidence digest required')
        with self.transaction():
            row = self.db.execute('SELECT * FROM requests WHERE id=?', (request_id,)).fetchone()
            if not row or row['charge'] is not None:
                raise ValueError('Only unpriced reservations can be reconciled')
            self.db.execute('INSERT INTO reconciliations VALUES(?,?,?,?)',
                            (request_id, self.clock(), charge_micro_cny, evidence_sha256))
            self.db.execute('UPDATE requests SET settled=1,charge=? WHERE id=?', (charge_micro_cny, request_id))
            if charge_micro_cny > row['reserved']:
                self.alert('reservation-overrun')
            self.thresholds()

    def summary(self):
        with self.transaction():
            rows = self.db.execute('SELECT COUNT(*) requests, COALESCE(SUM(charge),0) known_micro_cny, '
                'SUM(CASE WHEN charge IS NULL THEN reserved ELSE 0 END) held_micro_cny, '
                'SUM(CASE WHEN charge IS NULL THEN 1 ELSE 0 END) unknown_requests FROM requests').fetchone()
            paused = self.db.execute("SELECT value FROM settings WHERE key='paused'").fetchone()
            return {**dict(rows), 'exposure_micro_cny': self.exposure(),
                    'policy_sha256': self.fingerprint, 'paused': bool(paused and paused['value'] == '1'),
                    'alerts': [dict(r) for r in self.db.execute('SELECT * FROM alerts ORDER BY id DESC')],
                    'tasks': [dict(r) for r in self.db.execute('SELECT t.id, t.started, COUNT(r.id) requests, '
                        'SUM(COALESCE(r.charge,r.reserved)) exposure_micro_cny FROM tasks t JOIN requests r ON r.task=t.id '
                        'GROUP BY t.id ORDER BY t.started DESC LIMIT 20')]}


if __name__ == '__main__':
    try:
        payload = json.load(sys.stdin)
        with open(sys.argv[3], 'rb') as stream:
            raw_policy = stream.read()
        if payload.pop('policy_file_sha256', None) != hashlib.sha256(raw_policy).hexdigest():
            raise ValueError('Budget policy changed after provider binding')
        policy = json.loads(raw_policy)
        guard = SpendGuard(sys.argv[2], policy)
        command = sys.argv[1]
        if command == 'reserve':
            result = guard.reserve(**payload)
        elif command == 'settle':
            result = guard.settle(**payload)
        elif command == 'pause':
            result = guard.pause(**payload)
        elif command == 'reconcile':
            result = guard.reconcile(**payload)
        elif command == 'summary':
            result = guard.summary()
        else:
            raise ValueError('Unknown spend command')
        print(json.dumps(result or {}))
        guard.close()
    except (ValueError, OSError, sqlite3.Error) as exc:
        print(json.dumps({'error': str(exc)}))
        sys.exit(1)
