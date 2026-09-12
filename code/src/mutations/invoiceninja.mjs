/**
 * Invoice Ninja mutations are page/context-local. They do not modify the
 * application database or container, which makes apply/remove/isolation
 * checks cheap and reversible.
 */

export async function installInvoiceNinjaLayoutEvolution(page) {
  await page.addInitScript(() => {
    const install = () => {
      if (!document.head || document.querySelector('#pss-invoiceninja-layout-v1')) return;
      const style = document.createElement('style');
      style.id = 'pss-invoiceninja-layout-v1';
      style.textContent = `
        nav a { letter-spacing: 0.018em !important; }
        main, [role="main"] { padding-top: 12px !important; }
        button, input, select, textarea { border-radius: 10px !important; }
      `;
      document.head.appendChild(style);
    };
    document.addEventListener('DOMContentLoaded', install, { once: true });
    new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  });
  return { mutation: 'invoiceninja-layout-v1', semantics_preserved: true };
}

export async function installInvoiceNinjaVisibleNumberMismatch(page, {
  replacement = '999999'
} = {}) {
  await page.addInitScript(({ replacementText }) => {
    const install = () => {
      if (!document.body || document.querySelector('#pss-invoiceninja-number-mismatch')) return;
      const path = window.location.pathname;
      if (!path.includes('/invoices/')) return;
      const inputs = [...document.querySelectorAll('input')].filter((input) => {
        const rect = input.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && input.value === '123456';
      });
      for (const input of inputs) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, replacementText);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (node.nodeValue?.includes('123456')) node.nodeValue = node.nodeValue.replaceAll('123456', replacementText);
      }
      if (!inputs.length && !document.body.innerText.includes(replacementText)) return;
      const marker = document.createElement('meta');
      marker.id = 'pss-invoiceninja-number-mismatch';
      marker.name = 'pss-mutation';
      marker.content = 'visible-invoice-number-mismatch';
      document.head?.appendChild(marker);
    };
    document.addEventListener('DOMContentLoaded', () => {
      install();
      if (document.documentElement) new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
    }, { once: true });
    window.setInterval(install, 100);
  }, { replacementText: replacement });
  return { mutation: 'invoiceninja-visible-number-mismatch', replacement };
}

export async function installInvoiceNinjaMutation(page, mutationId) {
  if (!mutationId) return null;
  if (mutationId === 'invoiceninja-layout-v1') return installInvoiceNinjaLayoutEvolution(page);
  if (mutationId === 'invoiceninja-visible-number-mismatch') return installInvoiceNinjaVisibleNumberMismatch(page);
  throw new Error(`Unknown Invoice Ninja mutation: ${mutationId}`);
}
