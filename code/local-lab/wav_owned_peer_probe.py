"""Live bidirectional targeted-content controls on owned WAV shopping copies.

Not full mutable-state closure or benchmark admission. This extends the earlier
identity-only peer check to actual complete rows of two declared tables and a
filesystem marker. Other tables/cache/index/queue content remain unverified.
"""
import argparse
import json
from pathlib import Path
import time
from wav_owned_lifecycle import OwnedLifecycle, Docker, read_ref, write_new, digest

TABLES = ('review_detail', 'customer_entity')
MARKER = '/tmp/pss-owned-peer-control-marker'


def comparisons(states):
    equal = [('A0','Ar'), ('B0','B_after_Am'), ('B0','B_after_Ar'),
             ('B0','Br'), ('Ar','A_after_Bm'), ('Ar','A_after_Br')]
    restored = all(states[a] == states[b] for a,b in equal)
    mutated = all(all(states[a][k] != states[b][k] for k in (*TABLES,'marker'))
                  for a,b in [('A0','Am'),('B0','Bm')])
    return {'restore_and_peer_content_equal': restored,
            'positive_mutations_observed': mutated,
            'targeted_content_passed': restored and mutated}


def run(args):
    root = Path(args.output).resolve()
    root.mkdir(mode=0o700, parents=True, exist_ok=False)
    original = read_ref({'file':args.manifest, 'sha256':args.manifest_sha256})
    if len(original['sites']) != 1: raise ValueError('Shopping-only control')
    stamp = str(time.time_ns())
    states = {}; active = {}; receipts = []; refs = {}
    d = Docker(original['docker_context'])
    before = {line.split()[1]:line.split()[0] for line in
              d.run(['ps','-a','--no-trunc','--format','{{.ID}} {{.Names}}']).splitlines()}
    report = {'kind':'WAV_OWNED_BIDIRECTIONAL_TARGETED_CONTENT_CONTROL',
              'scope':'diagnostic','data_kind':'MEASURED','benchmark_task_executions':0,
              'model_requests':0,'confirmatory_authorized':False,'full_state_isolation_proven':False,
              'full_three_arm_admission':False,'declared_tables':list(TABLES),'states':states,
              'evidence_refs':refs,'lifecycle_receipts':receipts,'passed':False}
    def create(instance, cycle):
        m = dict(original)
        site = dict(m['sites'][0])
        site.update(http_port=args.port_base+(0 if instance=='A' else 2),
                    control_port=args.port_base+(1 if instance=='A' else 3))
        m.update(namespace='pss-wav-peer-'+stamp, environment_id='peer-'+instance,
                 artifact_root=str(root/'instances'), sites=[site])
        mr = write_new(root/f'manifest-{instance}-{cycle}.json',m)
        setup = write_new(root/f'setup-{instance}-{cycle}.json',{'sites':['shopping'],'reset_before_each_arm':True})
        payload={'opportunity_id':instance+'-'+str(cycle),'environment_id':m['environment_id'],
                 'configuration_sha256':mr['sha256'],'scope':'diagnostic','data_kind':'MEASURED',
                 'baseline_sha256':mr['sha256'],'setup_ref':setup}
        life = OwnedLifecycle(m,mr['sha256'],payload)
        active[instance]=life
        print(json.dumps({'stage':'provision','instance':instance,'cycle':cycle}),flush=True)
        receipts.append(life.reset(payload))
        # These control tables have no time-dependent rows to mask/normalize.
        # Stop background cron to reduce incidental writes. No actor runs while stopped.
        name=life.names['shopping']; life.owned(site)
        life.d.run(['exec',name,'supervisorctl','stop','cron'])
        return life
    def capture(stage,instance):
        life=active[instance];site=life.m['sites'][0];name=life.names['shopping'];life.owned(site)
        state={};artifacts={}
        for table in TABLES:
            # Entire table, not counts or selected marker rows. Deterministic primary-key order.
            key='detail_id' if table=='review_detail' else 'entity_id'
            data=life.sql(site,'SELECT * FROM '+table+' ORDER BY '+key)
            ref=write_new(root/(stage+'-'+table+'.json'),{'table':table,'rows_tsv':data})
            state[table]=digest(data.encode());artifacts[table]=ref
        raw=life.d.run(['exec',name,'sh','-c',
            'if test -e '+MARKER+'; then cat '+MARKER+'; else printf ABSENT; fi'])
        state['marker']=digest(raw.encode());states[stage]=state
        refs[stage]=write_new(root/(stage+'.json'),{'stage':stage,'instance':instance,
            'container_id':life.owned(site)['Id'],'capture_ns':time.monotonic_ns(),
            'exports':artifacts,'marker_sha256':state['marker']})
        print(json.dumps({'stage':stage,'captured':True}),flush=True)
    def mutate(instance):
        life=active[instance];site=life.m['sites'][0];token='PSS_PEER_'+instance
        life.sql(site,"UPDATE review_detail SET title='"+token+"' ORDER BY detail_id LIMIT 1")
        life.sql(site,"UPDATE customer_entity SET firstname='"+token+"' ORDER BY entity_id LIMIT 1")
        life.d.run(['exec',life.names['shopping'],'sh','-c','printf '+token+' > '+MARKER])
    try:
        create('A',0);create('B',0)
        capture('A0','A');capture('B0','B')
        mutate('A');capture('Am','A');capture('B_after_Am','B')
        receipts.append(active['A'].cleanup());del active['A']
        create('A',1);capture('Ar','A');capture('B_after_Ar','B')
        mutate('B');capture('Bm','B');capture('A_after_Bm','A')
        receipts.append(active['B'].cleanup());del active['B']
        create('B',1);capture('Br','B');capture('A_after_Br','A')
        report.update(comparisons(states))
        after={name:d.inspect(name)['Id'] for name in before}
        report['preexisting_container_identities_unchanged']=before==after
        report['passed']=report['targeted_content_passed'] and before==after
    except Exception as exc:
        report.update(error_type=type(exc).__name__,failed_stage_count=len(states))
    finally:
        # Only exact owned resources with verified immutable creation intent.
        cleanup_errors=[]
        for instance,life in list(active.items()):
            try:receipts.append(life.cleanup())
            except Exception as exc:cleanup_errors.append({'instance':instance,'error_type':type(exc).__name__})
        report['cleanup_errors']=cleanup_errors
        if cleanup_errors:report['passed']=False
        write_new(root/'report.json',report)
    print(json.dumps({k:v for k,v in report.items() if k not in ('states','evidence_refs','lifecycle_receipts')}),flush=True)
    return report['passed']


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--manifest',required=True);p.add_argument('--manifest-sha256',required=True)
    p.add_argument('--output',required=True);p.add_argument('--port-base',type=int,required=True)
    p.add_argument('--live',action='store_true');a=p.parse_args()
    if not a.live:p.error('--live required; creates, mutates and retires own disposable fixtures')
    if not 1024<=a.port_base<=65532:p.error('Four consecutive nonprivileged ports required')
    raise SystemExit(0 if run(a) else 2)
