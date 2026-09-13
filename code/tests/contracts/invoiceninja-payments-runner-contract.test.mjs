import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Invoice Ninja payments matched controller namespaces aggregate ledger by campaign tag', () => {
  const source = fs.readFileSync(path.resolve('scripts/invoiceninja-payments-matched-pilot.mjs'), 'utf8');
  assert.match(source, /invoiceninja-payments-matched-\$\{tag\}-aggregate\.jsonl/);
  assert.match(source, /invoiceninja-payments-matched-\$\{tag\}-\$\{condition\}-\$\{arm\.id\}-r\$\{label\}/);
  assert.match(source, /PSS_RUN_RECORD_OUT: out/);
});
