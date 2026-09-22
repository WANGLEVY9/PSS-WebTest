# PrestaShop native-arm reset result (2026-09-10)

## Scope

This was a bounded infrastructure/reset probe only. No Playwright, visual CUA, Hybrid, fault, evolution, or confirmatory execution was run.

## Result

After removing the local `linux/amd64` compose override, the application image built as native `arm64` and the reset completed:

```text
{"application":"prestashop","status":"ready","url":"http://127.0.0.1:8083","http_status":200}
Customer created successfully.
{"application":"prestashop","status":"seed-verified","counts":[3,19,5,6]}
{"application":"prestashop","status":"reset-complete","compose_file":"third_party/WebTestPilot/webapps/prestashop/docker-compose.yaml"}
```

The readiness fix follows same-SUT redirects before checking the marker. The prior `302 -> http://localhost:8083/ -> 200` redirect was a harness false negative, not an agent failure. The final reset/seed evidence is still only one successful trial; image digest pinning, repeated reset stability, an independent cart/order oracle, fault/evolution isolation, and the three-arm matched pilot remain open.

## Admission status

PrestaShop remains `candidate-unverified` and outside every empirical denominator. This result advances only the reset/ready/seed gate; it does not admit the application for confirmatory collection.

