import unittest
from run_wav_qwen_pair import jobs, issue

class PairedBatchTests(unittest.TestCase):
    def test_two_tasks_six_agents_one_shared_script(self):
        rows=jobs();self.assertEqual(len(rows),14)
        for task in (260,274):
            r=[j for j in rows if j['task_id']==task]
            self.assertEqual(len(r),7)
            self.assertEqual(sum(j['model'] is None for j in r),1)
            self.assertEqual({j['model'] for j in r},{None,'qwen3.8-max','qwen3.8-flash'})
    def test_method_failure_is_not_deleted_but_provider_block_stops(self):
        r={'owned_cleanup_completed':True,'assessment_status':'valid','official_score':0}
        self.assertIsNone(issue(r,0))
        self.assertEqual(issue({**r,'failure_class':'provider-timeout'},0),'provider-timeout')
        self.assertIsNotNone(issue(r,2));self.assertIsNotNone(issue({},0))

if __name__=='__main__':unittest.main()
