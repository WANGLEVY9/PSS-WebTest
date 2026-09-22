"""VWA-specific reset requirements; never confuses official browser reset with DB reset.

Pinned ScriptBrowserEnv.setup implements only Classifieds HTTP reset and checks
status 200. Shopping/Reddit print a warning. Neither proves complete baseline
restoration or isolation. This module validates a separately measured full-site
reset manifest; it does not claim to restore, deploy, or admit any environment.
"""
import re

from wav_native_evaluate import pinned
import json

MUTABLE = {'classifieds', 'shopping', 'reddit'}
KNOWN = MUTABLE | {'wikipedia', 'homepage'}


def requirements(official_config):
    sites = official_config.get('sites')
    if not isinstance(sites, list) or not sites or set(sites) - KNOWN or len(set(sites)) != len(sites):
        raise ValueError('Explicit official VWA site closure required')
    mutable = sorted(set(sites) & MUTABLE)
    return {'closure_sites': sorted(sites), 'mutable_sites': mutable,
            'native_http_reset_sites': ['classifieds'] if 'classifieds' in sites else [],
            'external_snapshot_restore_sites': sorted(set(mutable) - {'classifieds'}),
            'required_for_every_arm_and_repetition': True,
            'http_200_sufficient': False, 'original_require_reset': official_config.get('require_reset'),
            'does_not_exclude_read_only_labeled_tasks': True}


def verify_measured_reset(reset, official_config, identity, baseline_sha256):
    """Verify pinned per-site measurements, not self-reported restored=true alone.

    Caller must have exclusive fixture lease across reset → actor → evaluator →
    cleanup; acquisition/release receipts are independently checked by scheduler.
    """
    needs = requirements(official_config)
    if not re.fullmatch('[a-f0-9]{64}', baseline_sha256 or ''):
        raise ValueError('Frozen full baseline manifest SHA required')
    for key in ('opportunity_id', 'environment_id', 'configuration_sha256', 'scope', 'data_kind'):
        if reset.get(key) != identity.get(key):
            raise ValueError('Reset identity/provenance mismatch')
    expected_kind = 'MEASURED' if identity.get('scope') == 'diagnostic' else 'SYNTHETIC_TEST'
    if identity.get('scope') not in ('synthetic', 'diagnostic') or identity.get('data_kind') != expected_kind:
        raise ValueError('Explicit reset provenance required')
    if reset.get('restored') is not True or reset.get('baseline_sha256') != baseline_sha256:
        raise ValueError('Frozen baseline restoration not established')
    if sorted(reset.get('closure_sites', [])) != needs['closure_sites']:
        raise ValueError('Incomplete multi-site reset closure')
    proof = json.loads(pinned(reset.get('reset_evidence_ref')))
    if proof.get('schema') != 'pss-vwa-reset-measurements-v1':
        raise ValueError('Pinned VWA reset measurements required')
    for key in ('opportunity_id', 'environment_id', 'configuration_sha256', 'scope', 'data_kind'):
        if proof.get(key) != identity.get(key):
            raise ValueError('Reset proof belongs to another execution')
    if proof.get('baseline_sha256') != baseline_sha256 or proof.get('lease_token') != reset.get('lease_token') or not reset.get('lease_token'):
        raise ValueError('Reset baseline/lease binding mismatch')
    rows = proof.get('sites')
    if not isinstance(rows, list) or sorted(x.get('site', '') for x in rows) != needs['closure_sites']:
        raise ValueError('One and only one measured proof per closure site required')
    for row in rows:
        mutable = row['site'] in MUTABLE
        if row.get('restore_method') not in (('official-http-reset', 'snapshot-restore') if row['site'] == 'classifieds' else ('snapshot-restore',) if mutable else ('immutable-fixture-verification',)):
            raise ValueError('Unsupported per-site reset method')
        if row.get('expected_state_sha256') != row.get('observed_state_sha256') or not re.fullmatch('[a-f0-9]{64}', row.get('expected_state_sha256', '')):
            raise ValueError('Measured post-reset state does not equal frozen complete baseline')
        measurement = json.loads(pinned(row.get('measurement_ref')))
        if measurement.get('site') != row['site'] or measurement.get('state_sha256') != row['observed_state_sha256'] or measurement.get('coverage') != 'full-mutable-state-closure':
            raise ValueError('Full-state measurement evidence missing or mismatched')
        for key in ('opportunity_id', 'environment_id', 'configuration_sha256'):
            if measurement.get(key) != identity.get(key):
                raise ValueError('Reused per-site measurement')
        if row.get('health_verified') is not True:
            raise ValueError('Restored site health not established')
    return needs
