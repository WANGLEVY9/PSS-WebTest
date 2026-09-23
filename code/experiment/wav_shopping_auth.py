"""Supervisor-only Shopping UI login, following pinned WAV example selectors.

Not automatically invoked or admitted. A caller supplies private pinned official
fixture credentials; no actor receives credentials or authentication evidence.
Live account parity must be verified before admitting account-dependent tasks.
"""
import re
import time
from pathlib import Path
from urllib.parse import urlsplit
from benchmark_actor_lifecycle import persist, encoded
from session_auth import private_json, authenticated_state, IDENTITY
from runtime_inputs import read_pinned


def authenticate_shopping(browser,op,reset,baseline,routes,credential_ref,directory,timeout_ms=60000):
    if op.get('scope')!='diagnostic' or reset.get('restored') is not True:
        raise ValueError('Measured diagnostic reset required before login')
    if any(not op.get(k) or reset.get(k)!=op[k] for k in IDENTITY):
        raise ValueError('Reset/account binding mismatch')
    if reset.get('baseline_sha256')!=baseline or reset.get('closure_sites')!=['shopping']:
        raise ValueError('Complete Shopping baseline required')
    read_pinned(reset['reset_evidence_ref']['file'],reset['reset_evidence_ref']['sha256'])
    if set(routes)!= {'__SHOPPING__'}:raise ValueError('Explicit single-site Shopping routes required')
    base=routes['__SHOPPING__'].rstrip('/');u=urlsplit(base)
    if u.scheme!='http' or u.hostname not in ('localhost','127.0.0.1') or u.username or u.password or u.path:
        raise ValueError('Owned loopback Shopping origin required')
    credentials=private_json(credential_ref)
    if set(credentials)!= {'username','password'} or any(not isinstance(v,str) or not v for v in credentials.values()):
        raise ValueError('Private explicit account credentials required')
    if type(timeout_ms) is not int or not 1000<=timeout_ms<=120000:raise ValueError('Bounded authentication timeout required')
    root=Path(directory).resolve();root.mkdir(mode=0o700,parents=True,exist_ok=False)
    context=browser.new_context(viewport={'width':1280,'height':720})
    try:
        context.route('**/*',lambda route:route.continue_() if route.request.url.startswith(base+'/') else route.abort())
        page=context.new_page();page.set_default_timeout(timeout_ms)
        page.goto(base+'/customer/account/login/',wait_until='domcontentloaded',timeout=timeout_ms)
        page.get_by_label('Email',exact=True).fill(credentials['username'])
        page.get_by_label('Password',exact=True).fill(credentials['password'])
        page.get_by_role('button',name='Sign In').click()
        page.wait_for_url(re.compile(re.escape(base)+r'/customer/account/?(?:\?.*)?$'),timeout=timeout_ms)
        # Unlike upstream's close-after-click example, require visible identity.
        page.locator('.box-information .box-content').filter(has_text=credentials['username']).wait_for(state='visible',timeout=timeout_ms)
        state_ref=persist(root/'storage-state.json',encoded(context.storage_state()))
        identity={k:op[k] for k in IDENTITY}
        health_ref=persist(root/'authenticated-health.json',encoded({**identity,
            'reset_evidence_ref':reset['reset_evidence_ref'],'authenticated':True,'sites':['shopping'],
            'checks':['account-dashboard-url','visible-account-email-matches-requested-account'],
            'source_selectors':'pinned WAV examples/agents/utils.py:_shopping_ui_login'}))
        now=time.time()
        proof_ref=persist(root/'authentication-proof.json',encoded({**identity,'schema':'pss-reset-auth-v1',
            'baseline_sha256':baseline,'reset_evidence_ref':reset['reset_evidence_ref'],'setup_ref':op['setup_ref'],
            'scope':'diagnostic','data_kind':'MEASURED','created_at_unix':now,'expires_at_unix':now+1800,
            'authenticated_sites':['shopping'],'authenticated_health_ref':health_ref,'storage_state_ref':state_ref}))
        authenticated_state(proof_ref,op,reset,baseline,routes)
        return proof_ref
    finally:context.close()
