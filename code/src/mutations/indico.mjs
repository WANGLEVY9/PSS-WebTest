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

