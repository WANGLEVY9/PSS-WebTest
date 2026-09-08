import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateIndicoSearch } from '../../src/oracles/indico-visible-search.mjs';

function fakePage({
  url = 'http://localhost:8080/search/?q=test',
  headingCount = 1,
  titles = ['Test Infrastructure Cost Optimization Meeting', 'Web Automation & E2E Testing Summit']
} = {}) {
  return {
    url: () => url,
    getByRole: () => ({ count: async () => headingCount }),
    locator: () => ({
      evaluateAll: async () => titles.map((title, index) => ({ href: `/event/${index + 1}`, title }))
    })
  };
}

test('Indico visible-search oracle requires the exact search route, heading, and matching visible event titles', async () => {
  const result = await evaluateIndicoSearch(fakePage(), 'test');
  assert.equal(result.passed, true);
  assert.equal(result.result_count, 2);
  assert.equal(result.oracle, 'visible-ui-indico-search-v1');
});

test('Indico visible-search oracle rejects an initial route even when titles happen to match', async () => {
  const result = await evaluateIndicoSearch(fakePage({ url: 'http://localhost:8080/' }), 'test');
  assert.equal(result.passed, false);
  assert.equal(result.query_matches, false);
});

test('Indico visible-search oracle rejects nonmatching or empty visible results', async () => {
  const mismatch = await evaluateIndicoSearch(fakePage({ titles: ['Welcome keynote'] }), 'test');
  const empty = await evaluateIndicoSearch(fakePage({ titles: [] }), 'test');
  assert.equal(mismatch.passed, false);
  assert.equal(empty.passed, false);
});
