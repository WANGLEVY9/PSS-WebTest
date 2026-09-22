import time
import unittest
from types import SimpleNamespace
from unittest.mock import Mock
from journaled_browser import JournaledBrowser


class ObservationBudgetTests(unittest.TestCase):
    def actuator(self):
        page=Mock();page.screenshot.return_value=b'image'
        context=Mock();context.pages=[page]
        journal=Mock();journal.sequence=1
        actor=JournaledBrowser(context,page,journal,[1280,720],{},observation_timeout_ms=30000)
        return actor,page,journal

    def test_observation_timeout_independent_from_action_timeout(self):
        actor,page,_=self.actuator();actor.screenshot('primary-frame')
        page.screenshot.assert_called_once_with(type='png',timeout=30000)
        self.assertEqual(actor.remaining_ms(),5000)

    def test_observation_still_clipped_by_actor_deadline(self):
        actor,page,_=self.actuator();actor.deadline=time.monotonic()+.8
        actor.screenshot('primary-frame')
        self.assertLessEqual(page.screenshot.call_args.kwargs['timeout'],800)

    def test_failure_log_private_not_model_feedback(self):
        actor,page,journal=self.actuator();page.screenshot.side_effect=RuntimeError('private call log')
        with self.assertRaises(RuntimeError):actor.screenshot('projection-bracket')
        journal.artifact.assert_called_once_with('observation-error-000001.txt',b'private call log')
        self.assertEqual(journal.event.call_args.kwargs['phase'],'projection-bracket')
        self.assertIsNone(actor.action_error)

if __name__=='__main__':unittest.main()
