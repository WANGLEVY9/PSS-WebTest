import copy
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from isolation_evidence import audit,STAGES,INSTANCE


class IsolationEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.index=0
        review=self.save({'closure_verified':True,'component_ids':['db','uploads'],
                         'reviewer':'SYNTHETIC_TEST','unresolved_components':[]})
        source=self.save({'fixture':'SYNTHETIC_TEST_NOT_REAL_STATE'})
        self.inventory={'schema':'pss-mutable-state-inventory-v1',
            'components':[{'id':'db','kind':'database'},{'id':'uploads','kind':'filesystem'}],
            'coverage_review_ref':review,'topology_ref':source,'exporter_source_ref':source,'quiescence_protocol_ref':source,
            'instances':{i:{k:i+'-'+k for k in ('db','uploads')} for i in ('A','B')}}
        inv=self.save(self.inventory);snapshots={}
        for n,stage in enumerate(STAGES):
            exports={}
            for key in ('db','uploads'):
                raw=(INSTANCE[stage]+key+('MUTATED' if stage in ('Am','Bm') else 'BASELINE')).encode()
                exports[key]=self.save_bytes(raw)
            snapshots[stage]=self.save({'schema':'pss-isolation-state-v1','inventory_ref':inv,'instance':INSTANCE[stage],
                'stage':stage,'resource_ids':self.inventory['instances'][INSTANCE[stage]],'capture_started_ns':n*10+1,
                'capture_ended_ns':n*10+2,'quiescent':True,'unresolved_components':[],'exports':exports})
        self.package={'schema':'pss-cross-instance-isolation-v1','inventory_ref':inv,'snapshots':snapshots}

    def save_bytes(self,raw):
        self.index+=1;path=self.root/f'{self.index}.json';path.write_bytes(raw);os.chmod(path,0o600)
        return {'file':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}

    def save(self,value):return self.save_bytes(json.dumps(value).encode())
    def read(self,ref):return json.loads(Path(ref['file']).read_bytes())
    def changed(self,stage,**updates):
        self.package['snapshots'][stage]=self.save({**self.read(self.package['snapshots'][stage]),**updates})

    def test_complete_two_direction_content_comparison(self):
        result=audit(self.package);self.assertTrue(result['snapshot_contract_passed'])
        self.assertFalse(result['confirmatory_authorized']);self.assertEqual(result['snapshot_count'],10)

    def test_peer_identity_unchanged_but_content_drift_rejected(self):
        snapshot=self.read(self.package['snapshots']['B_after_Am'])
        snapshot['exports']['db']=self.save_bytes(b'SYNTHETIC_PEER_DATA_CHANGED')
        self.package['snapshots']['B_after_Am']=self.save(snapshot)
        with self.assertRaises(ValueError):audit(self.package)

    def test_subset_snapshot_rejected(self):
        self.changed('A0',exports={'db':self.read(self.package['snapshots']['A0'])['exports']['db']})
        with self.assertRaises(ValueError):audit(self.package)

    def test_unobserved_mutation_rejected(self):
        self.changed('Am',exports=self.read(self.package['snapshots']['A0'])['exports'])
        with self.assertRaises(ValueError):audit(self.package)

    def test_reset_not_restored_rejected(self):
        self.changed('Ar',exports=self.read(self.package['snapshots']['Am'])['exports'])
        with self.assertRaises(ValueError):audit(self.package)

    def test_unquiesced_export_rejected(self):
        self.changed('B0',quiescent=False)
        with self.assertRaises(ValueError):audit(self.package)

    def test_export_changed_after_capture_rejected(self):
        export=self.read(self.package['snapshots']['A0'])['exports']['db']
        Path(export['file']).write_bytes(b'MODIFIED')
        with self.assertRaises(ValueError):audit(self.package)

    def test_missing_direction_rejected(self):
        del self.package['snapshots']['Bm']
        with self.assertRaises(ValueError):audit(self.package)


if __name__=='__main__':unittest.main()
