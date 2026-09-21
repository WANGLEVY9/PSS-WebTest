# -*- coding: utf-8 -*-
import csv
import runpy
import tempfile
import unittest
from pathlib import Path

MODULE = runpy.run_path(str(Path(__file__).with_name('prepare-ata.py')))

class PreparationTests(unittest.TestCase):
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
