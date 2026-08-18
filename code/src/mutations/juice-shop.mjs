/**
 * Deterministic Juice Shop mutations used by the experiment harness.
 *
 * These mutations are installed on an individual Playwright page/context and
 * are therefore reversible and cannot leak into the SUT container or another
 * run.  They deliberately preserve HTTP status and the response schema.
 */

export async function installJuiceShopSearchOmission(page, {
  omitName = 'Apple Pomace'
} = {}) {
  const pattern = '**/rest/products/search**';
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const filtered = data.filter((product) => product?.name !== omitName);
    await route.fulfill({
      response,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ ...payload, data: filtered })
    });
  });
  return { mutation: 'juice-search-result-omission', omit_name: omitName };
}

export async function installJuiceShopLayoutEvolution(page) {
  await page.addInitScript(() => {
    const install = () => {
      if (!document.head || document.querySelector('#pss-juice-layout-v1')) return;
      const style = document.createElement('style');
      style.id = 'pss-juice-layout-v1';
      style.textContent = `
        mat-card { border-radius: 18px !important; }
        mat-grid-tile { padding: 6px !important; }
        .mat-toolbar { min-height: 72px !important; }
      `;
      document.head.appendChild(style);
    };
    document.addEventListener('DOMContentLoaded', install, { once: true });
    new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  });
  return { mutation: 'juice-layout-v1', semantics_preserved: true };
}

