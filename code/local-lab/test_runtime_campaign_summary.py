import unittest
import tempfile
import json
from pathlib import Path
from prepare_official_runtime import save
from summarize_wav100_campaign import summarize,provider_metrics


class CampaignAccounting(unittest.TestCase):
    def row(self,**changes):
        return {'task_id':260,'framework':'agentlab-browsergym','mode':'visual',
            'official_task_started':True,'official_task_completed':True,'assessment_status':'valid',
            'actor_budget_met':True,'source_tree_unchanged':True,'replay_integrity_passed':True,
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

    def test_response_export_has_usage_without_private_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp);d=folder/'trajectory';d.mkdir()
            h=save(d/'response.json',{'http_status':200,'model_returned':'qwen3.8-max','latency_ms':2100,
                'usage':{'input_tokens':100,'output_tokens':20},'raw_output':'PRIVATE_TEXT','output':'PRIVATE_TEXT',
                'provider_request_id':'PRIVATE_ID','configuration':{'private':'PRIVATE_CONFIG'}})
            (d/'trajectory.jsonl').write_text(json.dumps({'kind':'provider-end','response':{'file':'response.json','sha256':h}})+'\n')
            r=provider_metrics(folder)
            self.assertEqual(r['known_input_tokens'],100);self.assertEqual(r['known_output_tokens'],20)
            self.assertEqual(r['returned_models'],['qwen3.8-max']);self.assertIsNone(r['billed_cost'])
            self.assertNotIn('PRIVATE',json.dumps(r))
            (d/'response.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'drift'):provider_metrics(folder)

    def test_missing_budget_evidence_never_counts_as_completed_acceptance(self):
        r=summarize([self.row(actor_budget_met=None)])['agentlab-visual']
        self.assertEqual(r['completed_actor_valid_evaluation'],0)

if __name__=='__main__':unittest.main()
