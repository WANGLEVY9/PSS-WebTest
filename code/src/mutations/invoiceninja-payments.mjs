export async function installInvoiceNinjaPaymentOmission(page, { paymentNumber = '0001' } = {}) {
  await page.addInitScript(({ number }) => {
    const install = () => {
      if (!document.body || !location.pathname.startsWith('/payments') || document.querySelector('#pss-invoiceninja-payment-omission')) return;
      const rows = [...document.querySelectorAll('tr')].filter((row) => row.innerText?.includes(number));
      if (!rows.length) return;
      rows.forEach((row) => row.remove());
      const marker = document.createElement('meta');
      marker.id = 'pss-invoiceninja-payment-omission';
      marker.name = 'pss-mutation';
      marker.content = 'visible-payment-row-omission';
      document.head?.appendChild(marker);
    };
    document.addEventListener('DOMContentLoaded', () => {
      install();
      if (document.documentElement) new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
    }, { once: true });
    window.setInterval(install, 100);
  }, { number: paymentNumber });
  return { mutation: 'invoiceninja-visible-payment-omission', paymentNumber };
}

export async function installInvoiceNinjaPaymentMutation(page, mutationId) {
  if (!mutationId) return null;
  if (mutationId === 'invoiceninja-visible-payment-omission') return installInvoiceNinjaPaymentOmission(page);
  throw new Error(`Unknown Invoice Ninja payment mutation: ${mutationId}`);
}

