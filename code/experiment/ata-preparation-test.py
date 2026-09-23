# -*- coding: utf-8 -*-
import csv
import json
import runpy
import tempfile
import unittest
from pathlib import Path

MODULE = runpy.run_path(str(Path(__file__).with_name('prepare-ata.py')))

class PreparationTests(unittest.TestCase):
    def test_nested_gold_and_source_metadata_cannot_enter_actor_packet(self):
        case={'task_id':'ata-opaque','site':'fixture','title':'Fixture only',
              'label':'F','source_file':'SECRET_FAILING.csv','failures':['SECRET_GOLD'],
              'steps':[{'step':1,'action':'Open fixture','expectedResult':'Visible',
                        'gold':'SECRET_GOLD','source_line':99}]}
        packet=MODULE['agent_payload'](case)
        self.assertEqual(set(packet),{'task_id','site','title','steps'})
        self.assertEqual(set(packet['steps'][0]),{'step','action','expectedResult'})
        self.assertNotIn('SECRET',json.dumps(packet))
        case['label']='P'
        case['failures']=[]
        self.assertEqual(packet,MODULE['agent_payload'](case))

    def test_nonstandard_marker_does_not_drop_valid_task(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'fixture_failing.csv'
            with path.open('w',newline='') as stream:
                csv.writer(stream).writerows([['í','TC-1-F :: Fixture only'],['Step','Actions','Expected Result','Expected Failure'],['1','Open fixture','Fixture is visible','Unexpected error']])
            cases=MODULE['parse_file'](path)
            self.assertEqual(len(cases),1)
            self.assertEqual(cases[0]['label'],'F')
            self.assertEqual(cases[0]['failures'][0]['step'],1)
            self.assertNotIn('TC-1-F',cases[0]['task_id'])

    def test_duplicate_source_steps_are_preserved_for_adjudication(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'fixture_passing.csv'
            with path.open('w',newline='') as stream:
                csv.writer(stream).writerows([['►','TC-2-P :: Fixture only'],['1','A','X',''],['1','B','Y','']])
            case=MODULE['parse_file'](path)[0]
            self.assertEqual([s['step'] for s in case['steps']],[1,1])
            self.assertEqual(case['failures'],[])

if __name__=='__main__':unittest.main()
