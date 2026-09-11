/**
 * Bounded, secret-safe probe for a Volcengine Ark embedding profile.
 *
 * Usage (with an ignored local profile):
 *   set -a; source .env.volcengine-embedding; set +a
 *   node scripts/check-volcengine-embedding.mjs
 *
 * This deliberately sends text only. Screenshot embedding is a separate
 * experiment and must not be enabled implicitly by a connectivity check.
 */
const provider = process.env.VOLCENGINE_EMBEDDING_PROVIDER;
const model = process.env.VOLCENGINE_EMBEDDING_MODEL;
const apiKey = process.env.VOLCENGINE_EMBEDDING_API_KEY;
const baseUrl = (process.env.VOLCENGINE_EMBEDDING_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');

if (!provider || !model || !apiKey) {
  console.error(JSON.stringify({ status: 'not_configured', required: ['VOLCENGINE_EMBEDDING_PROVIDER', 'VOLCENGINE_EMBEDDING_MODEL', 'VOLCENGINE_EMBEDDING_API_KEY'] }));
  process.exitCode = 2;
} else {
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: ['pss-webtest connectivity probe'] })
  });
  const payload = await response.json().catch(() => ({}));
  const embedding = payload.data?.[0]?.embedding;
  console.log(JSON.stringify({
    provider,
    model,
    base_url: baseUrl,
    status: response.ok ? 'ok' : 'provider_error',
    http_status: response.status,
    error_code: payload.error?.code ?? null,
    error_type: payload.error?.type ?? null,
    embedding_dimensions: Array.isArray(embedding) ? embedding.length : null,
    usage_present: Boolean(payload.usage)
  }));
  if (!response.ok) process.exitCode = 1;
}
