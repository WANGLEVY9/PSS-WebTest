import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBenchmarkArtifactSnapshot } from '../../scripts/audit-benchmark-artifact-snapshot.mjs';

test('downloaded benchmark snapshot agrees with frozen source fingerprints but does not authorize execution', () => {
  const snapshot = buildBenchmarkArtifactSnapshot();
  assert.equal(snapshot.status, 'source-artifacts-verified-admission-pending');
  assert.equal(snapshot.confirmatory_authorized, false);
  assert.deepEqual(Object.fromEntries(Object.entries(snapshot.observations).map(([id, entry]) => [id, entry.source_record_count])), {
    'webarena-verified': 812,
    visualwebarena: 910,
    'autonomous-tester-agent-benchmark': 112
  });
  assert.equal(snapshot.observations['autonomous-tester-agent-benchmark'].archive_md5, 'md5:ba9931778e25bac80bda02f3a9c2e61f');
  assert.ok(snapshot.limitations.some((item) => item.includes('No task screening')));
});
