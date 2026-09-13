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

const FAULT_SENTINEL = 'Test Infrastructure Cost Optimization Meeting';

/** Condition-aware oracle for the search workflow. */
export async function evaluateIndicoSearchCondition(page, query = 'test', condition = 'clean-stable') {
  const clean = await evaluateIndicoSearch(page, query);
  const sentinelVisible = clean.result_titles.includes(FAULT_SENTINEL);
  if (condition !== 'functional-fault') return { ...clean, expected_verdict: 'clean', sentinel_visible: sentinelVisible };
  const faultDetected = clean.query_matches && clean.heading_count > 0 && clean.result_count > 0 && !sentinelVisible;
  return {
    ...clean,
    oracle: 'visible-ui-indico-search-fault-v1',
    expected_verdict: 'fault',
    sentinel_visible: sentinelVisible,
    fault_detected: faultDetected,
    passed: faultDetected
  };
}
