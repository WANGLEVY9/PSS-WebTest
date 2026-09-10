import fs from 'node:fs';
import path from 'node:path';

const configPath = path.resolve(new URL('../config/prestashop-mutations.v0.1.json', import.meta.url).pathname);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const definitions = new Map(config.mutations.map((mutation) => [mutation.id, mutation]));

export function listPrestashopMutations() {
  return config.mutations.map((mutation) => ({ ...mutation }));
}

export function getPrestashopMutation(id) {
  const mutation = definitions.get(id);
  if (!mutation) throw new Error(`Unknown PrestaShop mutation: ${id}`);
  return { ...mutation };
}

/**
 * Apply a condition controller after the page has reached its declared
 * trigger. The controller is page-local and deliberately does not touch the
 * database, browser storage, hidden oracle, or agent observation payload.
 */
export async function applyPrestashopMutation(page, id) {
  const mutation = getPrestashopMutation(id);
  if (mutation.trigger !== 'search-results') throw new Error(`Unsupported trigger: ${mutation.trigger}`);
  return page.evaluate((definition) => {
    if (definition.id === 'search-result-label-omission') {
      const links = [...document.querySelectorAll('.product-description .product-title a')];
      const target = links.find((link) => link.textContent.trim() === definition.target_text);
      if (!target) return { applied: false, changed: 0, marker: null };
      target.textContent = definition.replacement_text;
      target.dataset.pssMutation = definition.id;
      return { applied: true, changed: 1, marker: definition.id };
    }
    if (definition.id === 'search-layout-preserving-v1') {
      const style = document.createElement('style');
      style.id = 'pss-webtest-search-layout-preserving-v1';
      style.textContent = '#js-product-list .product-title { min-height: 3.4rem; letter-spacing: .01em; }';
      document.head.appendChild(style);
      document.documentElement.dataset.pssMutation = definition.id;
      return { applied: true, changed: 1, marker: definition.id };
    }
    return { applied: false, changed: 0, marker: null };
  }, mutation);
}

export function mutationConfigPath() {
  return configPath;
}
