export async function installBookStackLayoutMutation(context) {
  await context.addInitScript(() => {
    const install = () => {
      if (!document.head || document.querySelector('#pss-layout-v1')) return;
      const style = document.createElement('style');
      style.id = 'pss-layout-v1';
      style.textContent = `
        html { font-size: 17px !important; }
        body { letter-spacing: 0.01em; }
        .header { min-height: 78px !important; }
        .page-content { max-width: 960px !important; margin-inline: auto !important; }
        .tri-layout-container { column-gap: 28px !important; }
        button, .button { border-radius: 14px !important; }
      `;
      document.head.appendChild(style);
    };
    document.addEventListener('DOMContentLoaded', install, { once: true });
    new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  });
}
