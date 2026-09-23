"""Synthetic clock/budget controls; no benchmark results or provider calls."""
import copy
import unittest
from lifecycle_timing import POLICY, envelope_budget, verify_timing, window


class TimingTests(unittest.TestCase):
    def setUp(self):
        self.limits={'setup_ms':1000,'evaluation_ms':1000,'finalization_ms':1000,'transport_ms':1000}
        self.actor={'timing_policy':POLICY,'actor_timing':window(1_000_000_000,1_020_000_000),'elapsed_ms':20.0}
        self.timing={'policy':POLICY,'phases':{name:window(a,b) for name,a,b in (
            ('setup',0,1_000_000_000),('actor',1_000_000_000,1_030_000_000),
            ('evaluation',1_030_000_000,1_040_000_000),('finalization',1_040_000_000,2_040_000_000))}}

    def test_admin_time_is_not_actor_budget(self):
        self.assertEqual(verify_timing(self.timing,self.actor,self.limits),20)
        self.assertEqual(envelope_budget({'task_timeout_ms':100},self.limits),4100)

    def test_elapsed_drift_overlap_and_omission_are_rejected(self):
        for name in self.timing['phases']:
            value=copy.deepcopy(self.timing);value['phases'][name]['elapsed_ms']+=1
            with self.subTest(name=name),self.assertRaises(ValueError):verify_timing(value,self.actor)
        for name in self.timing['phases']:
            value=copy.deepcopy(self.timing);del value['phases'][name]
            with self.subTest(name=name),self.assertRaises(ValueError):verify_timing(value,self.actor)
        value=copy.deepcopy(self.timing);value['phases']['evaluation']=window(1_020_000_000,1_040_000_000)
        with self.assertRaises(ValueError):verify_timing(value,self.actor)

    def test_actor_containment_and_policy_checked(self):
        for change in ({'timing_policy':'legacy'},{'elapsed_ms':19},
                       {'actor_timing':window(0,20_000_000)},{'actor_timing':window(1_000_000_000,2_000_000_000)}):
            with self.subTest(change=change),self.assertRaises(ValueError):
                verify_timing(self.timing,{**self.actor,**change})

    def test_phase_limits_and_nonfinite_values_fail_closed(self):
        with self.assertRaises(ValueError):verify_timing(self.timing,self.actor,{**self.limits,'setup_ms':999})
        for invalid in (None,{}, {**self.limits,'setup_ms':True}):
            with self.assertRaises(ValueError):envelope_budget({'task_timeout_ms':100},invalid)
        with self.assertRaises(ValueError):window(2,1)
        with self.assertRaises(ValueError):window(True,2)


if __name__=='__main__':unittest.main()
