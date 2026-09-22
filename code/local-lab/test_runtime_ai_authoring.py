import hashlib
import json
from pathlib import Path
import unittest
from prepare_wav100_ai_scripts import authorization,script_for,check_source,CATEGORIES,SORTED_CATEGORIES,exposure_fields

class AiAuthoringTests(unittest.TestCase):
    def test_hover_uses_common_instrumentation_and_bounded_timeout(self):
        from unittest.mock import Mock
        from traditional_actor import Locator
        session=Mock();locator=Mock();session._actuator.remaining_ms.return_value=1234
        session.perform.side_effect=lambda action,fn,mutation:fn()
        Locator(session,locator,[['role','link',{'name':'Electronics'}]]).hover()
        locator.hover.assert_called_once_with(timeout=1234)
        self.assertTrue(session.perform.call_args.kwargs['mutation'])
        self.assertEqual(session.perform.call_args.args[0]['name'],'locator.hover')

    def test_prior_exposure_is_not_erased_by_projection(self):
        policy={'prior_author_task_outcome_exposure_ids':[260,274]}
        fields=exposure_fields(260,policy)
        self.assertTrue(fields['agent_outcomes_exposed'])
        self.assertEqual(fields['agent_outcomes_exposed'],fields['known_prior_author_outcome_exposure'])
        self.assertFalse(fields['independent_blinding_claimed'])
        self.assertFalse(exposure_fields(261,policy)['agent_outcomes_exposed'])

    def test_authorization_bound_to_plan_not_global_permission(self):
        root=Path(__file__).resolve().parents[1]
        plan=(root/'config/wav-qwen38max-100-development.v1.json').read_bytes()
        raw=(root/'config/wav100-ai-authoring-authorization.v1.json').read_bytes()
        self.assertFalse(authorization(raw,plan)['confirmatory_authorized'])
        with self.assertRaises(ValueError):authorization(raw,plan+b' ')
        for key in ('may_read_evaluator_internals_or_gold','may_copy_agent_solution_trajectories','bulk_execution_authorized','confirmatory_authorized'):
            changed=json.loads(raw);changed[key]=True
            with self.assertRaises(ValueError):authorization(json.dumps(changed).encode(),plan)

    def test_public_intent_binding_rejects_changed_task(self):
        with self.assertRaises(ValueError):script_for(261,'A different task')
        self.assertIsNone(script_for(47,'Account task is not implemented'))

    def test_all_seven_proposals_use_instrumented_facade(self):
        pairs=[(k,v[0]) for k,v in {**CATEGORIES,**SORTED_CATEGORIES}.items()]
        pairs += [(274,'Open the search results for "usb wifi"'),(324,'Pull up the page with all "chairs" listings sorted by ascending price.')]
        self.assertEqual(len(pairs),7)
        for task,intent in pairs:
            source=script_for(task,intent)
            self.assertEqual(check_source(source),hashlib.sha256(source.encode()).hexdigest())

    def test_direct_hidden_access_or_imports_rejected(self):
        for source in ['def run(s,t):\n import os\n', 'def run(s,t):\n s._actuator.page.evaluate("1")\n',
                       'def run(s,t):\n open("secret")\n']:
            with self.assertRaises(ValueError):check_source(source)

if __name__=='__main__':unittest.main()
