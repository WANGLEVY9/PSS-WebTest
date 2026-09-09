import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const sutUrl = process.env.BOOKSTACK_BASE_URL || 'http://127.0.0.1:8081';
const outputPath = resolve(projectRoot, process.env.PSS_FRAMEWORK_SMOKE_OUT || '../research/framework-install-smoke-2026-09-09.json');

function pythonImport(executable, moduleName) {
  if (!executable) return { configured: false, imported: false, detail: 'interpreter not configured' };
  const result = spawnSync(executable, ['-c', `import ${moduleName}; print('import_ok')`], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return {
    configured: true,
    imported: result.status === 0 && result.stdout.includes('import_ok'),
    executable,
    detail: result.status === 0 ? 'import_ok' : (result.stderr || `exit_${result.status}`).trim().slice(0, 240)
  };
}

async function stagehandSmoke() {
  try {
    const { Stagehand } = await import('@browserbasehq/stagehand');
    const stagehand = new Stagehand({
      env: 'LOCAL',
      localBrowserLaunchOptions: { headless: true, viewport: { width: 1280, height: 720 } },
      enableTracing: false
    });
    try {
      await stagehand.init();
      const page = stagehand.context.pages()[0];
      await page.goto(`${sutUrl}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return { imported: true, local_browser: true, observed_path: new URL(page.url()).pathname, task_adapter: 'pending' };
    } finally {
      await stagehand.close();
    }
  } catch (error) {
    return { imported: false, local_browser: false, task_adapter: 'pending', error: String(error).slice(0, 400) };
  }
}

const stagehand = await stagehandSmoke();
const browserUse = pythonImport(process.env.PSS_BROWSER_USE_PYTHON || process.env.PSS_BROWSER_USE_BIN, 'browser_use');
const agentlab = pythonImport(process.env.PSS_AGENTLAB_PYTHON || process.env.PSS_AGENTLAB_BIN, 'agentlab');
const browsergym = pythonImport(process.env.PSS_AGENTLAB_PYTHON || process.env.PSS_AGENTLAB_BIN, 'browsergym');
const result = {
  schema_version: 'framework-install-smoke.v1',
  generated_at: new Date().toISOString(),
  sut: 'BookStack',
  sut_url: sutUrl,
  evidence_scope: 'package/import/local-browser smoke only; no model-backed task success claim',
  variants: {
    stagehand: { ...stagehand, task_adapter: 'pending' },
    browser_use: { ...browserUse, task_adapter: 'pending' },
    agentlab_browsergym: { ...agentlab, browsergym_imported: browsergym.imported, task_adapter: 'pending' }
  },
  native_semantic_hybrid: { status: 'implemented', evidence: 'see research/framework-variant-smoke-2026-09-09.json' },
  fail_closed: true
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ ...result, output: outputPath }, null, 2));
