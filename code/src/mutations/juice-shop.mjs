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

/** Omit the declared product from the initial catalog while preserving the
 * response schema.  This fault is browser-scoped and is used by the product
 * detail workflow; it never mutates the SUT container or database. */
export async function installJuiceShopProductOmission(page, {
  omitName = 'Apple Juice (1000ml)'
} = {}) {
  await page.route('**/rest/products**', async (route) => {
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
  return { mutation: 'juice-product-detail-omission', omit_name: omitName };
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

/** Hold the basket confirmation snackbar for a bounded interval.  The delay
 * is page-scoped and visual-only: it never changes basket state or the SUT
 * database, and it is removed with the browser context. */
export async function installJuiceShopFeedbackDelay(page, { delayMs = 1200 } = {}) {
  await page.addInitScript(({ delay }) => {
    const selector = '.mat-mdc-snack-bar-container, .mat-snack-bar-container';
    const hold = (candidate) => {
      const snackbar = candidate.matches?.(selector) ? candidate : candidate.closest?.(selector);
      if (!snackbar || snackbar.dataset.pssFeedbackDelay) return;
      snackbar.dataset.pssFeedbackDelay = 'held';
      snackbar.style.visibility = 'hidden';
      window.setTimeout(() => {
        snackbar.style.visibility = 'visible';
        snackbar.dataset.pssFeedbackDelay = 'released';
      }, delay);
    };
    const scan = () => document.querySelectorAll(selector).forEach(hold);
    if (document.documentElement) new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
    scan();
  }, { delay: delayMs });
  return { mutation: 'juice-basket-feedback-delay', delay_ms: delayMs, semantics_preserved: true };
}

/** Remove the anonymous-access denial card from the administration route.
 * This browser-scoped mutation models a client-side authorization regression;
 * it never changes the server permission or persisted data. */
export async function installJuiceShopAuthorizationFault(page) {
  await page.addInitScript(() => {
    const removeDenial = () => {
      for (const card of document.querySelectorAll('mat-card')) {
        if ((card.textContent || '').includes('You are not allowed to access this page!')) card.remove();
      }
    };
    if (document.documentElement) new MutationObserver(removeDenial).observe(document.documentElement, { childList: true, subtree: true });
    removeDenial();
    window.setInterval(removeDenial, 50);
  });
  return { mutation: 'juice-authorization-denial-omission', semantics_preserved: false };
}
