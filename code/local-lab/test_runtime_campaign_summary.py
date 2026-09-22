import unittest
from summarize_wav100_campaign import summarize


class CampaignAccounting(unittest.TestCase):
    def row(self,**changes):
        return {'task_id':260,'framework':'agentlab-browsergym','mode':'visual',
            'official_task_started':True,'official_task_completed':True,'assessment_status':'valid',
            'engineering_error':None,'actor_status':'completed','failure_class':None,'official_score':1,**changes}

    def test_repeats_are_not_new_tasks(self):
        r=summarize([self.row(),self.row()])['agentlab-visual']
        self.assertEqual(r['probe_attempts'],2);self.assertEqual(r['distinct_official_tasks_started'],1)
        self.assertEqual(r['distinct_tasks_completed_actor_and_evaluated'],1)

    def test_native_score_does_not_erase_engineering_failure(self):
        r=summarize([self.row(actor_status='execution-error',failure_class='ProjectionDrift')])['agentlab-visual']
        self.assertEqual(r['valid_native_scores'],1);self.assertEqual(r['native_success_with_completed_actor'],0)

    def test_setup_only_not_actor_execution(self):
        r=summarize([self.row(official_task_started=False,official_task_completed=False)])['agentlab-visual']
        self.assertEqual(r['official_actor_starts'],0);self.assertEqual(r['distinct_official_tasks_started'],0)

if __name__=='__main__':unittest.main()
