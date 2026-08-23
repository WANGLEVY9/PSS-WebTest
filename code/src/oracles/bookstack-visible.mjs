/**
 * Independent post-run oracle for the navigation task.  It receives only the
 * browser page after the agent terminates; its result is never included in an
 * observation and is not used to select an action.
 */
export async function evaluateBookStackOpenBookPage(page, targetBook = 'Book') {
  const url = page.url();
  const main = page.locator('main');
  const visibleText = await main.innerText().catch(() => '');
  const heading = page.getByRole('heading', { name: targetBook, exact: true });
  const headingCount = await heading.count().catch(() => 0);
  // A book overview is exactly /books/<slug>.  Deeper routes such as
  // /books/<slug>/chapter/... or /books/<slug>/page/... are not success.
  const onBookRoute = /^\/books\/[^/?#]+\/?$/.test(new URL(url).pathname);
  const passed = onBookRoute && headingCount > 0;
  return {
    oracle: 'visible-ui-navigation',
    target_book: targetBook,
    url,
    on_book_route: onBookRoute,
    heading_count: headingCount,
    visible_text_contains_target: visibleText.includes(targetBook),
    passed,
    evaluated_at: new Date().toISOString()
  };
}
