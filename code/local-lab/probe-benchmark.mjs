import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Import only after context is selected: the original probe binds env at module load.
process.env.PSS_WEBARENA_DOCKER_CONTEXT = "colima-webarena-x86";
process.env.PSS_WEBARENA_SHOPPING_CONTAINER = "webarena-verified-shopping-x86";
process.env.PSS_WEBARENA_HEALTH_MAX_POLLS = "1";
const { probeWebArenaShoppingGate } = await import(
  "../scripts/probe-webarena-shopping-gate.mjs"
);
const r = await probeWebArenaShoppingGate();
const safe = {
  observed_at: r.observed_at,
  benchmark_id: r.benchmark_id,
  expected_image: r.expected_image,
  image_matches: r.image_matches,
  architecture_compatible: r.architecture_compatible,
  services: r.controller?.json?.details?.value?.services,
  controller_success: r.controller?.json?.success,
  site_status: r.site?.status,
  ready: r.ready,
  study_execution_allowed: false,
};
try {
  const res = await fetch("http://127.0.0.1:7770/", {
    signal: AbortSignal.timeout(20000),
  });
  safe.navigation_status = res.status;
  safe.navigation_url = res.url;
  safe.navigation_verified = res.ok;
} catch (e) {
  safe.navigation_verified = false;
  safe.navigation_error = e.name;
}
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../artifacts/local-runtime",
);
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(
  path.join(root, "benchmark-readiness.json"),
  JSON.stringify(safe, null, 2),
);
console.log(JSON.stringify(safe, null, 2));
