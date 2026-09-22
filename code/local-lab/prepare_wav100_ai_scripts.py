"""Public-input-only AI-assisted diagnostic script preparation, never admission.

No provider calls and no evaluator/trajectory reads. Script proposals use the
existing instrumented Traditional facade, not direct page/HTTP/DB access.
Static validation is not live validation or a security sandbox. Exposed prior
tasks remain explicitly exposed; this is not an independently human-blind arm.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path
from prepare_official_runtime import save
from prepare_wav100_authoring import public_entry

CATEGORIES={260:('Open the Video Game category page to browse products','Video Games'),
            261:('Open the Headphones category page to browse products','Headphones')}
SORTED_CATEGORIES={351:('Go to the page showing PS4 accessories products sorted by ascending price','PS4 accessories','ascending'),
                   353:('Go to the page showing competitive swimwear products sorted by ascending price','competitive swimwear','ascending'),
                   355:('Go to the page showing kids" bedding products sorted by descending price','kids\' bedding','descending')}
NAVIGATION_RESULT='{"task_type":"NAVIGATE","status":"SUCCESS","retrieved_data":null}'

def exposure_fields(task_id,policy):
    exposed=task_id in policy['prior_author_task_outcome_exposure_ids']
    return {'agent_outcomes_exposed':exposed,'known_prior_author_outcome_exposure':exposed,
            'independent_blinding_claimed':False,
            'exposure_note':'Known prior task outcome exposure is disclosed, not erased by public-input projection. No solution trace is read by this generator; independent author blinding is not claimed.'}

def authorization(raw,plan_raw):
    policy=json.loads(raw)
    required={'schema':'pss-diagnostic-authoring-authorization-v1','scope':'diagnostic',
        'campaign_plan_sha256':hashlib.sha256(plan_raw).hexdigest(),
        'authority':'explicit-user-approval-in-current-conversation',
        'traditional_authoring':'AI_ASSISTED_DIAGNOSTIC',
        'human_authored_baseline':False,'require_no_runtime_model_calls':True,
        'may_read_evaluator_internals_or_gold':False,'may_copy_agent_solution_trajectories':False,
        'overrides_environment_or_information_boundary_gates':False,
        'bulk_execution_authorized':False,'confirmatory_authorized':False}
    if any(policy.get(k)!=v or type(policy.get(k)) is not type(v) for k,v in required.items()):
        raise ValueError('Explicit diagnostic-only authorization bound to this plan required')
    return policy

def script_for(task_id,intent):
    lines=[]
    if task_id in CATEGORIES:
        expected,label=CATEGORIES[task_id]
        lines=[f"session.get_by_role('link', name={label!r}, exact=True).click()"]
    elif task_id==274:
        expected='Open the search results for "usb wifi"'
        lines=["field = session.get_by_role('combobox')", "field.fill('usb wifi')", "field.press('Enter')"]
    elif task_id==324:
        expected='Pull up the page with all "chairs" listings sorted by ascending price.'
        lines=["field = session.get_by_role('combobox')", "field.fill('chairs')", "field.press('Enter')",
               "session.get_by_label('Sort By').nth(0).select_option('price')",
               "direction = session.get_by_role('link', name='Set Ascending Direction', exact=True).nth(0)",
               "if direction.is_visible():", "    direction.click()"]
    elif task_id in SORTED_CATEGORIES:
        expected,label,direction=SORTED_CATEGORIES[task_id]
        # Locator proposals, not claims that these exact labels were observed.
        # A non-matching label remains an adaptation failure, never a gold URL.
        wanted='Set '+direction.title()+' Direction'
        lines=[f"session.get_by_role('link', name={label!r}, exact=True).click()",
               "session.get_by_label('Sort By').nth(0).select_option('price')",
               f"direction = session.get_by_role('link', name={wanted!r}, exact=True).nth(0)",
               "if direction.is_visible():", "    direction.click()"]
    else:
        return None
    if expected!=intent:raise ValueError('Public intent mismatch; refuse guessed script binding')
    return 'def run(session, public_task):\n'+''.join('    '+line+'\n' for line in lines)+f'    return {NAVIGATION_RESULT!r}\n'

def check_source(source):
    tree=ast.parse(source)
    if len(tree.body)!=1 or not isinstance(tree.body[0],ast.FunctionDef) or tree.body[0].name!='run':
        raise ValueError('Only reviewed run function permitted')
    allowed={'get_by_role','get_by_label','nth','click','hover','fill','press','select_option','is_visible'}
    for node in ast.walk(tree):
        if isinstance(node,(ast.Import,ast.ImportFrom,ast.Global,ast.Nonlocal)):
            raise ValueError('Imports and global state forbidden in this proposal family')
        if isinstance(node,ast.Attribute) and node.attr not in allowed:
            raise ValueError('Undeclared facade member')
        if isinstance(node,ast.Call) and not isinstance(node.func,ast.Attribute):
            raise ValueError('Only facade method calls permitted in this proposal family')
    return hashlib.sha256(source.encode()).hexdigest()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('plan','authorization','bindings','output'):p.add_argument('--'+name,required=True)
    a=p.parse_args();plan_raw=Path(a.plan).read_bytes();plan=json.loads(plan_raw)
    policy_raw=Path(a.authorization).read_bytes();policy=authorization(policy_raw,plan_raw)
    if len(plan['tasks'])!=100 or len({t['task_id'] for t in plan['tasks']})!=100:raise ValueError('Expected distinct 100-task plan')
    bindings=json.loads(Path(a.bindings).read_bytes())['tasks']
    rows=[];scripts={}
    for task in plan['tasks']:
        row=public_entry(task,bindings[task['task_key']])
        source=script_for(task['task_id'],task['intent'])
        row.update(exposure_fields(task['task_id'],policy))
        row.update(authoring='AI_ASSISTED_DIAGNOSTIC',human_authored_baseline=False,
            source_review='PENDING',live_script_validation='NOT_RUN',bulk_admitted=False)
        if source is not None:
            name='scripts/wav-'+str(task['task_id'])+'.py'
            row.update(script_file=name,script_sha256=check_source(source),
                script_status='AI_SOURCE_PROPOSED_STATIC_CHECK_PASSED',
                source_review='AUTHOR_CHECK_ONLY_NOT_INDEPENDENT',
                baseline_auth_parity='UNVERIFIED',task_goal_account_dependency='public-navigation-no-account-operation')
            scripts[name]=source
        rows.append(row)
    root=Path(a.output);root.mkdir(mode=0o700,parents=True,exist_ok=False);(root/'scripts').mkdir(mode=0o700)
    for name,source in scripts.items():
        with (root/name).open('x') as f:f.write(source)
    save(root/'authoring-ledger.json',{'kind':'WAV100_AI_ASSISTED_AUTHORING_LEDGER',
        'authorization_sha256':hashlib.sha256(policy_raw).hexdigest(),'plan_sha256':hashlib.sha256(plan_raw).hexdigest(),
        'scope':'diagnostic','tasks':rows,'task_count':100,'script_proposals':len(scripts),
        'live_validated_scripts':0,'runtime_model_calls':0,'benchmark_executions':0,
        'full_state_isolation_proven':False,'bulk_admitted':False,'confirmatory_authorized':False})
    print(json.dumps({'public_tasks':100,'script_proposals':len(scripts),'live_validated_scripts':0,'benchmark_executions':0}))

if __name__=='__main__':main()
