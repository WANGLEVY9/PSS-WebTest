import json
import tempfile
import unittest
from pathlib import Path
from prepare_official_runtime import save
from prepare_wav100_authoring import public_entry


class AuthoringProjectionTests(unittest.TestCase):
    def test_missing_gold_file_is_never_read_or_projected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);actor=root/'actor.json';setup=root/'setup.json'
            ah=save(actor,{'schema':'pss-official-task-input-v1','benchmark':'wav','intent':'public task','task_images':[]})
            sh=save(setup,{'sites':['shopping'],'start_urls':['__SHOPPING__'],'private_supervisor_value':'HIDDEN'})
            task={'task_key':'wav:260','task_id':260,'intent':'public task','intent_template_id':211,
                  'sites':['shopping'],'start_urls':['__SHOPPING__']}
            binding={'benchmark':'wav','official_task_id':'260','agent_input_file':str(actor),'agent_input_sha256':ah,
                     'setup_ref':{'file':str(setup),'sha256':sh},'evaluation_ref':{'file':'NONEXISTENT_GOLD','sha256':'b'*64}}
            out=public_entry(task,binding)
            self.assertEqual(out['script_status'],'PENDING');self.assertIsNone(out['authoring_minutes'])
            for forbidden in ('HIDDEN','NONEXISTENT_GOLD','evaluation_ref','private_supervisor_value'):
                self.assertNotIn(forbidden,json.dumps(out))

if __name__=='__main__':unittest.main()
