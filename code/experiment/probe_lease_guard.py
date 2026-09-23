"""Supervisor heartbeat for slow synchronous acceptance-probe phases.

Uses its own SQLite connection. Never revives an expired lease or removes a
fence. Actor-side ownership checks remain mandatory before every mutation.
"""
import threading
from runtime_store import Store


class ProbeLeaseGuard:
    def __init__(self, database, opportunity, token, interval=5, seconds=30):
        if not 0 < interval < seconds:
            raise ValueError('Heartbeat interval must be shorter than lease')
        self.database, self.opportunity, self.token = database, opportunity, token
        self.interval, self.seconds = interval, seconds
        self.stopped = threading.Event()
        self.error = None
        self.thread = None

    def beat(self):
        store = Store(self.database)
        try:
            store.heartbeat(self.opportunity, self.token, seconds=self.seconds)
        finally:
            store.close()

    def start(self):
        self.beat()  # Fail synchronously before external effects.
        def loop():
            while not self.stopped.wait(self.interval):
                try:
                    self.beat()
                except Exception as exc:
                    self.error = exc
                    self.stopped.set()
        self.thread = threading.Thread(target=loop, name='probe-lease-supervisor', daemon=True)
        self.thread.start()
        return self

    def stop(self):
        self.stopped.set()
        if self.thread:
            self.thread.join()
        if self.error:
            raise RuntimeError('Supervisor lease lost; execution must remain unresolved') from self.error
