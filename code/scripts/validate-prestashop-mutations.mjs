import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const configPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(codeRoot, 'config/prestashop-mutations.v0.1.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const errors = [];
const ids = new Set();
const conditions = new Set(['functional-fault', 'ui-evolution']);
if (config.schema_version !== '0.1') errors.push('schema_version must be 0.1');
if (config.application_id !== 'prestashop') errors.push('application_id must be prestashop');
if (config.status !== 'candidate-not-admitted') errors.push('mutation catalog must remain candidate-not-admitted');
if (config.oracle_contract?.authority !== 'independent-database') errors.push('oracle contract must be independent-database');
if (config.oracle_contract?.hidden_from_testing_arms !== true) errors.push('oracle must be hidden from testing arms');
if (!Array.isArray(config.mutations) || config.mutations.length < 2) errors.push('at least one fault and one evolution mutation are required');
for (const [index, mutation] of (config.mutations ?? []).entries()) {
  const location = `mutations[${index}]`;
  if (!mutation.id || ids.has(mutation.id)) errors.push(`${location}.id must be present and unique`);
  ids.add(mutation.id);
  if (!conditions.has(mutation.condition)) errors.push(`${location}.condition must be functional-fault or ui-evolution`);
  if (mutation.trigger !== 'search-results') errors.push(`${location}.trigger must be search-results`);
  if (!mutation.mechanism) errors.push(`${location}.mechanism must be declared`);
  if (!mutation.expected_invariant) errors.push(`${location}.expected_invariant must be declared`);
  if (mutation.status !== 'candidate') errors.push(`${location}.status must remain candidate until the live gate passes`);
  if (mutation.condition === 'functional-fault' && (!mutation.target_text || !mutation.replacement_text)) errors.push(`${location} fault must declare target_text and replacement_text`);
}
if (!(config.mutations ?? []).some((mutation) => mutation.condition === 'functional-fault')) errors.push('fault coverage is missing');
if (!(config.mutations ?? []).some((mutation) => mutation.condition === 'ui-evolution')) errors.push('evolution coverage is missing');
if (errors.length) {
  console.error(`PrestaShop mutation validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PrestaShop mutation validation passed: ${ids.size} candidate controllers; admission remains closed.`);
}
