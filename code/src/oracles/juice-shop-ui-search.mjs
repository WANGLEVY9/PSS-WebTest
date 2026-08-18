const EXPECTED_PRODUCT_NAMES = Object.freeze([
  'Apple Juice (1000ml)',
  'Apple Pomace',
  'Pineapple Juice (1000ml)'
]);

/**
 * Evaluate the visible post-condition of the Juice Shop search task.
 *
 * This evaluator is intentionally separate from the model trajectory and
 * does not call the REST API.  It checks that the browser is in the search
 * route, that the query is present in the search textbox, and that the
 * expected result cards are visible while the known negative control is not.
 */
export async function evaluateJuiceShopUiSearch(page, {
  query = 'apple',
  expectedNames = EXPECTED_PRODUCT_NAMES,
  negativeNames = ['Banana Juice (1000ml)']
} = {}) {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const textbox = page.getByRole('textbox').first();
  const textboxVisible = await textbox.isVisible().catch(() => false);
  const textboxValue = textboxVisible ? await textbox.inputValue().catch(() => '') : '';
  const location = page.url();
  const normalizedLocation = decodeURIComponent(location).toLowerCase();
  const queryInRoute = normalizedLocation.includes(String(query).toLowerCase());
  const visibleExpected = [];
  for (const name of expectedNames) {
    const visible = await page.getByText(name, { exact: true }).isVisible().catch(() => false);
    if (visible) visibleExpected.push(name);
  }
  const visibleNegative = [];
  for (const name of negativeNames) {
    const visible = await page.getByText(name, { exact: true }).isVisible().catch(() => false);
    if (visible) visibleNegative.push(name);
  }
  // Juice Shop may hide the search textbox after navigation to the result
  // route. In that state the route query is the authoritative visible
  // postcondition; when the textbox remains visible, its value must agree.
  const queryMatchesTextbox = !textboxVisible || textboxValue.trim().toLowerCase() === String(query).trim().toLowerCase();
  const passed = Boolean(
    queryInRoute &&
    queryMatchesTextbox &&
    visibleExpected.length === expectedNames.length &&
    visibleNegative.length === 0
  );
  return {
    oracle: 'visible-ui-search-postcondition',
    authority: 'visible-state',
    query,
    location,
    query_in_route: queryInRoute,
    textbox_visible: textboxVisible,
    textbox_value: textboxValue,
    query_matches_textbox: queryMatchesTextbox,
    expected_names: [...expectedNames],
    visible_expected_names: visibleExpected,
    negative_names: [...negativeNames],
    visible_negative_names: visibleNegative,
    body_contains_expected: expectedNames.filter((name) => bodyText.includes(name)),
    passed
  };
}

export { EXPECTED_PRODUCT_NAMES };
