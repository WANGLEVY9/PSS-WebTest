"""Reviewed Playwright script executor using the common lifecycle and journal.

Scripts implement run(session, public_task) -> str. This Python façade is NOT
an OS sandbox: outcome-blind source review and a pinned source file are required.
No hidden task/evaluator/reset/auth material is passed to run(). Unsupported
operations fail explicitly rather than silently escaping replay instrumentation.
"""
import copy
import importlib.metadata
import time
from pathlib import Path
from journaled_browser import JournaledBrowser, sha
from runtime_inputs import read_pinned
from runtime_store import Store
from lifecycle_timing import POLICY, window

SOURCES = ('traditional_actor.py', 'journaled_browser.py', 'framework_actions.py',
           'runtime_inputs.py', 'runtime_store.py', 'lifecycle_timing.py')


class ActionBudgetExceeded(Exception):
    pass


class Locator:
    def __init__(self, session, locator, description):
        self._session, self._locator, self._description = session, locator, description

    def nth(self, index):
        if type(index) is not int or index < 0:
            raise ValueError('Nonnegative locator index required')
        return Locator(self._session, self._locator.nth(index), self._description+[['nth', index]])

    def locator(self, selector):
        return Locator(self._session, self._locator.locator(selector), self._description+[['locator', selector]])

    def _call(self, name, *args, **kwargs):
        mutations = {'click', 'dblclick', 'hover', 'fill', 'press', 'check', 'uncheck', 'select_option'}
        reads = {'inner_text', 'text_content', 'all_text_contents', 'count', 'is_visible',
                 'input_value', 'get_attribute', 'is_checked'}
        if name not in mutations | reads:
            raise ValueError('Unsupported instrumented locator method')
        if 'timeout' in kwargs or 'force' in kwargs:
            raise ValueError('Script cannot override frozen timeout/actionability')
        # count/is_visible/all_text_contents do not wait and have no timeout arg.
        bounded = name not in {'count', 'is_visible', 'all_text_contents'}
        action = {'name': 'locator.'+name, 'locator': self._description,
                  'args': list(args), 'kwargs': kwargs}
        return self._session.perform(action, lambda: getattr(self._locator, name)(
            *args, **kwargs, **({'timeout': self._session._actuator.remaining_ms()} if bounded else {})),
            mutation=name in mutations)

    def click(self, **kw): return self._call('click', **kw)
    def dblclick(self, **kw): return self._call('dblclick', **kw)
    def hover(self): return self._call('hover')
    def fill(self, text): return self._call('fill', text)
    def press(self, key): return self._call('press', key)
    def check(self): return self._call('check')
    def uncheck(self): return self._call('uncheck')
    def select_option(self, value): return self._call('select_option', value)
    def inner_text(self): return self._call('inner_text')
    def text_content(self): return self._call('text_content')
    def all_text_contents(self): return self._call('all_text_contents')
    def count(self): return self._call('count')
    def is_visible(self): return self._call('is_visible')
    def input_value(self): return self._call('input_value')
    def get_attribute(self, name): return self._call('get_attribute', name)
    def is_checked(self): return self._call('is_checked')

    def upload(self, asset_id):
        session = self._session
        if asset_id not in session._actuator.assets:
            raise ValueError('Only pinned public task assets may be uploaded')
        return session.perform({'name':'locator.upload','locator':self._description,'asset_id':asset_id},
            lambda: self._locator.set_input_files(session._actuator.assets[asset_id],
                timeout=session._actuator.remaining_ms()))


class Session:
    def __init__(self, actuator, payload):
        self._actuator, self._payload = actuator, payload
        self.actions = self.reads = 0

    def fence(self):
        if time.monotonic() >= self._actuator.deadline:
            raise TimeoutError('Task deadline')
        ledger = self._payload['request_ledger']
        store = Store(ledger['database'])
        try: store.heartbeat(ledger['opportunityId'], ledger['leaseToken'])
        finally: store.close()

    def frame(self):
        self.fence()
        self._actuator.observe('visual')  # Replay-only; script uses locators.

    def perform(self, action, fn, mutation=True):
        self.fence()
        if mutation and self.actions >= self._payload['budget']['max_actions']:
            raise ActionBudgetExceeded()
        self.frame()
        self.fence()  # Screenshot time cannot authorize an expired lease.
        kind = 'action' if mutation else 'script-read'
        self.actions += int(mutation)
        self.reads += int(not mutation)
        self._actuator.journal.event(kind+'-start', action=action)
        started = time.monotonic_ns()
        error = None
        try:
            return fn()
        except Exception as exc:
            error = type(exc).__name__
            raise
        finally:
            self._actuator.journal.event(kind+'-end', action=action, error_type=error,
                elapsed_ms=(time.monotonic_ns()-started)/1_000_000)
            if error is None:
                self.frame()

    def locator(self, selector):
        return Locator(self, self._actuator.page.locator(selector), [['locator', selector]])

    def get_by_role(self, role, **kwargs):
        return Locator(self, self._actuator.page.get_by_role(role, **kwargs), [['role', role, kwargs]])

    def get_by_label(self, text, **kwargs):
        return Locator(self, self._actuator.page.get_by_label(text, **kwargs), [['label', text, kwargs]])

    def focus_tab(self, index):
        if type(index) is not int or not 0 <= index < len(self._actuator.pages):
            raise ValueError('Known tab ordinal required')
        page = self._actuator.pages[index]
        if page.is_closed(): raise ValueError('Tab already closed')
        def focus():
            page.bring_to_front()
            self._actuator.page = page
        return self.perform({'name':'tab_focus','index':index}, focus)


def run_actor(context, page, payload, journal, framework, mode, node,
              viewport=(1280,720), terminal_page_sink=None,
              defer_trace_finalization=False, *, script_ref):
    if (framework != 'playwright' or mode != 'traditional'
        or payload.get('scope') not in ('synthetic','diagnostic') or payload.get('model_binding') is not None):
        raise ValueError('Explicit no-model Traditional diagnostic configuration required')
    budget = payload['budget']
    if any(type(budget.get(k)) is not int or budget[k] <= 0 for k in ('task_timeout_ms','max_actions')):
        raise ValueError('Positive frozen task budgets required')
    started = time.monotonic_ns()
    script = read_pinned(script_ref['file'], script_ref['sha256'])
    name = Path(script_ref['file']).name
    if name in SOURCES: raise ValueError('Reserved script filename')
    sources = {n:journal.artifact('source-'+n+'.txt',Path(__file__).with_name(n).read_bytes()) for n in SOURCES}
    sources[name] = journal.artifact('source-'+name+'.txt',script)
    versions = {'playwright':importlib.metadata.version('playwright')}
    journal.event('source-snapshot', sources=sources, installed_versions=versions)
    journal.event('actor-start', framework=framework, mode=mode, budget=budget,
                  model_binding=None, confirmatory_authorized=False)
    actuator = JournaledBrowser(context,page,journal,viewport,payload['input'],settle_ms=0,
        action_timeout_ms=payload.get('action_timeout_ms',5000),
        observation_timeout_ms=payload.get('observation_timeout_ms',5000))
    actuator.deadline = started/1e9 + budget['task_timeout_ms']/1000
    session = Session(actuator,payload)
    terminal, failure, answer = 'completed', None, None
    context.tracing.start(screenshots=True,snapshots=True,sources=False)
    try:
        session.frame()
        namespace = {'__name__':'pss_reviewed_traditional_script','__file__':script_ref['file']}
        exec(compile(script,script_ref['file'],'exec'),namespace)
        answer = namespace['run'](session,copy.deepcopy(payload['input']))
        if not isinstance(answer,str): raise ValueError('Script must return original textual answer')
        session.perform({'name':'done','text':answer},lambda:None)
    except ActionBudgetExceeded:
        terminal, failure, answer = 'failed','action-budget-exhausted',None
    except TimeoutError:
        terminal, failure, answer = 'timeout','task-timeout',None
    except Exception as exc:
        terminal, failure, answer = 'execution-error',type(exc).__name__,None
        journal.event('actor-exception',error_type=type(exc).__name__)
    ended = time.monotonic_ns()
    elapsed = (ended-started)/1e6
    receipt = {k:payload[k] for k in ('opportunity_id','environment_id','configuration_sha256','scope','data_kind')}
    unchanged = all(sha(Path(__file__).with_name(n).read_bytes())==sources[n]['sha256'] for n in SOURCES)
    unchanged = unchanged and sha(Path(script_ref['file']).read_bytes())==script_ref['sha256']
    receipt.update(framework=framework, mode=mode, terminal_status=terminal, failure_class=failure,
        final_answer=answer, action_count=session.actions, script_reads=session.reads, provider_requests=0,
        budget_met=terminal!='timeout' and elapsed<=budget['task_timeout_ms'], elapsed_ms=elapsed,
        timing_policy=POLICY, actor_timing=window(started,ended), installed_versions=versions,
        trajectory_directory=str(journal.directory), source_tree_unchanged=unchanged, confirmatory_authorized=False)
    journal.event('actor-end',receipt=receipt)
    if terminal_page_sink is not None: terminal_page_sink(actuator.page)
    if not defer_trace_finalization: context.tracing.stop(path=str(journal.directory/'trace.zip'))
    return receipt
