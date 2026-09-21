// Shared single-attempt transport; retry ownership stays at the decision loop.
export async function fetchJsonOnce(fetchImpl, url, init, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const expired = new Promise((_, reject) => { timer = setTimeout(() => {
    controller.abort(); reject(new Error('CUA request deadline exceeded'));
  }, timeoutMs); });
  try {
    return await Promise.race([expired, (async () => {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      const payload = await response.json();
      return { response, payload };
    })()]);
  } catch (error) {
    error.transport = true;
    error.retryable = false; // Delivery may be ambiguous; do not replay on network/body timeout.
    throw error;
  } finally { clearTimeout(timer); }
}
