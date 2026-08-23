import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBookStackOpenBookPage } from '../../src/oracles/bookstack-visible.mjs';

function fakePage({ url, headingCount, text = '' }) {
  return {
    url: () => url,
    locator: () => ({ innerText: async () => text }),
    getByRole: () => ({ count: async () => headingCount })
  };
}

test('BookStack navigation oracle requires a book route and exact heading', async () => {
  const result = await evaluateBookStackOpenBookPage(fakePage({
    url: 'http://127.0.0.1:8081/books/book', headingCount: 1, text: 'Book'
  }));
  assert.equal(result.passed, true);
});

test('BookStack navigation oracle rejects a matching heading on the home route', async () => {
  const result = await evaluateBookStackOpenBookPage(fakePage({
    url: 'http://127.0.0.1:8081/', headingCount: 1, text: 'Book'
  }));
  assert.equal(result.passed, false);
  assert.equal(result.on_book_route, false);
});

test('BookStack navigation oracle rejects a book route without target heading', async () => {
  const result = await evaluateBookStackOpenBookPage(fakePage({
    url: 'http://127.0.0.1:8081/books/book', headingCount: 0, text: 'Other book'
  }));
  assert.equal(result.passed, false);
});

test('BookStack navigation oracle rejects a deeper page route even when text matches', async () => {
  const result = await evaluateBookStackOpenBookPage(fakePage({
    url: 'http://127.0.0.1:8081/books/book/page/book', headingCount: 3, text: 'Book'
  }));
  assert.equal(result.passed, false);
  assert.equal(result.on_book_route, false);
});
