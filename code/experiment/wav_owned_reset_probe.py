"""Real diagnostic control on disposable owned WAV shopping containers only.

No benchmark task/model is run. No pre-existing container is changed or deleted.
Measured perturbations cover review, customer and writable filesystem state;
do not promote these controls to full multi-site/three-arm task admission.
"""
import argparse
import json
from pathlib import Path
import sys
import time
from wav_owned_lifecycle import OwnedLifecycle,Docker,SCHEMA,PIN,digest,write_new


def run(output,source,context,image,image_id,http_port,control_port):
    output=Path(output).resolve();output.mkdir(mode=0o700,parents=True,exist_ok=False)
    manifest={'schema':SCHEMA,'source_commit':PIN,'docker_context':context,
        'namespace':'pss-wav-diag-'+str(int(time.time())),'environment_id':'owned-shopping-reset-control',
        'startup_timeout_s':600,'artifact_root':str(output/'instances'),'source_directory':str(Path(source).resolve()),
        'sites':[{'site':'shopping','image':image,'image_id':image_id,'http_port':http_port,'control_port':control_port}]}
    mref=write_new(output/'manifest.json',manifest)
    setup=write_new(output/'setup.json',{'sites':['shopping'],'reset_before_each_arm':True})
    d=Docker(context)
    # Inventory identities are read-only. This probe never adopts their names.
    peers=d.run(['ps','-a','--format','{{.ID}} {{.Names}}']).splitlines()
    peer_ids={line.split()[1]:d.inspect(line.split()[1])['Id'] for line in peers}
    snapshots=[];cycles=[];previous=None
    report={'kind':'WAV_OWNED_RESET_CONTROL','scope':'diagnostic','data_kind':'MEASURED',
        'model_requests':0,'benchmark_task_executions':0,'confirmatory_authorized':False,
        'full_three_arm_admission':False,'cycles':cycles}
    for index in range(3):
        identity={'opportunity_id':f'owned-reset-control-{index}','environment_id':manifest['environment_id'],
            'configuration_sha256':mref['sha256'],'scope':'diagnostic','data_kind':'MEASURED'}
        payload={**identity,'baseline_sha256':mref['sha256'],'setup_ref':setup}
        life=OwnedLifecycle(manifest,mref['sha256'],payload)
        site=manifest['sites'][0]
        try:
            print(json.dumps({'stage':'reset','cycle':index}),flush=True)
            reset=life.reset(payload)
            review=life.sql(site,'SELECT title FROM review_detail WHERE detail_id=(SELECT m FROM (SELECT MIN(detail_id) AS m FROM review_detail) x)')
            customer=life.sql(site,'SELECT firstname FROM customer_entity ORDER BY entity_id LIMIT 1')
            name=life.names['shopping']
            marker=life.d.run(['exec',name,'test','!','-e','/tmp/pss-owned-reset-control-marker'])
            snapshot={'review_sha256':digest(review.encode()),'customer_sha256':digest(customer.encode()),'filesystem_marker_absent':True}
            snapshots.append(snapshot)
            if index and snapshot!=snapshots[0]:raise ValueError('Restored control state differs from first fresh image')
            if previous:
                cycles.append({'cycle':index,'baseline':snapshots[0],'mutated':previous,'restored':snapshot,
                               'reset_evidence_ref':reset['reset_evidence_ref'],'passed':True})
            if index<2:
                token='PSS_OWNED_CONTROL_'+str(index)
                life.sql(site,"UPDATE review_detail SET title='"+token+"' ORDER BY detail_id LIMIT 1")
                life.sql(site,"UPDATE customer_entity SET firstname='"+token+"' ORDER BY entity_id LIMIT 1")
                life.d.run(['exec',name,'touch','/tmp/pss-owned-reset-control-marker'])
                changed_review=life.sql(site,'SELECT title FROM review_detail ORDER BY detail_id LIMIT 1')
                changed_customer=life.sql(site,'SELECT firstname FROM customer_entity ORDER BY entity_id LIMIT 1')
                if changed_review!=token or changed_customer!=token:raise ValueError('Control mutations not observed')
                life.d.run(['exec',name,'test','-e','/tmp/pss-owned-reset-control-marker'])
                previous={'review_sha256':digest(changed_review.encode()),'customer_sha256':digest(changed_customer.encode()),'filesystem_marker_absent':False}
        except Exception as exc:
            report.update(passed=False,error_type=type(exc).__name__,failed_cycle=index,
                          quarantined_container_names=list(life.names.values()))
            write_new(output/'report.json',report)
            print(json.dumps({'passed':False,'error_type':type(exc).__name__,'report':str(output/'report.json')}),flush=True)
            return False
        print(json.dumps({'stage':'cleanup-owned-instance','cycle':index}),flush=True)
        life.cleanup()
    after={name:d.inspect(name)['Id'] for name in peer_ids}
    report.update(passed=len(cycles)==2 and after==peer_ids,preexisting_container_identities_unchanged=after==peer_ids,
        peer_state_content_verified=False,
        evidence_boundary='Fresh owned rootfs, no mounts, dedicated ICC-disabled bridge; two control restore cycles. Peer data-content, egress firewall and real task/native-evaluator/each-arm acceptance remain separate.')
    write_new(output/'report.json',report)
    print(json.dumps({'passed':report['passed'],'report':str(output/'report.json'),'full_three_arm_admission':False}),flush=True)
    return report['passed']


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for key in ('output','source','context','image','image-id'):p.add_argument('--'+key,required=True)
    p.add_argument('--http-port',type=int,required=True);p.add_argument('--control-port',type=int,required=True)
    a=p.parse_args()
    raise SystemExit(0 if run(a.output,a.source,a.context,a.image,a.image_id,a.http_port,a.control_port) else 2)
