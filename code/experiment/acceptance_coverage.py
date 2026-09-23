"""Task-level development coverage, separate from 12-cell fixture acceptance.

No success-rate cutoff. Missing, duplicated, cross-version or external-failure
receipts cannot become accepted capability evidence. File consistency is not
proof that a trusted producer is honest; independent review remains mandatory.
"""
import argparse
import json
import math
from pathlib import Path
from benchmark_acceptance import audit as audit_fixtures, BENCHMARKS, PROFILES
from runtime_inputs import read_pinned, task_projection
from runtime_store import digest
from prepare_official_runtime import save
from lifecycle_timing import POLICY,verify_timing

ARTIFACTS = ('reset', 'actor', 'native_evaluation', 'replay', 'cleanup', 'failure_review')
TERMINALS = ('completed','failed','timeout','no-verdict')
FRAMEWORK_SOURCES = ('native_framework_driver.py','framework_actions.py','framework_model.py','journaled_browser.py',
    'framework_agentlab.py','framework_browser_use.py','framework_boundary.py','benchmark_output_contract.py',
    'runtime_inputs.py','runtime_store.py','framework-provider-bridge.mjs','provider.mjs','runtime-env.mjs','lifecycle_timing.py')


def load_ref(ref):
    return json.loads(read_pinned(ref['file'],ref['sha256']))


def replay_contents(evidence, actor, binding):
    """Recompute integrity from pinned trajectory bytes, not a claimed pass bit."""
    from replay_audit import audit as audit_replay
    ref = evidence['trajectory_ref']
    raw = read_pinned(ref['file'], ref['sha256'])
    path = Path(ref['file']).resolve()
    if path != Path(actor['trajectory_directory']).resolve() / 'trajectory.jsonl':
        raise ValueError('Replay belongs to another actor directory')
    report = audit_replay(path.parent)
    if (evidence.get('schema') != 'pss-replay-evidence-v1'
        or not report['passed'] or evidence.get('integrity_audit') != report):
        raise ValueError('Replay summary differs from independently audited contents')
    rows = [json.loads(line) for line in raw.splitlines()]
    starts = [row for row in rows if row['kind'] == 'actor-start']
    ends = [row for row in rows if row['kind'] == 'actor-end']
    if len(starts) != 1 or len(ends) != 1 or ends[0]['receipt'] != actor:
        raise ValueError('Replay actor receipt mismatch')
    start = starts[0]
    for field in ('framework', 'budget', 'model_binding', 'mode'):
        if start.get(field) != binding.get(field):
            raise ValueError('Replay does not use frozen configuration')
    if report['actions'] != actor['action_count'] or report['observation_frames'] < 1:
        raise ValueError('Replay action/frame accounting mismatch')
    pending = None
    for row in rows:
        if row['kind'] == 'action-start':
            if pending is not None: raise ValueError('Overlapping replay actions')
            pending = row['action']
        elif row['kind'] == 'action-end':
            if pending is None or row['action'] != pending: raise ValueError('Replay action pairing mismatch')
            pending = None
    if pending is not None: raise ValueError('Incomplete replay action')
    snapshots = [row for row in rows if row['kind']=='source-snapshot']
    if actor.get('source_tree_unchanged') is not True or len(snapshots)!=1:
        raise ValueError('Source stability evidence required')
    if binding['framework']=='playwright':
        from traditional_actor import SOURCES
        script=binding['traditional_script_ref']
        sources=binding.get('actor_source_refs',{})
        if set(sources)!=set(SOURCES):raise ValueError('Full Traditional executor source set required')
        sources={**sources,Path(script['file']).name:script}
    else:
        sources=binding['actor_source_refs']
        if set(sources)!=set(FRAMEWORK_SOURCES):raise ValueError('Full frozen actor source set required')
    captured=snapshots[0].get('sources',{})
    if set(captured)!=set(sources):raise ValueError('Runtime source snapshot differs from frozen source set')
    for name,source in sources.items():
        # Frozen source references are independent of the producer's pass bit.
        read_pinned(source['file'],source['sha256'])
        if captured[name].get('sha256')!=source['sha256']:
            raise ValueError('Runtime source differs from frozen source bytes')
    return report


def valid_number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def audit(package):
    if package.get('schema') != 'pss-development-coverage-v1':
        raise ValueError('Development coverage package required')
    manifest = load_ref(package['manifest_ref'])
    if (manifest.get('schema') != 'pss-development-cohort-v1'
        or manifest.get('protocol_id') != 'pss-manuscript-v2.1'
        or manifest.get('scope') != 'diagnostic'
        or manifest.get('profiles') != list(PROFILES)):
        raise ValueError('Frozen active diagnostic cohort required')
    tasks = manifest['tasks']
    if (len({t['task_key'] for t in tasks}) != 60
        or any(sum(t['benchmark']==b for t in tasks)!=20 for b in BENCHMARKS)
        or any(sum(t['benchmark']==b and t['stability_repeat'] is True for t in tasks)!=5 for b in BENCHMARKS)):
        raise ValueError('Exactly 20 tasks and five stability tasks per benchmark required')
    for task in tasks:
        if task['binding_sha256'] != digest(task['binding']): raise ValueError('Task binding drift')
        binding = task['binding']
        read_pinned(binding['source_file'],binding['source_sha256'])
        if (task['task_key']!=binding['benchmark']+':'+binding['official_task_id']
            or any(task[k]!=binding[k] for k in ('benchmark','official_task_id','application'))):
            raise ValueError('Manifest task identity mismatch')
        task_projection(json.loads(read_pinned(binding['agent_input_file'],binding['agent_input_sha256'])),task['benchmark'])
        gold=load_ref(binding['evaluation_ref'])
        if any(gold[k]!=binding[k] for k in ('benchmark','official_task_id','source_sha256')):
            raise ValueError('Evaluator belongs to another task')
        if 'setup_ref' in binding: load_ref(binding['setup_ref'])
    host, candidate = package.get('host_id'), package.get('candidate_version')
    if not host or not candidate: raise ValueError('Actual host and sealed candidate version required')
    # Runtime configuration must be pinned independently of each run's claims.
    from runtime_worker import validate_commands
    runtime={};runtime_errors=[]
    framework_for={'agentlab-visual':'agentlab-browsergym','agentlab-hybrid':'agentlab-browsergym',
                   'browser-use-hybrid':'browser-use-restricted','playwright':'playwright'}
    for b in BENCHMARKS:
        for p in PROFILES:
            name=b+'/'+p
            try:
                binding=load_ref(package.get('runtime_binding_refs',{})[name])
                validate_commands(binding)
                if binding['framework']!=framework_for[p]:raise ValueError('Framework identity mismatch')
                if p=='playwright' and binding.get('model_binding') is not None:raise ValueError('Shared script has no model')
                if p!='playwright' and binding.get('mode')!=('visual' if p=='agentlab-visual' else 'hybrid'):
                    raise ValueError('Observation mode mismatch')
                runtime[name]=binding
            except (KeyError,TypeError,OSError,ValueError):runtime_errors.append(name+':missing-or-invalid-runtime-binding')
        group=[runtime.get(b+'/'+p) for p in PROFILES]
        if all(group):
            if len({digest(x['budget']) for x in group})!=1:runtime_errors.append(b+':unmatched-budgets')
            if len({digest({'policy':x.get('timing_policy'),'limits':x.get('lifecycle_limits')}) for x in group})!=1:
                runtime_errors.append(b+':unmatched-lifecycle-policy-or-limits')
            if len({digest(x['model_binding']) for x in group[:3]})!=1:runtime_errors.append(b+':unmatched-actor-models')
    expected = {(t['task_key'], p, repetition):t for t in tasks for p in PROFILES
                for repetition in (['A1','S1','S2'] if t['stability_repeat'] else ['A1'])}
    receipts, ids = {}, set()
    for ref in package.get('execution_receipts',[]):
        r = load_ref(ref)
        key = (r.get('task_key'),r.get('profile'),r.get('repetition'))
        if key not in expected or key in receipts or not r.get('opportunity_id') or r['opportunity_id'] in ids:
            raise ValueError('Unexpected/duplicate execution; never choose best-of attempts')
        receipts[key] = r; ids.add(r['opportunity_id'])
    rows = []
    for key,t in expected.items():
        r = receipts.get(key); errors = []
        if r is None: errors.append('not-executed')
        else:
            identity = {'campaign_id':manifest['campaign_id'], 'host_id':host,
                'candidate_version':candidate, 'protocol_id':manifest['protocol_id'],
                'manifest_sha256':package['manifest_ref']['sha256'],
                'task_binding_sha256':t['binding_sha256'], 'data_kind':'MEASURED', 'scope':'diagnostic'}
            if any(r.get(k)!=v for k,v in identity.items()): errors.append('identity-or-provenance-mismatch')
            binding=runtime.get(t['benchmark']+'/'+key[1])
            if (not binding or r.get('runtime_binding_sha256')!=digest(binding)
                or r.get('configuration_sha256')!=binding.get('configuration_sha256')
                or r.get('model_binding')!=binding.get('model_binding')
                or r.get('environment_id')!=binding.get('environment_id')):
                errors.append('unfrozen-runtime-configuration')
            artifacts={}
            artifact_names = ARTIFACTS + (() if key[1]=='playwright' else ('provider_accounting',))
            artifact_names += ('actor_lifecycle',)
            for name in artifact_names:
                ref = r.get('artifacts',{}).get(name)
                try: artifacts[name]=load_ref(ref)
                except (TypeError,KeyError,ValueError,OSError): errors.append(name+':missing-or-drifted')
            outcome = r.get('result',{})
            # Verify contents, not merely that an arbitrary file has a hash.
            execution_identity={k:r.get(k) for k in ('opportunity_id','environment_id','configuration_sha256')}
            if not all(execution_identity.values()):errors.append('execution-identity-incomplete')
            for name in artifact_names:
                evidence=artifacts.get(name,{})
                if any(evidence.get(k)!=v for k,v in execution_identity.items()):
                    errors.append(name+':execution-identity-mismatch')
                if evidence.get('scope')!='diagnostic' or evidence.get('data_kind')!='MEASURED':
                    errors.append(name+':non-measured-or-nondiagnostic-component')
            if artifacts.get('reset',{}).get('restored') is not True:errors.append('reset-unverified')
            if binding and artifacts.get('reset',{}).get('baseline_sha256')!=binding['baseline_sha256']:
                errors.append('reset-baseline-mismatch')
            if artifacts.get('cleanup',{}).get('cleaned') is not True:errors.append('cleanup-receipt-unverified')
            actor=artifacts.get('actor',{})
            if actor.get('terminal_status')!=outcome.get('actor_terminal_status'):
                errors.append('actor-terminal-summary-mismatch')
            if actor.get('terminal_status') not in TERMINALS:
                errors.append('actor-non-capability-terminal')
            count, elapsed = actor.get('action_count'), actor.get('elapsed_ms')
            supervisor_elapsed = outcome.get('phase_timings_ms',{}).get('actor')
            try:
                from benchmark_actor_lifecycle import verify_lifecycle
                lifecycle_ref=r['artifacts']['actor_lifecycle']
                lifecycle=verify_lifecycle(lifecycle_ref,actor)
                if (binding.get('timing_policy')!=POLICY or outcome.get('timing_policy')!=POLICY
                    or lifecycle.get('lifecycle_limits')!=binding.get('lifecycle_limits')
                    or outcome.get('lifecycle_timing')!=lifecycle.get('lifecycle_timing')):
                    raise ValueError('Lifecycle timing not frozen or summary mismatch')
                elapsed=verify_timing(lifecycle['lifecycle_timing'],actor,binding['lifecycle_limits'])
                inner=sum(p['elapsed_ms'] for p in lifecycle['lifecycle_timing']['phases'].values())
                if not valid_number(supervisor_elapsed) or inner>supervisor_elapsed:
                    raise ValueError('Lifecycle exceeds parent-process duration')
                if supervisor_elapsed>binding['commands']['actor']['timeout_ms']:
                    raise ValueError('Parent process exceeded frozen lifecycle envelope')
                if supervisor_elapsed-inner>binding['lifecycle_limits']['transport_ms']:
                    raise ValueError('Unaccounted parent/child transport exceeds frozen allowance')
                if outcome.get('actor_elapsed_ms')!=elapsed:
                    raise ValueError('Actor elapsed summary differs')
            except (ValueError,TypeError,KeyError,OSError,AttributeError):
                errors.append('lifecycle-timing-unverified')
            accounting_valid = (type(count) is int and count >= 0
                and type(actor.get('budget_met')) is bool and valid_number(elapsed)
                and valid_number(supervisor_elapsed) and bool(binding))
            if not accounting_valid:
                errors.append('actor-budget-accounting-incomplete')
            else:
                budget_met = (actor['budget_met'] and actor['terminal_status']!='timeout'
                    and elapsed <= binding['budget']['task_timeout_ms']
                    and count <= binding['budget']['max_actions'])
                terminal = ('timeout' if actor['terminal_status']=='completed' and not budget_met
                            else actor['terminal_status'])
                if (outcome.get('action_count')!=count or type(outcome.get('action_count')) is not int
                    or outcome.get('budget_met') is not budget_met
                    or outcome.get('terminal_status')!=terminal
                    or outcome.get('protocol_completed') is not (actor['terminal_status']=='completed' and budget_met)):
                    errors.append('actor-budget-or-terminal-summary-mismatch')
                if count > binding['budget']['max_actions']:
                    errors.append('executed-beyond-frozen-action-budget')
            native=artifacts.get('native_evaluation',{})
            task_binding=t['binding']
            if any(native.get(k)!=task_binding[k] for k in
                   ('benchmark','official_task_id','source_sha256','evaluation_ref')):
                errors.append('native-official-task-binding-mismatch')
            if any(native.get(k)!=outcome.get(k) for k in ('assessment_status','native_score','verdict','step_class')):
                errors.append('native-endpoint-summary-mismatch')
            review=artifacts.get('failure_review',{})
            if (review.get('failure_attribution')!=r.get('failure_attribution')
                or not review.get('reviewer') or not review.get('rationale') or not review.get('evidence_refs')):
                errors.append('failure-review-incomplete')
            for ref in review.get('evidence_refs',[]):
                try:read_pinned(ref['file'],ref['sha256'])
                except (TypeError,KeyError,ValueError,OSError):errors.append('failure-review-evidence-drift')
            replay = None
            try: replay = replay_contents(artifacts.get('replay',{}),actor,binding)
            except (ValueError,TypeError,KeyError,OSError,AttributeError):errors.append('replay-contents-unverified')
            if t['benchmark']=='wav':
                try:
                    from benchmark_actor_lifecycle import verify_lifecycle
                    lifecycle_ref=r['artifacts']['actor_lifecycle']
                    seal=verify_lifecycle(lifecycle_ref,actor)
                    if (native.get('actor_lifecycle_ref')!=lifecycle_ref
                        or seal['trajectory_ref']['sha256']!=artifacts['replay']['trajectory_ref']['sha256']
                        or Path(seal['trajectory_ref']['file']).resolve()!=Path(artifacts['replay']['trajectory_ref']['file']).resolve()
                        or native.get('source_network_trace_sha256')!=seal['network_trace_ref']['sha256']
                        or native.get('network_trace_ref',{}).get('sha256')!=seal['network_trace_ref']['sha256']):
                        raise ValueError('Evaluator used another actor lifecycle or HAR')
                    read_pinned(native['network_trace_ref']['file'],native['network_trace_ref']['sha256'])
                except (ValueError,TypeError,KeyError,OSError,AttributeError):errors.append('wav-actor-lifecycle-unverified')
            if t['benchmark']=='vwa':
                try:
                    from benchmark_actor_lifecycle import verify_lifecycle
                    lifecycle_ref=r['artifacts']['actor_lifecycle']
                    seal=verify_lifecycle(lifecycle_ref,actor)
                    preclose=load_ref(seal['preclose_evaluation_ref'])
                    if (native.get('actor_lifecycle_ref')!=lifecycle_ref
                        or native.get('preclose_evaluation_ref')!=seal['preclose_evaluation_ref']
                        or any(native.get(k)!=v for k,v in preclose.items())
                        or preclose.get('schema')!='pss-vwa-native-evaluator-v1'
                        or preclose.get('evaluated_after_actor_end_before_context_close') is not True
                        or preclose.get('actor_journal_unchanged') is not True):
                        raise ValueError('Native result is not the sealed pre-close evaluation')
                    for k in ('native_result_ref','native_config_ref','native_log_ref','actor_answer_ref','pre_evaluation_page_ref'):
                        read_pinned(preclose[k]['file'],preclose[k]['sha256'])
                except (ValueError,TypeError,KeyError,OSError,AttributeError):errors.append('vwa-preclose-native-evaluation-unverified')
            if t['benchmark']=='ata':
                # Reference-label scoring is useful engineering evidence, but
                # cannot prove that a live fixture still contains the defect.
                if native.get('live_fixture_label_parity_verified') is not True:
                    errors.append('ata-live-fixture-label-parity-unverified')
                for k in ('prediction_status','failure_step','verdict_correctness','confusion_class',
                          'step_assessment_status','strict_step_correctness'):
                    if k not in native or native.get(k)!=outcome.get(k):
                        errors.append('ata-prediction-correctness-summary-mismatch')
                try:
                    if native.get('actor_lifecycle_ref')!=r['artifacts']['actor_lifecycle']:
                        raise ValueError('ATA score consumed another actor lifecycle')
                    for k in ('native_result_ref','actor_answer_ref','evaluator_manifest_ref'):
                        read_pinned(native[k]['file'],native[k]['sha256'])
                    # Live parity must have a concrete artifact, not just a bool.
                    parity=load_ref(native['live_fixture_label_parity_ref'])
                    if (parity.get('schema')!='pss-ata-live-label-parity-v1'
                        or parity.get('evaluation_ref')!=task_binding['evaluation_ref']
                        or parity.get('baseline_sha256')!=binding['baseline_sha256']
                        or parity.get('data_kind')!='MEASURED' or not parity.get('evidence_refs')
                        or parity.get('label_parity_verified') is not True):
                        raise ValueError('Unverified live ATA label parity')
                    for ref in parity['evidence_refs']:read_pinned(ref['file'],ref['sha256'])
                except (ValueError,TypeError,KeyError,OSError,AttributeError):errors.append('ata-reference-or-live-parity-evidence-unverified')
            if key[1]!='playwright':
                accounting=artifacts.get('provider_accounting',{})
                if (accounting.get('opportunity_id')!=r['opportunity_id'] or accounting.get('all_requests_settled') is not True
                    or type(accounting.get('requests')) is not int or accounting['requests']<1
                    or not binding or accounting.get('model_binding')!=binding.get('model_binding')
                    or replay is None or accounting.get('requests')!=replay['provider_attempts']
                    or actor.get('provider_requests')!=accounting.get('requests')):
                    errors.append('provider-accounting-incomplete')
            if outcome.get('lifecycle_completed') is not True: errors.append('lifecycle-incomplete')
            if outcome.get('assessment_status') != 'valid': errors.append('native-assessment-unresolved')
            if outcome.get('terminal_status') not in TERMINALS: errors.append('non-capability-terminal')
            if outcome.get('cleanup_status') != 'verified': errors.append('cleanup-unverified')
            if r.get('failure_attribution') in ('engineering','external'):
                errors.append('engineering-or-external-blocker')
            if r.get('failure_attribution') not in ('none','capability','budget','unknown','engineering','external'):
                errors.append('missing-failure-review')
            from runtime_worker import verify_native_endpoint
            try: verify_native_endpoint(t['benchmark'],outcome)
            except ValueError: errors.append('invalid-native-endpoint')
        rows.append({'task_key':key[0], 'profile':key[1], 'repetition':key[2],
            'stage':t['stage'], 'evidence_ready':not errors, 'errors':sorted(set(errors))})
    fixture = None
    if package.get('fixture_package_ref'):
        fixture_package = load_ref(package['fixture_package_ref'])
        if any(fixture_package.get(k)!=v for k,v in {'host_id':host,'campaign_id':manifest['campaign_id']}.items()):
            raise ValueError('Fixture acceptance belongs to a different host or campaign')
        fixture = audit_fixtures(fixture_package)
    ready = sum(r['evidence_ready'] for r in rows)
    by_benchmark={b:{'required':sum(r['task_key'].startswith(b+':') for r in rows),
        'evidence_ready':sum(r['task_key'].startswith(b+':') and r['evidence_ready'] for r in rows)} for b in BENCHMARKS}
    return {'kind':'DEVELOPMENT_TASK_COVERAGE_AUDIT', 'campaign_id':manifest['campaign_id'],
        'host_id':host, 'candidate_version':candidate, 'required_executions':len(expected),
        'received_executions':len(receipts), 'evidence_ready_executions':ready, 'rows':rows,
        'by_benchmark':by_benchmark,
        'fixture_ready_cells':fixture['ready_cells'] if fixture else 0,
        'runtime_binding_errors':runtime_errors,
        'delivery_evidence_ready':ready==360 and fixture is not None and fixture['ready_cells']==12 and not runtime_errors,
        'confirmatory_authorized':False, 'model_requests':0, 'benchmark_executions':0,
        'limitation':'Structural audit only; not independent validation of evidence contents or sponsor-host acceptance. Unknown attribution never proves incapability.'}


if __name__ == '__main__':
    p=argparse.ArgumentParser();group=p.add_mutually_exclusive_group(required=True)
    group.add_argument('--package');group.add_argument('--manifest')
    p.add_argument('--host-id');p.add_argument('--candidate-version');p.add_argument('--output',required=True)
    a=p.parse_args()
    if a.manifest:
        import hashlib
        if not a.host_id or not a.candidate_version:p.error('--manifest needs --host-id and --candidate-version')
        file=Path(a.manifest).resolve()
        package={'schema':'pss-development-coverage-v1','manifest_ref':{'file':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()},
            'host_id':a.host_id,'candidate_version':a.candidate_version,'execution_receipts':[]}
    else:package=json.loads(Path(a.package).read_text())
    result=audit(package); save(Path(a.output),result)
    print(json.dumps({k:v for k,v in result.items() if k!='rows'}))
    raise SystemExit(0 if result['delivery_evidence_ready'] else 2)
