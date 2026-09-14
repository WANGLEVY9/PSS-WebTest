# Provider readiness audit — 2026-09-14

Command:

```bash
PRESTASHOP_BASE_URL=http://127.0.0.1:8083 \
PSS_READINESS_MAX_STEPS=4 PSS_READINESS_ALLOW_BLOCKED=1 \
npm run readiness:provider
```

This is a protocol/plumbing gate on an engineering fixture. It is not a
capability comparison and does not enter any confirmatory denominator.

| Provider stratum | Pure visual | Hybrid | Interpretation |
|---|---|---|---|
| Alibaba Qwen3.7-Flash | ready | ready | canonical click→type→keypress conformance passed |
| DeepSeek V4.1-Flash | ready | ready | canonical click→type→keypress conformance passed |
| Volcengine Doubao Seed 2.1 Pro | blocked | blocked | HTTP 429 Safe Experience/inference limit; external quota boundary |

## Engineering fixes validated by this run

1. The fixture's friendly `/login` route redirects to `/`, so the readiness
   runner and PrestaShop runners now use the canonical
   `/index.php?controller=authentication` route.
2. The Hybrid readiness structure no longer serializes a live DOM handle under
   an `element` key; the allow-listed projection is now boundary-compliant.
3. Normalized Hybrid center coordinates are clamped to integer `[0,1000]`
   values, preventing off-viewport controls from failing schema validation.

The resulting artifact is `code/config/provider-readiness.v0.1.json`; it stores
bounded action/protocol metadata and the quota error category only, never API
keys or credentials. A provider marked `ready` here is eligible for the next
outcome-blind protocol pilot, but does not authorize confirmatory collection.
