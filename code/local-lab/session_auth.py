"""Supervisor-only, per-reset authentication provenance. Never actor input.

This checks binding and credential scope, not whether a server still accepts a
session. The reset adapter must perform a site-specific authenticated health
probe and pin its evidence; live acceptance independently checks that probe.
"""
import json
import math
import stat
import time
from pathlib import Path
from urllib.parse import urlsplit
from runtime_inputs import read_pinned

IDENTITY = ('opportunity_id', 'environment_id', 'configuration_sha256', 'lease_token')


def private_json(ref):
    path = Path(ref['file'])
    if not path.is_absolute() or path.is_symlink() or not path.is_file():
        raise ValueError('Absolute non-symlink authentication file required')
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise ValueError('Authentication evidence must be private (0600)')
    return json.loads(read_pinned(str(path), ref['sha256']))


def authenticated_state(ref, op, reset, baseline, routes, now=None):
    now = time.time() if now is None else now
    proof = private_json(ref)
    if proof.get('schema') != 'pss-reset-auth-v1':
        raise ValueError('Reset-scoped authentication proof required')
    for key in IDENTITY:
        if not op.get(key) or proof.get(key) != op[key] or reset.get(key) != op[key]:
            raise ValueError('Authentication execution or lease mismatch')
    if (proof.get('baseline_sha256') != baseline
        or proof.get('reset_evidence_ref') != reset.get('reset_evidence_ref')
        or proof.get('setup_ref') != op.get('setup_ref')
        or proof.get('scope') != op.get('scope')
        or proof.get('data_kind') != ('MEASURED' if op['scope']=='diagnostic' else 'SYNTHETIC_TEST')):
        raise ValueError('Authentication baseline/setup/reset/provenance mismatch')
    read_pinned(proof['reset_evidence_ref']['file'], proof['reset_evidence_ref']['sha256'])
    created, expires = proof.get('created_at_unix'), proof.get('expires_at_unix')
    if any(type(v) not in (int, float) or not math.isfinite(v) for v in (created, expires, now)) or not created <= now < expires:
        raise ValueError('Authentication evidence expired or future-dated')
    health = private_json(proof['authenticated_health_ref'])
    setup=json.loads(read_pinned(proof['setup_ref']['file'],proof['setup_ref']['sha256']))
    required_sites=setup.get('authentication_sites',setup.get('sites',[]))
    if not required_sites or set(proof.get('authenticated_sites',[]))!=set(required_sites):
        raise ValueError('Authentication does not cover the frozen required sites')
    if (any(health.get(k) != op[k] for k in IDENTITY)
        or health.get('reset_evidence_ref') != reset['reset_evidence_ref']
        or health.get('authenticated') is not True
        or not isinstance(health.get('sites'), list)
        or set(health['sites']) != set(proof.get('authenticated_sites', []))
        or not health['sites']):
        raise ValueError('Authenticated health evidence missing or misbound')
    state = private_json(proof['storage_state_ref'])
    if set(state) != {'cookies', 'origins'} or not all(isinstance(state[k], list) for k in state):
        raise ValueError('Explicit cookies/origins storage state required')
    allowed = {urlsplit(url).scheme+'://'+urlsplit(url).netloc for url in routes.values()}
    hosts = {urlsplit(url).hostname for url in allowed}
    if any(origin.get('origin') not in allowed for origin in state['origins']):
        raise ValueError('Authentication origin outside deployed routes')
    for cookie in state['cookies']:
        # Parent-domain cookies would cross instance boundaries. Never widen.
        if cookie.get('domain', '').lstrip('.') not in hosts:
            raise ValueError('Authentication cookie outside deployed hosts')
        expiration = cookie.get('expires', -1)
        if type(expiration) not in (int, float) or not math.isfinite(expiration) or (expiration != -1 and expiration <= now):
            raise ValueError('Expired authentication cookie')
    if not state['cookies'] and not any(o.get('localStorage') for o in state['origins']):
        raise ValueError('Empty authenticated state')
    return state
