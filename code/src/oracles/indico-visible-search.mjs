/**
 * Independent visible-UI oracle for the benchmark-derived Indico search task.
 * It is evaluated only after an arm has stopped and is never supplied to a
 * model decision or scripted action.
 */
export async function evaluateIndicoSearch(page, query = 'test') {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const url = new URL(page.url());
  const heading = page.getByRole('heading', { name: 'Search', exact: true });
  const [headingCount, links] = await Promise.all([
    heading.count().catch(() => 0),
    page.locator('main a[href^="/event/"]').evaluateAll((elements) => elements.map((element) => ({
      href: element.getAttribute('href'),
      title: element.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    }))).catch(() => [])
  ]);
  const queryMatches = url.pathname === '/search/' && url.searchParams.get('q') === query;
  const titlesMatch = links.length > 0 && links.every((item) => item.title.toLocaleLowerCase().includes(normalizedQuery));
  return {
    oracle: 'visible-ui-indico-search-v1', query, url: page.url(), query_matches: queryMatches,
    heading_count: headingCount, result_count: links.length, result_titles: links.map((item) => item.title),
    all_titles_match_query: titlesMatch, passed: queryMatches && headingCount > 0 && titlesMatch,
    evaluated_at: new Date().toISOString()
  };
}
