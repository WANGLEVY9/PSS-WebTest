/** Browser-scoped mutation for the pagination workflow. */
export async function installJuiceShopPaginationOmission(page, {
  omitName = 'Lemon Juice (500ml)'
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
  return { mutation: 'juice-pagination-target-omission', omit_name: omitName };
}

export const JUICE_SHOP_PAGINATION_TARGET = 'Lemon Juice (500ml)';
export const JUICE_SHOP_PAGINATION_LAST_ITEM_TARGET = 'OWASP Juice Shop Sticker Page';
