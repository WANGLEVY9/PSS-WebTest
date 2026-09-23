import unittest
from wav_owned_peer_probe import comparisons, TABLES

class PeerControlTests(unittest.TestCase):
    def baseline(self):
        same={k:'base' for k in (*TABLES,'marker')}
        states={k:dict(same) for k in ('A0','B0','Ar','Br','B_after_Am','B_after_Ar','A_after_Bm','A_after_Br')}
        for key in ('Am','Bm'):states[key]={k:'changed' for k in same}
        return states
    def test_complete_bidirectional_control(self):
        self.assertTrue(comparisons(self.baseline())['targeted_content_passed'])
    def test_peer_content_change_or_missing_mutation_rejected(self):
        for stage in ('B_after_Am','B_after_Ar','A_after_Bm','A_after_Br','Ar','Br'):
            states=self.baseline();states[stage]['review_detail']='drift'
            self.assertFalse(comparisons(states)['targeted_content_passed'])
        states=self.baseline();states['Am']['marker']='base'
        self.assertFalse(comparisons(states)['targeted_content_passed'])
    def test_missing_stage_not_inferred(self):
        states=self.baseline();del states['A_after_Br']
        with self.assertRaises(KeyError):comparisons(states)

if __name__=='__main__':unittest.main()
