import { argv, exit } from 'node:process';

const baseURL = argv[2] ?? process.env.SUT_BASE_URL;
const timeoutMs = Number(process.env.SUT_READY_TIMEOUT_MS ?? 5000);

if (!baseURL) {
  console.error(JSON.stringify({ status: 'not-configured', reason: 'Set SUT_BASE_URL or pass a URL argument.' }));
  exit(2);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
try {
  const response = await fetch(new URL('/', baseURL), { signal: controller.signal, redirect: 'manual' });
  const result = {
    status: response.ok || response.status === 3_0_1 || response.status === 3_0_2 ? 'reachable' : 'http-error',
    url: baseURL,
    http_status: response.status,
    checked_at: new Date().toISOString()
  };
  console.log(JSON.stringify(result));
  exit(result.status === 'reachable' ? 0 : 1);
} catch (error) {
  console.error(JSON.stringify({
    status: error.name === 'AbortError' ? 'timeout' : 'unreachable',
    url: baseURL,
    error: error.message,
    checked_at: new Date().toISOString()
  }));
  exit(1);
} finally {
  clearTimeout(timer);
}
