import copy
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from session_auth import authenticated_state


class SessionAuthTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.index=0
        self.op={'opportunity_id':'op','environment_id':'env','configuration_sha256':'a'*64,
                 'lease_token':'lease','scope':'synthetic','setup_ref':self.ref({'sites':['shopping']})}
        self.reset={**self.op,'reset_evidence_ref':self.ref({'reset':'synthetic'})}
        health={**self.op,'reset_evidence_ref':self.reset['reset_evidence_ref'],
                'authenticated':True,'sites':['shopping']}
        self.state={'cookies':[{'name':'session','value':'SYNTHETIC','domain':'localhost',
                    'path':'/','expires':-1,'httpOnly':True,'secure':False,'sameSite':'Lax'}],'origins':[]}
        self.proof={**self.op,'schema':'pss-reset-auth-v1','baseline_sha256':'b'*64,
            'data_kind':'SYNTHETIC_TEST','reset_evidence_ref':self.reset['reset_evidence_ref'],
            'created_at_unix':100,'expires_at_unix':200,'authenticated_sites':['shopping'],
            'authenticated_health_ref':self.ref(health),'storage_state_ref':self.ref(self.state)}

    def ref(self,value):
        self.index+=1;path=self.root/f'{self.index}.json'
        path.write_text(json.dumps(value));os.chmod(path,0o600)
        return {'file':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}

    def check(self,proof=None,**kw):
        return authenticated_state(self.ref(self.proof if proof is None else proof),
            self.op,self.reset,'b'*64,{'__SHOPPING__':'http://localhost:7770'},now=kw.get('now',150))

    def test_accept_exact_private_reset_and_state(self):self.assertEqual(self.check(),self.state)

    def test_reject_each_identity_and_reset_or_setup_drift(self):
        for field in ('opportunity_id','environment_id','configuration_sha256','lease_token',
                      'baseline_sha256','reset_evidence_ref','setup_ref','scope','data_kind'):
            with self.subTest(field=field),self.assertRaises(ValueError):
                self.check({**self.proof,field:'OTHER'})

    def test_reject_old_or_future_proofs(self):
        for now in (99,200,201):
            with self.subTest(now=now),self.assertRaises(ValueError):self.check(now=now)

    def test_reject_state_origin_cookie_expiry_and_empty(self):
        bad=[]
        state=copy.deepcopy(self.state);state['cookies'][0]['domain']='external.test';bad.append(state)
        state=copy.deepcopy(self.state);state['cookies'][0]['expires']=149;bad.append(state)
        bad.append({'cookies':[],'origins':[]})
        bad.append({'cookies':[],'origins':[{'origin':'http://localhost:8888','localStorage':[]}]})
        for state in bad:
            with self.subTest(state=state),self.assertRaises(ValueError):
                self.check({**self.proof,'storage_state_ref':self.ref(state)})

    def test_reject_public_secret_file_and_hash_drift(self):
        ref=self.proof['storage_state_ref'];path=Path(ref['file']);os.chmod(path,0o644)
        with self.assertRaises(ValueError):self.check()
        os.chmod(path,0o600);path.write_text('{}')
        with self.assertRaises(ValueError):self.check()

    def test_reject_wrong_health_execution_and_unauthenticated(self):
        health=json.loads(Path(self.proof['authenticated_health_ref']['file']).read_text())
        for change in ({'lease_token':'old'},{'authenticated':False},{'sites':[]}):
            with self.subTest(change=change),self.assertRaises(ValueError):
                self.check({**self.proof,'authenticated_health_ref':self.ref({**health,**change})})


if __name__=='__main__':unittest.main()
