"""Trusted native-session initialization from frozen public setup and reset proof.

No reset simulation. Caller owns/reset-checks the full official fixture closure,
then supplies its receipt. This creates a NEW context, preserves start-page order
and fails closed on unresolved routes/authentication. Setup never enters prompts.
It is a reusable integration API, not evidence that any benchmark is admitted.
"""
import json
import re
from urllib.parse import urlparse
from runtime_inputs import read_pinned, verify_bound_input, materialize_actor_input
from runtime_store import digest


def resolve_setup(op, reset, baseline_sha256, routes, storage_state_ref=None):
    if op.get('scope') not in ('synthetic','diagnostic'):
        raise ValueError('Formal native sessions require separate campaign admission')
    if not re.fullmatch('[a-f0-9]{64}',baseline_sha256 or ''):
        raise ValueError('Pinned baseline SHA256 required')
    verify_bound_input(op)
    ref=op.get('setup_ref')
    if not ref:raise ValueError('Native task requires a pinned official environment setup')
    if digest(ref)!=op.get('setup_binding_sha256'):raise ValueError('Setup binding drift')
    setup=json.loads(read_pinned(ref['file'],ref['sha256']))
    for field in ('opportunity_id','environment_id','configuration_sha256'):
        if reset.get(field)!=op.get(field):raise ValueError('Reset belongs to another execution')
    if reset.get('restored') is not True or reset.get('baseline_sha256')!=baseline_sha256:
        raise ValueError('No full per-opportunity baseline restoration')
    sites=setup['sites']
    if set(reset.get('closure_sites',[]))!=set(sites):
        raise ValueError('Reset does not cover the full official task site dependency closure')
    if not reset.get('reset_evidence_ref'):
        raise ValueError('Reset evidence file required, not only self-declared success')
    read_pinned(reset['reset_evidence_ref']['file'],reset['reset_evidence_ref']['sha256'])
    resolved=[]
    for initial in setup['start_urls']:
        def substitute(match):
            token=match[0]
            if token not in routes:raise ValueError('Unconfigured official site')
            return routes[token].rstrip('/')
        url=re.sub(r'__[A-Z_]+__',substitute,initial)
        parsed=urlparse(url)
        origins={urlparse(u).netloc for u in routes.values()}
        if parsed.scheme not in ('http','https') or parsed.username or parsed.password or parsed.netloc not in origins:
            raise ValueError('Start URL is not an explicitly deployed site')
        resolved.append(url)
    state=None
    if setup.get('require_login') and storage_state_ref is None:
        raise ValueError('Official task requires explicit reset-scoped authentication')
    if storage_state_ref is not None:
        state=json.loads(read_pinned(storage_state_ref['file'],storage_state_ref['sha256']))
        if storage_state_ref.get('opportunity_id')!=op['opportunity_id']:
            raise ValueError('Authentication state reused across executions')
    return {'start_urls':resolved,'geolocation':setup.get('geolocation'),'storage_state':state}


def create_context(browser, op, reset, baseline_sha256, routes, journal_directory,
                   viewport, locale, timezone_id, storage_state_ref=None):
    setup=resolve_setup(op,reset,baseline_sha256,routes,storage_state_ref)
    kwargs={'viewport':{'width':viewport[0],'height':viewport[1]},'device_scale_factor':1,
            'locale':locale,'timezone_id':timezone_id,'record_har_path':str(journal_directory/'network.har'),
            'record_har_content':'embed'}
    if setup['storage_state'] is not None:kwargs['storage_state']=setup['storage_state']
    if setup['geolocation'] is not None:kwargs.update(geolocation=setup['geolocation'],permissions=['geolocation'])
    context=browser.new_context(**kwargs)
    try:
        # URLs are initialization only; no page URL/title based agent progress.
        pages=[]
        for url in setup['start_urls']:
            page=context.new_page();page.goto(url,wait_until='domcontentloaded',timeout=30000);pages.append(page)
        # Pinned VWA ScriptBrowserEnv explicitly restores the FIRST start page
        # after opening the ordered tab list (browser_env/envs.py:195-208).
        page=pages[0];page.bring_to_front()
        return context,page,materialize_actor_input(op['agent_input'])
    except BaseException:
        context.close();raise
