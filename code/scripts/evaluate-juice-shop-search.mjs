import process from 'node:process';

const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const query = process.env.PSS_JUICE_SHOP_QUERY ?? 'apple';
const expectedNames = [
  'Apple Juice (1000ml)',
  'Apple Pomace',
  'Pineapple Juice (1000ml)'
];

const response = await fetch(`${baseURL}/rest/products/search?q=${encodeURIComponent(query)}`);
let payload;
try {
  payload = await response.json();
} catch (error) {
  throw new Error(`Juice Shop oracle returned non-JSON HTTP ${response.status}: ${error.message}`);
}

const names = Array.isArray(payload?.data) ? payload.data.map((product) => product.name) : [];
const matches = response.status === 200 && names.length === expectedNames.length && expectedNames.every((name, index) => names[index] === name);
const result = {
  application: 'juice-shop',
  oracle: 'rest-product-state',
  query,
  expected_names: expectedNames,
  observed_names: names,
  http_status: response.status,
  matches,
  passed: matches,
  evaluated_at: new Date().toISOString()
};
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
