import concurrent.futures
import json
from pathlib import Path
import tempfile
import unittest
from spend_guard import SpendGuard


class SpendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.file = str(Path(self.tmp.name) / 'shared.sqlite')
        self.policy = json.loads((Path(__file__).parent.parent / 'config/spend-policy.json').read_text())
        self.policy.update(cap_micro_cny=100, warning_micro_cny=60, critical_micro_cny=70,
                           stop_new_tasks_micro_cny=90, task_cap_micro_cny=100, task_max_requests=3)
        self.guard = SpendGuard(self.file, self.policy)

    def tearDown(self):
        self.guard.close()
        self.tmp.cleanup()

    def reserve(self, request, task='task', amount=30):
        return self.guard.reserve(request, task, amount, {'model': 'SYNTHETIC_FIXTURE'})

    def test_unknown_cost_survives_restart_and_task_switch(self):
        self.reserve('1', amount=70)
        self.guard.settle('1', None)
        self.guard.close()
        self.guard = SpendGuard(self.file, self.policy)
        with self.assertRaisesRegex(ValueError, 'global-cap'):
            self.reserve('2', 'new-campaign/task', 31)
        self.assertEqual(self.guard.summary()['exposure_micro_cny'], 70)

    def test_known_settlement_idempotent_no_duplicate_dispatch(self):
        self.reserve('1')
        self.guard.settle('1', 10)
        self.guard.settle('1', 10)
        self.assertEqual(self.guard.summary()['exposure_micro_cny'], 10)
        with self.assertRaisesRegex(ValueError, 'Conflicting'):
            self.guard.settle('1', 0)
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            self.reserve('1')

    def test_parallel_workers_cannot_oversubscribe(self):
        def attempt(i):
            guard = SpendGuard(self.file, self.policy)
            try:
                guard.reserve(str(i), 'task'+str(i), 30, {})
                return True
            except ValueError:
                return False
            finally:
                guard.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            self.assertEqual(sum(pool.map(attempt, range(12))), 3)
        self.assertEqual(self.guard.summary()['exposure_micro_cny'], 90)

    def test_stop_new_tasks_allows_bounded_existing_task(self):
        self.reserve('1', amount=90)
        with self.assertRaisesRegex(ValueError, 'stop-new-tasks'):
            self.reserve('2', 'different-task', 1)
        self.reserve('3', amount=10)

    def test_task_cost_request_and_deadline_limits(self):
        self.policy['task_cap_micro_cny'] = 50
        self.guard.close()
        self.guard = SpendGuard(self.file, self.policy, clock=lambda:100)
        self.reserve('1', amount=40)
        with self.assertRaisesRegex(ValueError, 'task-cap'):
            self.reserve('2', amount=11)
        self.guard.settle('1', 0)
        self.reserve('3', amount=1)
        self.reserve('4', amount=1)
        with self.assertRaisesRegex(ValueError, 'task-request-limit'):
            self.reserve('5', amount=1)
        self.reserve('6', 'other', 1)
        self.guard.clock = lambda:400
        with self.assertRaisesRegex(ValueError, 'task-deadline'):
            self.reserve('7', 'other', 1)

    def test_pause_and_overrun_persist_even_after_resume(self):
        self.reserve('1', amount=10)
        self.guard.pause(True)
        with self.assertRaisesRegex(ValueError, 'paused'):
            self.reserve('2')
        self.guard.pause(False)
        self.guard.settle('1', 11)
        with self.assertRaisesRegex(ValueError, 'reservation-overrun'):
            self.reserve('3')

    def test_policy_change_cannot_reset_budget_and_alerts_are_deduplicated(self):
        self.reserve('1', amount=70)
        self.guard.thresholds()
        self.guard.thresholds()
        self.assertEqual(len(self.guard.summary()['alerts']), 2)
        changed = {**self.policy, 'cap_micro_cny':200}
        with self.assertRaisesRegex(ValueError, 'migration'):
            SpendGuard(self.file, changed)

    def test_unknown_charge_requires_explicit_billing_evidence_to_release(self):
        self.reserve('1', amount=70)
        with self.assertRaisesRegex(ValueError, 'evidence'):
            self.guard.reconcile('1', 0, '')
        self.assertEqual(self.guard.summary()['exposure_micro_cny'],70)
        self.guard.reconcile('1', 15, 'a'*64)
        self.assertEqual(self.guard.summary()['exposure_micro_cny'],15)
        with self.assertRaises(ValueError):
            self.guard.reconcile('1',0,'b'*64)


if __name__ == '__main__':
    unittest.main()
