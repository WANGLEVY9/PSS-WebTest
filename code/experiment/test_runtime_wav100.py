import copy
import unittest
from prepare_wav100_campaign import select

class SelectionTests(unittest.TestCase):
    def rows(self):return [{'task_id':i,'intent_template_id':i%5,'sites':['shopping'],'intent':'public '+str(i),'start_urls':['__SHOPPING__'],'eval':{'gold':i}} for i in range(120)]
    def test_distinct_reproducible_and_outcome_blind(self):
        rows=self.rows();a,total,groups=select(rows)
        self.assertEqual((len(a),total,groups),(100,120,5));self.assertEqual(len({r['task_id'] for r in a}),100)
        changed=copy.deepcopy(rows)
        for row in changed:row['eval']={'gold':'changed','success':False}
        self.assertEqual(a,select(list(reversed(changed)))[0]);self.assertTrue(all('eval' not in r for r in a))
    def test_refuses_count_padding_and_duplicate_id(self):
        with self.assertRaises(ValueError):select(self.rows()[:99])
        rows=self.rows();rows[1]['task_id']=0
        with self.assertRaises(ValueError):select(rows)

if __name__=='__main__':unittest.main()
