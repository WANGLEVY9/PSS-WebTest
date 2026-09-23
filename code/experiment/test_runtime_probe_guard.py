import tempfile
import time
import unittest
from pathlib import Path
from probe_lease_guard import ProbeLeaseGuard
from runtime_store import Store


class ProbeGuardTests(unittest.TestCase):
    def setup_store(self, directory):
        store=Store(str(Path(directory)/'ledger.sqlite'))
        store.enqueue([{'opportunity_id':'op','environment_id':'env','schedule_sha256':'a'*64}])
        lease=store.claim(lease_seconds=2)
        store.start('op',lease['lease_token'])
        return store,lease['lease_token']

    def test_slow_synchronous_phase_keeps_lease_without_model_calls(self):
        with tempfile.TemporaryDirectory() as tmp:
            store,token=self.setup_store(tmp)
            guard=ProbeLeaseGuard(store.filename,'op',token,interval=.04,seconds=.3).start()
            try:
                time.sleep(.7)
                guard.stop()
                store.finish('op',token,{'terminal_status':'completed'})
                self.assertEqual(store.db.execute('select state from opportunities').fetchone()[0],'terminal')
            finally:
                guard.stop();store.close()

    def test_expired_lease_cannot_be_revived(self):
        with tempfile.TemporaryDirectory() as tmp:
            store,token=self.setup_store(tmp)
            store.db.execute('update opportunities set lease=0')
            with self.assertRaisesRegex(ValueError,'Stale'):
                ProbeLeaseGuard(store.filename,'op',token).start()
            store.close()

    def test_invalid_interval_rejected(self):
        with self.assertRaises(ValueError):ProbeLeaseGuard('unused','op','token',interval=30,seconds=30)

if __name__=='__main__':unittest.main()
