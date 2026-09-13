/**
 * Behavior-preserving Indico UI evolution.  It changes presentation only and
 * is installed in the browser context, keeping the server/database pristine.
 */
export async function installIndicoLayoutEvolution(page) {
  await page.addInitScript(() => {
    const install = () => {
      if (!document.head || document.querySelector('#pss-indico-layout-v1')) return;
      const style = document.createElement('style');
      style.id = 'pss-indico-layout-v1';
      style.textContent = `
        body { letter-spacing: 0.012em; }
        .toolbar, .header { min-height: 68px !important; }
        .form-group { margin-bottom: 1.35rem !important; }
        button, input, select, textarea { border-radius: 8px !important; }
      `;
      document.head.appendChild(style);
    };
    document.addEventListener('DOMContentLoaded', install, { once: true });
    new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  });
  return { mutation: 'indico-layout-v1', semantics_preserved: true };
}

/**
 * Functional search fault: remove one known matching result after the search
 * page renders. It is browser-context scoped and leaves the Indico database
 * untouched, so the independent oracle can distinguish it from reset or DB
 * corruption.
 */
export async function installIndicoSearchOmission(page) {
  await page.addInitScript(() => {
    const install = () => {
      if (document.querySelector('#pss-indico-search-omission-v1')) return;
      const marker = document.createElement('meta');
      marker.id = 'pss-indico-search-omission-v1';
      marker.dataset.pssMutation = 'search-result-omission-v1';
      document.head?.appendChild(marker);
      const removeKnownResult = () => {
        const links = [...document.querySelectorAll('main a[href^="/event/"]')];
        const target = links.find((link) => link.textContent?.replace(/\s+/g, ' ').trim() === 'Test Infrastructure Cost Optimization Meeting');
        if (target) target.remove();
      };
      removeKnownResult();
      new MutationObserver(removeKnownResult).observe(document.body, { childList: true, subtree: true });
    };
    document.addEventListener('DOMContentLoaded', install, { once: true });
    new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  });
  return { mutation: 'indico-search-omission-v1', semantics_preserved: false, scope: 'known-search-result-only' };
}
