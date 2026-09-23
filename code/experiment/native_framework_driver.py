"""Executable real-framework decision/action loop for benchmark-owned contexts.

Not an alternative benchmark environment: trusted benchmark adapters own all
initial URLs, login, reset, task binding and native evaluation. No evaluator is
loaded by this actor. run_actor is also exercised by a clearly synthetic live
connectivity fixture before any admitted official benchmark runs.
"""
import asyncio
import io
import importlib.metadata
import os
from pathlib import Path
import time
from runtime_identity import receipt_binding
from concurrent.futures import ThreadPoolExecutor
from framework_actions import agentlab_action, browser_use_action, to_css, coordinate_contract
from framework_model import LedgerModel, ProviderFailure, ModelOutputValidationError, agentlab_args, browser_use_model
from journaled_browser import JournaledBrowser, sha
from runtime_store import Store
from lifecycle_timing import POLICY, window


class InvalidModelAction(Exception):
    """The model response cannot be mapped to the frozen action contract."""


def run_actor(context, page, payload, journal, framework, mode, node,
              viewport=(1280, 720), backend=None, terminal_page_sink=None,
              defer_trace_finalization=False):
    if payload.get('scope') not in ('synthetic', 'diagnostic'):
        raise ValueError('Explicit diagnostic or synthetic scope required; formal admission is separate')
    if framework not in ('agentlab-browsergym', 'browser-use-restricted') or mode not in ('visual', 'hybrid'):
        raise ValueError('Unknown framework or mode')
    if framework == 'browser-use-restricted' and mode != 'hybrid':
        raise ValueError('Browser Use belongs to the restricted hybrid configuration')
    budget, task = payload['budget'], payload['input']
    coordinate_space=coordinate_contract(payload.get('coordinate_space','css-pixels'))
    if any(type(budget.get(k)) is not int or budget[k] <= 0 for k in ('task_timeout_ms', 'max_actions')):
        raise ValueError('Frozen positive task budgets required')
    started_ns = time.monotonic_ns()
    started = started_ns / 1_000_000_000
    deadline = started + budget['task_timeout_ms']/1000
    actuator = JournaledBrowser(context, page, journal, viewport, task,
        action_timeout_ms=payload.get('action_timeout_ms',5000),
        observation_timeout_ms=payload.get('observation_timeout_ms',5000),
        screenshot_stall_feedback=payload.get('screenshot_stall_feedback',False))
    actuator.deadline = deadline
    request_timeout_ms = payload.get('provider_request_timeout_ms', 30000)
    if type(request_timeout_ms) is not int or not 1000 <= request_timeout_ms <= 45000:
        raise ValueError('Provider request timeout must be an integer within 1–45 seconds')
    backend = backend or LedgerModel(payload, journal, node, deadline,
                                     request_timeout_ms=request_timeout_ms)
    sources={}
    for name in ('native_framework_driver.py','framework_actions.py','framework_model.py','journaled_browser.py',
                 'framework_agentlab.py','framework_browser_use.py','framework_boundary.py','benchmark_output_contract.py','runtime_inputs.py',
                 'runtime_store.py','runtime_identity.py','spend-guard.mjs','spend_guard.py','framework-provider-bridge.mjs','provider.mjs','runtime-env.mjs','lifecycle_timing.py'):
        raw=Path(__file__).with_name(name).read_bytes()
        sources[name]=journal.artifact('source-'+name+'.txt',raw)
    versions={name:importlib.metadata.version(name) for name in
              (('agentlab','browsergym-core','playwright') if framework=='agentlab-browsergym' else ('browser-use','playwright'))}
    journal.event('source-snapshot',sources=sources,installed_versions=versions)
    if framework == 'agentlab-browsergym':
        import numpy as np
        from PIL import Image
        from framework_agentlab import make_agent, get_action
        agent = make_agent(agentlab_args(backend), mode, coordinate_space)
        decision_pool=None
    else:
        # The benchmark's only authorized model destination is its bound
        # provider. Disable unrelated vendor telemetry/cloud synchronization
        # before importing Browser Use (not just in offline test commands).
        os.environ.update(ANONYMIZED_TELEMETRY='false',BROWSER_USE_CLOUD_SYNC='false',
                          BROWSER_USE_VERSION_CHECK='false',BROWSER_USE_LOGGING_LEVEL='warning')
        from browser_use import Browser
        from browser_use.config import CONFIG
        if CONFIG.ANONYMIZED_TELEMETRY or CONFIG.BROWSER_USE_CLOUD_SYNC:
            raise ValueError('Unrelated cloud telemetry/synchronization must be disabled')
        from framework_browser_use import make_agent, get_action
        # Browser Use's Browser object supplies native agent schemas only; it
        # never launches or owns the benchmark browser or its observation loop.
        decision_pool=ThreadPoolExecutor(max_workers=1)
        agent_holder=[]
        def decide(raw, index, accepted):
            async def one():
                if not agent_holder:
                    browser=Browser(headless=True,enable_default_extensions=False)
                    agent_holder.append(make_agent(browser_use_model(backend),browser,task['intent'],journal.directory/'framework-private'))
                return await get_action(agent_holder[0],raw,task,index,viewport,accepted,coordinate_space)
            return asyncio.run(one())
    actions, accepted, final_answer = [], [], None
    terminal, failure = 'failed', 'action-budget-exhausted'
    context.tracing.start(screenshots=True, snapshots=True, sources=False)
    journal.event('actor-start', framework=framework, mode=mode, budget=budget,
                  model_binding=payload['model_binding'], coordinate_space=coordinate_space,
                  observation_timeout_ms=actuator.observation_timeout,
                  screenshot_stall_feedback=actuator.screenshot_stall_feedback,
                  confirmatory_authorized=False)
    try:
        for index in range(budget['max_actions']):
            ledger = payload['request_ledger']
            store = Store(ledger['database'])
            try: store.heartbeat(ledger['opportunityId'], ledger['leaseToken'])
            finally: store.close()
            raw = actuator.observe(mode)
            if framework == 'agentlab-browsergym':
                raw['screenshot'] = np.asarray(Image.open(io.BytesIO(raw['screenshot'])).convert('RGB'))
                output, _ = get_action(agent, raw, mode, task, index, viewport, coordinate_space)
                if output is None:
                    raise InvalidModelAction('agentlab-parser-rejected')
                try:
                    parsed = agentlab_action(output, [1000,1000] if coordinate_space=='qwen-0-999' else viewport, actuator.assets)
                    action = to_css(parsed,viewport,coordinate_space)
                except (SyntaxError, ValueError, TypeError) as exc:
                    raise InvalidModelAction('agentlab-action-contract') from exc
            else:
                output, _ = decision_pool.submit(decide,raw,index,list(accepted)).result(timeout=max(1,deadline-time.monotonic()+3))
                try:
                    parsed = browser_use_action(output,[1000,1000] if coordinate_space=='qwen-0-999' else viewport,actuator.assets)
                    action = browser_use_action(output,viewport,actuator.assets) if 'pss_scroll' in output else to_css(parsed,viewport,coordinate_space)
                except (SyntaxError, ValueError, TypeError) as exc:
                    raise InvalidModelAction('browser-use-action-contract') from exc
            journal.event('decoded-action', framework_action=output, css_action=action, coordinate_space=coordinate_space)
            # A provider response is not authorization to act with an expired
            # lease. Fence immediately before every SUT mutation, not only request.
            store = Store(ledger['database'])
            try: store.heartbeat(ledger['opportunityId'], ledger['leaseToken'])
            finally: store.close()
            actuator.execute(action)
            actions.append(action)
            if framework == 'browser-use-restricted': accepted.append(output)
            if action['name'] == 'done':
                terminal, failure, final_answer = 'completed', None, action['text']
                break
        # Capture final action's visible result even when the model stops. No
        # extra model request or evaluator feedback is made from this frame.
        actuator.observe(mode)
    except TimeoutError:
        terminal, failure = 'timeout', 'task-timeout'
    except ProviderFailure as exc:
        terminal, failure = 'provider-error', str(exc)
    except ModelOutputValidationError:
        terminal, failure = 'invalid-action', 'invalid-model-action'
        journal.event('actor-invalid-action', reason='framework-schema-validation')
    except InvalidModelAction as exc:
        terminal, failure = 'invalid-action', 'invalid-model-action'
        journal.event('actor-invalid-action', reason=str(exc))
    except Exception as exc:
        terminal, failure = 'execution-error', type(exc).__name__
        journal.event('actor-exception', error_type=type(exc).__name__)
    finally:
        if decision_pool:decision_pool.shutdown(wait=True,cancel_futures=True)
    ended_ns = time.monotonic_ns()
    elapsed = (ended_ns-started_ns)/1_000_000
    receipt = {k:payload[k] for k in ('opportunity_id', 'environment_id', 'configuration_sha256')}
    receipt.update(receipt_binding(payload))
    receipt.update(terminal_status=terminal, failure_class=failure, action_count=len(actions),
                   scope=payload['scope'], data_kind='MEASURED' if payload['scope']=='diagnostic' else 'SYNTHETIC_TEST',
                   provider_requests=backend.requests, final_answer=final_answer,
                   budget_met=terminal!='timeout' and elapsed<=budget['task_timeout_ms'],
                   elapsed_ms=elapsed, framework=framework, mode=mode,
                   timing_policy=POLICY, actor_timing=window(started_ns,ended_ns),
                   trajectory_directory=str(journal.directory), confirmatory_authorized=False,
                   source_tree_unchanged=all(sha(Path(__file__).with_name(n).read_bytes())==r['sha256'] for n,r in sources.items()),
                   installed_versions=versions)
    journal.event('actor-end', receipt=receipt)
    # Trusted supervisor plumbing only: no inspected URL/DOM/evaluator feedback
    # reaches the actor. The selected page can differ from initial or last tab.
    if terminal_page_sink is not None:terminal_page_sink(actuator.page)
    if not defer_trace_finalization:
        context.tracing.stop(path=str(journal.directory/'trace.zip'))
    return receipt
