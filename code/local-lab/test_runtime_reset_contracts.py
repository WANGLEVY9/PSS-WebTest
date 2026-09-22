"""Synthetic ownership/closure rejection controls, not real reset acceptance."""
import copy
import tempfile
from pathlib import Path
import unittest
from benchmark_actor_lifecycle import persist,encoded
from vwa_reset_contract import requirements,verify_measured_reset
from wav_owned_lifecycle import validate_owned,validate_manifest,SCHEMA,PIN


class ResetContractTests(unittest.TestCase):
    def test_wav_cleanup_rejects_foreign_shared_or_public_container(self):
        info={'Name':'/owned','Image':'sha256:1','Mounts':[],
            'Config':{'Labels':{'pss.wav.owner':'token'}},
            'HostConfig':{'NetworkMode':'isolated','PortBindings':{'80/tcp':[{'HostIp':'127.0.0.1','HostPort':'1234'}]}},
            'NetworkSettings':{'Networks':{'isolated':{}}}}
        self.assertIs(validate_owned(info,'owned','sha256:1','token','isolated'),info)
        changes=[{'Name':'/primary'},{'Image':'other'},{'Mounts':[{'Name':'shared'}]},
            {'Config':{'Labels':{'pss.wav.owner':'other'}}},
            {'NetworkSettings':{'Networks':{'isolated':{},'primary':{}}}},
            {'HostConfig':{'NetworkMode':'isolated','Privileged':True}},
            {'HostConfig':{'NetworkMode':'isolated','PortBindings':{'80/tcp':[{'HostIp':'0.0.0.0'}]}}}]
        for change in changes:
            with self.subTest(change=change),self.assertRaises(ValueError):validate_owned({**info,**change},'owned','sha256:1','token','isolated')

    def test_wav_only_implemented_site_admitted_to_reset_adapter(self):
        manifest={'schema':SCHEMA,'source_commit':PIN,'docker_context':'test-context','namespace':'pss-wav-unit',
            'environment_id':'synthetic','startup_timeout_s':60,'artifact_root':'/tmp/synthetic','source_directory':'/tmp/source',
            'sites':[{'site':'shopping','image':'x/y@sha256:'+'a'*64,'image_id':'sha256:'+'b'*64,'http_port':18000,'control_port':18001}]}
        validate_manifest(manifest)
        for mutation in ({'site':'reddit'},{'http_port':80},{'control_port':18000},{'image':'mutable:latest'}):
            m=copy.deepcopy(manifest);m['sites'][0].update(mutation)
            with self.assertRaises(ValueError):validate_manifest(m)

    def test_vwa_http_200_never_equals_full_reset(self):
        req=requirements({'sites':['shopping','classifieds','reddit'],'require_reset':False})
        self.assertEqual(req['external_snapshot_restore_sites'],['reddit','shopping'])
        self.assertFalse(req['http_200_sufficient'])
        self.assertTrue(req['required_for_every_arm_and_repetition'])
        with self.assertRaises(ValueError):requirements({'sites':['unknown']})

    def test_vwa_full_closure_proof_rejects_missing_reused_and_drifted_measurements(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);ident={'opportunity_id':'SYNTHETIC','environment_id':'isolated','configuration_sha256':'a'*64,
                'scope':'synthetic','data_kind':'SYNTHETIC_TEST'}
            measurement=persist(root/'measurement.json',encoded({**ident,'site':'shopping','state_sha256':'b'*64,
                'coverage':'full-mutable-state-closure'}))
            row={'site':'shopping','restore_method':'snapshot-restore','expected_state_sha256':'b'*64,
                'observed_state_sha256':'b'*64,'measurement_ref':measurement,'health_verified':True}
            proof={**ident,'schema':'pss-vwa-reset-measurements-v1','baseline_sha256':'c'*64,'lease_token':'lease','sites':[row]}
            ref=persist(root/'proof.json',encoded(proof))
            reset={**ident,'baseline_sha256':'c'*64,'restored':True,'closure_sites':['shopping'],'lease_token':'lease','reset_evidence_ref':ref}
            verify_measured_reset(reset,{'sites':['shopping']},ident,'c'*64)
            for change in ({'closure_sites':[]},{'lease_token':'reused'},{'opportunity_id':'other'},{'restored':False}):
                with self.subTest(change=change),self.assertRaises(ValueError):verify_measured_reset({**reset,**change},{'sites':['shopping']},ident,'c'*64)
            with self.assertRaises(ValueError):verify_measured_reset(reset,{'sites':['shopping','reddit']},ident,'c'*64)
            Path(measurement['file']).write_bytes(b'{}')
            with self.assertRaises(ValueError):verify_measured_reset(reset,{'sites':['shopping']},ident,'c'*64)


if __name__=='__main__':unittest.main()
