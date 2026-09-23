import unittest
from benchmark_output_contract import public_output_instruction
from framework_boundary import project_observation, public_task_text
from runtime_inputs import task_projection
from native_eval_contract import wav_endpoint


class OutputContractTests(unittest.TestCase):
    def test_wav_protocol_survives_import_and_both_observation_boundaries(self):
        task = task_projection({'schema':'pss-official-task-input-v1', 'benchmark':'wav',
            'intent':'Find a product', 'task_images':[]}, 'wav')
        texts = []
        for mode in ('visual', 'hybrid'):
            obs = project_observation({'screenshot':b'png', 'visible_controls':[]}, mode, task, 0, [100,100])
            texts.append(public_task_text(obs))
        self.assertEqual(*texts)
        for field in ('task_type', 'status', 'retrieved_data', 'error_details'):
            self.assertIn(field, texts[0])
        self.assertNotIn('expected_agent_response', texts[0])

    def test_vwa_does_not_inherit_wav_json_protocol(self):
        self.assertEqual(public_output_instruction('vwa'), '')
        with self.assertRaises(ValueError): public_output_instruction('unknown')

    def test_official_ata_repeated_step_labels_are_preserved_not_renumbered(self):
        steps=[{'step':i,'action':str(j),'expectedResult':'Visible'} for j,i in enumerate([1,1,2,3,4,5])]
        projected=task_projection({'schema':'pss-official-task-input-v1','benchmark':'ata',
            'intent':'SYNTHETIC_TEST','task_images':[],'steps':steps},'ata')
        self.assertEqual(projected['steps'],steps)

    def test_native_error_is_unresolved_not_failure(self):
        self.assertIsNone(wav_endpoint({'task_id':1,'status':'error','score':0},1)['native_score'])
        for status, score in [('success',1), ('failure',0)]:
            self.assertEqual(wav_endpoint({'task_id':1,'status':status,'score':score},1)['native_score'],score)

    def test_wrapper_reward_and_mismatched_ids_are_rejected(self):
        for result in [{'task_id':1,'status':'success','score':0.5},
                       {'task_id':1,'status':'failure','score':1},
                       {'task_id':2,'status':'success','score':1},
                       {'task_id':1,'status':'success','score':True}]:
            with self.assertRaises(ValueError): wav_endpoint(result,1)


if __name__ == '__main__': unittest.main()
