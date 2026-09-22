"""Pinned subprocess bridge: reset -> framework -> evaluator -> cleanup per arm.

No bundled smoke driver is branded as a formal framework adapter. Executable
bindings must be supplied and pinned; formal acquisition remains gated outside
this diagnostic worker. Child adapters must disable SDK retries and use the
request ledger for every provider attempt. No secrets are written to SQLite.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
from runtime_store import Store, canonical
from runtime_inputs import verify_bound_input, materialize_actor_input
from lifecycle_timing import POLICY, envelope_budget, verify_timing


class AdapterReceiptError(ValueError):
    """Untrusted/misattributed adapter output; quarantine rather than reuse SUT."""


def verify_receipt(receipt, identity):
    if not isinstance(receipt, dict) or any(receipt.get(k) != identity[k] for k in
            ('opportunity_id', 'environment_id', 'configuration_sha256')):
        raise AdapterReceiptError('Adapter receipt identity mismatch')
    for key in ('scope', 'data_kind'):
        if key in identity and receipt.get(key) != identity[key]:
            raise AdapterReceiptError('Adapter receipt provenance differs from trusted opportunity')


def unpack_actor_envelope(value, identity):
    """Keep immutable actor-end separate from supervisor-only closed HAR proof."""
    if not isinstance(value, dict):
        raise AdapterReceiptError('Actor receipt object required')
    if 'actor_result' not in value and 'actor_lifecycle_ref' not in value:
        verify_receipt(value, identity)
        return value, None  # Legacy diagnostic adapters; not WAV lifecycle admission.
    if set(value) != {'actor_result', 'actor_lifecycle_ref'}:
        raise AdapterReceiptError('Exact actor lifecycle envelope required')
    actor = value['actor_result']
    verify_receipt(actor, identity)
    from benchmark_actor_lifecycle import verify_lifecycle
    try:
        verify_lifecycle(value['actor_lifecycle_ref'], actor)
    except (ValueError, KeyError, TypeError, OSError):
        raise AdapterReceiptError('Invalid supervisor actor lifecycle proof') from None
    return actor, value['actor_lifecycle_ref']


def verify_native_endpoint(benchmark, evaluated):
    if evaluated.get('assessment_status') != 'valid':
        return
    if benchmark in ('wav', 'vwa'):
        if type(evaluated.get('native_score')) is not int or evaluated['native_score'] not in (0, 1) or evaluated.get('verdict') is not None:
            raise AdapterReceiptError('WAV/VWA require their native binary task score, not an ATA verdict')
    elif benchmark == 'ata':
        if evaluated.get('native_score') is not None or evaluated.get('verdict') not in (None, 'PASS', 'FAIL'):
            raise AdapterReceiptError('ATA requires a verdict endpoint, not a substituted task score')
        if evaluated.get('step_class') not in (None, 'AFB', 'AFC', 'AFA', 'Ustep'):
            raise AdapterReceiptError('Unknown independently assessed failure-step class')


def validate_commands(binding):
    if binding.get('timing_policy') not in (None,POLICY):
        raise ValueError('Unknown lifecycle timing policy')
    if binding.get('timing_policy')==POLICY:
        minimum=envelope_budget(binding['budget'],binding.get('lifecycle_limits'))
        if binding['commands']['actor']['timeout_ms']<minimum:
            raise ValueError('Actor envelope must include all frozen lifecycle phase budgets')
    if binding.get('framework') not in ('agentlab-browsergym', 'browser-use-restricted', 'playwright'):
        raise ValueError('Unsupported framework binding')
    if binding.get('coordinate_space', 'css-pixels') not in ('css-pixels', 'qwen-0-999'):
        raise ValueError('Explicit supported coordinate units required')
    for field in ('framework_revision', 'configuration_sha256', 'boundary_audit_sha256', 'baseline_sha256', 'environment_id'):
        if not binding.get(field):
            raise ValueError('Missing binding: ' + field)
    for field in ('task_timeout_ms', 'max_actions'):
        if type(binding.get('budget',{}).get(field)) is not int or binding['budget'][field] <= 0:
            raise ValueError('Positive frozen task wall-time and action budgets required')
    if binding['framework'] != 'playwright':
        model = binding.get('model_binding') or {}
        if not model.get('provider') or not model.get('model'):
            raise ValueError('Actual provider and API model ID required')
        cost = binding.get('cost_policy') or {}
        if any(type(cost.get(k)) is not int or cost[k] < 0 for k in ('cap_micro_usd', 'request_reservation_micro_usd')):
            raise ValueError('Frozen cost cap and request reservation required')
    if binding.get('sdk_max_retries') != 0:
        raise ValueError('Nested SDK retries must be disabled')
    for stage in ('reset', 'actor', 'evaluate', 'cleanup'):
        command = binding['commands'][stage]
        argv = command['argv']
        if not argv or not all(isinstance(v, str) and v for v in argv) or not Path(argv[0]).is_absolute():
            raise ValueError('Absolute executable and argv required; no shell expansion')
        source = Path(command['source'])
        if not source.is_absolute() or str(source) not in argv:
            raise ValueError('Pinned source must be an explicit command argument')
        if hashlib.sha256(source.read_bytes()).hexdigest() != command['sha256']:
            raise ValueError('Adapter source drift: ' + stage)
        if not isinstance(command['timeout_ms'], int) or command['timeout_ms'] <= 0:
            raise ValueError('Positive command deadline required')
        if stage == 'actor' and command['timeout_ms'] < binding['budget']['task_timeout_ms']:
            raise ValueError('Actor command cannot silently shorten the frozen task budget')


def run_command(command, payload, heartbeat):
    # All children are local processes; a timeout terminates the whole group.
    # Remote side effects may still be in flight, so timeout causes quarantine.
    p = subprocess.Popen(command['argv'], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, start_new_session=True, text=True)
    deadline = time.monotonic() + command['timeout_ms'] / 1000
    first = True
    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError('Adapter deadline exceeded')
            heartbeat()
            try:
                stdout, _ = p.communicate(canonical(payload) if first else None, timeout=min(5, remaining))
                if p.returncode:
                    raise RuntimeError('Adapter process failed')
                try:
                    return json.loads(stdout)
                except json.JSONDecodeError:
                    raise AdapterReceiptError('Adapter returned invalid JSON receipt') from None
            except subprocess.TimeoutExpired:
                first = False
    finally:
        # Also reap descendants left by a parent that has already exited.
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        p.wait()
        if p.stdin: p.stdin.close()
        if p.stdout: p.stdout.close()


def execute_one(store, binding, invoke=run_command):
    validate_commands(binding)
    op = store.claim(config_id=binding.get('config_id'), environment_id=binding['environment_id'])
    if not op:
        return None
    oid, token = op['opportunity_id'], op['lease_token']
    # Before start: binding failures do not mutate SUT. Lease may expire safely.
    if op.get('scope') not in ('synthetic', 'diagnostic'):
        raise ValueError('Formal execution requires benchmark-specific admission; this worker is diagnostic')
    if op['scope']=='diagnostic' and binding.get('timing_policy')!=POLICY:
        raise ValueError('New diagnostic runs require explicit frozen lifecycle timing policy')
    if op['environment_id'] != binding['environment_id'] or op.get('configuration_sha256') != binding['configuration_sha256'] or op.get('config_id') != binding.get('config_id'):
        raise ValueError('Opportunity/runtime binding mismatch')
    if op.get('runtime_binding_sha256') != hashlib.sha256(canonical(binding).encode()).hexdigest():
        raise ValueError('Full runtime binding is not frozen into opportunity')
    if op.get('model_binding') != binding.get('model_binding'):
        raise ValueError('Opportunity actor identity is not frozen into the request ledger')
    verify_bound_input(op)
    actor_input = materialize_actor_input(op['agent_input'])
    store.start(oid, token)
    heartbeat = lambda: store.heartbeat(oid, token)
    base = {'opportunity_id': oid, 'environment_id': op['environment_id'], 'lease_token': token,
            'configuration_sha256': binding['configuration_sha256'], 'scope': op['scope'],
            'data_kind': 'MEASURED' if op['scope']=='diagnostic' else 'SYNTHETIC_TEST'}
    result = {'terminal_status': 'reset-error', 'assessment_status': 'unresolved', 'native_score': None, 'verdict': None,
              'runtime_protocol': 'diagnostic-receipts-v2', 'actor_started': False, 'actor_terminal_status': None,
              'budget_met': None, 'protocol_completed': False, 'lifecycle_completed': False,
              'operational_correctness': None,
              'phase_timings_ms': {}, 'reset_receipt': None, 'framework': binding['framework'], 'framework_revision': binding['framework_revision']}
    uncertain = False
    stage = 'reset'
    start = time.monotonic()
    phase_start = start
    try:
        reset = invoke(binding['commands']['reset'], {**base, 'baseline_sha256': binding['baseline_sha256'],
            **({'setup_ref':op['setup_ref']} if 'setup_ref' in op else {})}, heartbeat)
        verify_receipt(reset, base)
        if reset.get('opportunity_id') != oid or reset.get('environment_id') != op['environment_id'] or reset.get('baseline_sha256') != binding['baseline_sha256'] or reset.get('restored') is not True:
            raise AdapterReceiptError('Per-opportunity reset attestation mismatch')
        result['reset_receipt'] = reset
        result['phase_timings_ms']['reset'] = (time.monotonic()-phase_start)*1000
        phase_start = time.monotonic()
        stage = 'actor'
        result['actor_started'] = True
        # Only the separate, outcome-free input is delivered to the framework.
        actor_command = dict(binding['commands']['actor'])
        if binding.get('timing_policy')!=POLICY:
            # Historical synthetic controls only, not new diagnostic admission.
            actor_command['timeout_ms']=min(actor_command['timeout_ms'],binding['budget']['task_timeout_ms'])
        actor_output = invoke(actor_command, {**base, 'input': actor_input,
                       'coordinate_space': binding.get('coordinate_space', 'css-pixels'),
                       'configuration_sha256': binding['configuration_sha256'],
                       'model_binding': binding.get('model_binding'), 'budget': binding['budget'],
                       'request_ledger': {'database': store.filename, 'opportunityId': oid, 'leaseToken': token,
                                          'capMicroUsd': binding.get('cost_policy',{}).get('cap_micro_usd')},
                       'cost_policy': binding.get('cost_policy')}, heartbeat)
        actor, actor_lifecycle_ref = unpack_actor_envelope(actor_output, base)
        if actor_lifecycle_ref is not None:
            result['actor_lifecycle_ref'] = actor_lifecycle_ref
        if actor.get('terminal_status') not in ('completed', 'failed', 'timeout', 'provider-error', 'no-verdict', 'execution-error'):
            raise AdapterReceiptError('Explicit actor terminal status required')
        if type(actor.get('budget_met')) is not bool or type(actor.get('action_count')) is not int or actor['action_count'] < 0:
            raise AdapterReceiptError('Explicit adapter budget accounting required')
        result['phase_timings_ms']['actor'] = (time.monotonic()-phase_start)*1000
        actor_elapsed=result['phase_timings_ms']['actor']
        if binding.get('timing_policy')==POLICY:
            if actor_lifecycle_ref is None:
                raise AdapterReceiptError('Current timing requires a sealed lifecycle, not a self-reported duration')
            from benchmark_actor_lifecycle import verify_lifecycle
            seal=verify_lifecycle(actor_lifecycle_ref,actor)
            if seal.get('lifecycle_limits')!=binding['lifecycle_limits']:
                raise AdapterReceiptError('Lifecycle limits differ from frozen binding')
            actor_elapsed=verify_timing(seal.get('lifecycle_timing'),actor,binding['lifecycle_limits'])
            phases=seal['lifecycle_timing']['phases']
            inner=sum(p['elapsed_ms'] for p in phases.values())
            if inner>result['phase_timings_ms']['actor']:
                raise AdapterReceiptError('Child lifecycle exceeds enclosing supervisor duration')
            if result['phase_timings_ms']['actor']-inner>binding['lifecycle_limits']['transport_ms']:
                raise AdapterReceiptError('Unaccounted transport exceeds frozen lifecycle allowance')
            result['timing_policy']=POLICY
            result['lifecycle_timing']=seal['lifecycle_timing']
            result['actor_elapsed_ms']=actor_elapsed
            result['actor_envelope_elapsed_ms']=result['phase_timings_ms']['actor']
        # Never let a later native success overwrite an actor timeout or budget violation.
        # The actor's receipt is necessary but not sufficient: supervisor wall time and
        # action count are checked too. Actual action-journal conformance is still a gate.
        result['actor_terminal_status'] = actor['terminal_status']
        result['actor_failure_class'] = actor.get('failure_class')
        result['action_count'] = actor['action_count']
        result['budget_met'] = (actor['budget_met'] and actor['terminal_status'] != 'timeout'
            and actor_elapsed <= binding['budget']['task_timeout_ms']
            and actor['action_count'] <= binding['budget']['max_actions'])
        result['protocol_completed'] = actor['terminal_status'] == 'completed' and result['budget_met']
        phase_start = time.monotonic()
        stage = 'evaluate'
        evaluated = invoke(binding['commands']['evaluate'], {**base, 'actor_result': actor,
                           'evaluation_ref': op['evaluation_ref'],
                           **({'actor_lifecycle_ref': actor_lifecycle_ref} if actor_lifecycle_ref else {})}, heartbeat)
        verify_receipt(evaluated, base)
        if evaluated.get('assessment_status') not in ('valid', 'unresolved'):
            raise AdapterReceiptError('Invalid evaluator assessment')
        score = evaluated.get('native_score')
        if 'native_score' not in evaluated or 'verdict' not in evaluated or (score is not None and (type(score) is not int or score not in (0, 1))) or evaluated.get('verdict') not in (None, 'PASS', 'FAIL'):
            raise AdapterReceiptError('Invalid native endpoint')
        if evaluated['assessment_status'] == 'unresolved' and (evaluated.get('native_score') is not None or evaluated.get('verdict') is not None):
            raise AdapterReceiptError('Unresolved evaluator cannot supply outcomes')
        verify_native_endpoint(op.get('benchmark'), evaluated)
        result.update({k: evaluated.get(k) for k in ('assessment_status', 'native_score', 'verdict')})
        if op.get('benchmark') == 'ata':
            for key in ('step_class','prediction_status','failure_step','verdict_correctness',
                        'confusion_class','step_assessment_status','strict_step_correctness',
                        'live_fixture_label_parity_verified'):
                result[key]=evaluated.get(key)
        result['terminal_status'] = ('evaluator-error' if evaluated['assessment_status'] != 'valid'
            else 'timeout' if actor['terminal_status'] == 'completed' and not result['budget_met']
            else actor['terminal_status'])
        # operational_correctness remains unset until benchmark/gold-specific import.
    except Exception as exc:
        result['terminal_status'] = {'reset': 'reset-error', 'actor': 'execution-error', 'evaluate': 'evaluator-error'}[stage]
        result['error_type'] = type(exc).__name__  # Never persist exception text or provider payloads.
        # Once reset/actor/evaluation has started, any exception can hide a
        # partial side effect. Do not release an environment merely because the
        # producer raised ValueError rather than a transport exception.
        uncertain = True
        if stage == 'actor' and isinstance(exc, TimeoutError):
            if binding.get('timing_policy')==POLICY:
                result['failure_class']='lifecycle-envelope-timeout'
                result['failure_attribution']='engineering-or-external-unresolved'
                # A killed setup/evaluator/finalizer proves no actor timeout.
                result['actor_terminal_status']=None
                result['budget_met']=None
            else:
                result['terminal_status'] = 'timeout'
                result['actor_terminal_status'] = 'timeout'
                result['budget_met'] = False
    finally:
        result['phase_timings_ms'][stage] = (time.monotonic()-phase_start)*1000
        cleanup_start = time.monotonic()
        try:
            cleanup = invoke(binding['commands']['cleanup'], base, heartbeat)
            verify_receipt(cleanup, base)
            if cleanup.get('cleaned') is not True:
                raise ValueError('Cleanup unconfirmed')
            result['cleanup_status'] = 'verified'
        except Exception:
            result['cleanup_status'] = 'unverified'
            uncertain = True
        result['phase_timings_ms']['cleanup'] = (time.monotonic()-cleanup_start)*1000
        result['phase_timings_ms']['total'] = (time.monotonic()-start)*1000
    # Lifecycle completion is receipt/cleanup completion, not capability success.
    # A provider error can complete a lifecycle but is not usable capability evidence.
    result['lifecycle_completed'] = (not uncertain and result['cleanup_status'] == 'verified'
        and result['actor_terminal_status'] is not None and stage == 'evaluate'
        and 'error_type' not in result)
    if uncertain:
        store.quarantine(oid, token, result)
    else:
        store.finish(oid, token, result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['enqueue', 'recover', 'status', 'work'])
    parser.add_argument('--database', required=True)
    parser.add_argument('--input')
    args = parser.parse_args()
    store = Store(args.database)
    try:
        if args.command == 'enqueue':
            with open(args.input) as f:
                store.enqueue(json.loads(line) for line in f if line.strip())
        elif args.command == 'recover':
            store.recover()
        elif args.command == 'work':
            with open(args.input) as f:
                execute_one(store, json.load(f))
        print(canonical(store.summary()))
    finally:
        store.close()


if __name__ == '__main__':
    main()
