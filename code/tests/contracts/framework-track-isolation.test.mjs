import assert from 'node:assert/strict';
import test from 'node:test';
import { loadFrameworkManifest } from '../../src/framework-version.mjs';

const manifest = loadFrameworkManifest();
const byFramework = new Map();
for (const environment of manifest.environments) {
  if (!byFramework.has(environment.framework_id)) byFramework.set(environment.framework_id, []);
  byFramework.get(environment.framework_id).push(environment);
}

test('every framework environment belongs to exactly one track', () => {
  for (const environment of manifest.environments) {
    assert.ok(['historical', 'latest'].includes(environment.track), `${environment.environment_id} has track ${environment.track}`);
  }
});

test('historical and latest use distinct environment ids so a record cannot be ambiguous', () => {
  for (const [frameworkId, environments] of byFramework) {
    const ids = environments.map((environment) => environment.environment_id);
    assert.equal(new Set(ids).size, ids.length, `${frameworkId} reuses an environment id across tracks`);
    const tracks = environments.map((environment) => environment.track);
    assert.equal(new Set(tracks).size, tracks.length, `${frameworkId} declares the same track twice`);
  }
});

test('a collapsed latest track is recorded as collapsed, not as a second stratum', () => {
  for (const [frameworkId, environments] of byFramework) {
    const historical = environments.find((environment) => environment.track === 'historical');
    const latest = environments.find((environment) => environment.track === 'latest');
    if (!historical || !latest) continue;
    if (latest.install_status === 'collapsed-to-historical') {
      assert.equal(latest.track_equivalence.collapsed, true, `${frameworkId} latest track is collapsed but not marked`);
      assert.equal(latest.track_equivalence.version, historical.resolved.version, `${frameworkId} collapsed track must record the shared version`);
    } else {
      assert.equal(latest.track_equivalence.collapsed, false, `${frameworkId} latest track is distinct but not marked as such`);
      assert.notEqual(latest.resolved.version, historical.resolved.version, `${frameworkId} claims a distinct latest track with the same version`);
    }
  }
});

test('no framework environment claims a version it did not resolve', () => {
  for (const environment of manifest.environments) {
    if (environment.install_status === 'installed') {
      assert.ok(environment.resolved?.version, `${environment.environment_id} is installed but has no resolved version`);
    }
    if (environment.install_status === 'collapsed-to-historical') {
      assert.equal(environment.resolved, null, `${environment.environment_id} is collapsed and must not claim a resolution`);
    }
  }
});

test('a framework environment never declares both a companion and a mismatched track', () => {
  for (const environment of manifest.environments) {
    for (const companion of environment.companion_distributions ?? []) {
      assert.notEqual(companion, environment.distribution, `${environment.environment_id} lists itself as a companion`);
    }
  }
});

test('the manifest states that tracks are never pooled', () => {
  assert.equal(manifest.tracks.historical.pooling, 'never-pooled');
  assert.equal(manifest.tracks.latest.pooling, 'never-pooled');
});
