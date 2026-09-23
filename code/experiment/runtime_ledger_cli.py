import json
import sys
from runtime_store import Store
store = Store(sys.argv[2])
try:
    payload = json.load(sys.stdin)
    if sys.argv[1] == 'reserve':
        store.reserve(**payload)
    elif sys.argv[1] == 'settle':
        store.settle(**payload)
    else:
        raise ValueError('Unknown ledger command')
    print('{"persisted":true}')
finally:
    store.close()
