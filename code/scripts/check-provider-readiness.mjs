#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
// Executable provider-readiness gate.
//
// `npm run check:agent` only proves that the provider environment variables are
// present.  That was not enough: the PrestaShop aligned block showed that a
// provider can be fully configured and still never issue the `type` action.
// This gate therefore requires a real, screenshot-only `click -> type ->
// keypress` conformance trace (plus a hybrid semantic-grounding trace) before a
// profile may enter a matched cell.
//
// Evidence boundary: this is a protocol/plumbing gate, not a capability result.
// A failure here says the provider profile cannot execute the declared action
// protocol on this fixture; it is not a comparison of strategy families.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createAgentAdapter } from '../src/arms/agent-adapter.mjs';
import { createVolcengineCuaDriver } from '../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../src/arms/volcengine-hybrid-driver.mjs';
import { resolveAgentOptimization } from '../src/agent-optimization.mjs';
import { loadProviderProfileManifest } from '../src/provider-profile.mjs';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const readinessPath = path.join(codeRoot, 'config', 'provider-readiness.v0.1.json');
const baseURL = process.env.PRESTASHOP_BASE_URL ?? 'http://localhost:8083';
const query = process.env.PSS_PRESTASHOP_QUERY ?? 'Mug';
const viewport = { width: 1280, height: 720 };
const maxSteps = Number.parseInt(process.env.PSS_READINESS_MAX_STEPS ?? '6', 10);
const arms = (process.env.PSS_READINESS_ARMS ?? 'visual,hybrid').split(',').map((arm) => arm.trim()).filter(Boolean);

const requestedProviders = new Set(process.argv.slice(2).filter((argument) => !argument.startsWith('-')));
const gateStatuses = new Set(['frozen-pilot']);

function readEnvFile(name) {
  const envPath = path.join(codeRoot, name);
  if (!fs.existsSync(envPath)) throw new Error(`local env file is missing: ${name}`);
  return dotenv.parse(fs.readFileSync(envPath));
}

function profileEnv(profile) {
  // SUT fixture credentials are fixture-level and shared by every provider
  // stratum; only the CUA_* provider settings are profile-specific. The
  // profile file is applied last so provider settings can never bleed between
  // strata during a single gate run.
  const env = { ...process.env, ...readEnvFile('.env') };
  if (profile.local_env_file) Object.assign(env, readEnvFile(profile.local_env_file));
  env.PSS_REQUIRE_FROZEN_PROFILE = '1';
  env.PSS_AGENT_PROFILE = profile.optimization_profile;
  return env;
}

function containsSequence(actions, expected) {
  let index = 0;
  const matched = [];
  for (const [position, action] of actions.entries()) {
    if (action.type === expected[index]) {
      matched.push({ position, type: action.type, action });
      index += 1;
      if (index === expected.length) return { passed: true, matched };
    }
  }
  return { passed: false, matched, missing: expected.slice(index) };
}

async function login(page, env) {
  const username = env.PSS_PRESTASHOP_USERNAME;
  const password = env.PSS_PRESTASHOP_PASSWORD;
  if (!username || !password) throw new Error('PSS_PRESTASHOP_USERNAME/PSS_PRESTASHOP_PASSWORD are not available for this profile');
  // This fixture's friendly `/login` route redirects to `/` and therefore
  // hides the authentication form. Use PrestaShop's canonical controller
  // route for a deterministic login preamble.
  await page.goto(`${baseURL}/index.php?controller=authentication`, { waitUntil: 'domcontentloaded' });
  await page.locator('#field-email').fill(username);
  await page.locator('#field-password').fill(password);
  await page.locator('#submit-login').click();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('input[name="s"]').waitFor({ state: 'visible', timeout: 15000 });
}

async function structure(page) {
  const controls = await page.locator('a,button,input:not([type="hidden"]),textarea,[role="button"]').evaluateAll((elements) => {
    const visible = elements.map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return null;
      const role = element.tagName === 'A' ? 'link' : element.tagName === 'BUTTON' ? 'button' : element.getAttribute('role') || (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' ? 'textbox' : element.tagName.toLowerCase());
      const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.getAttribute('placeholder') || element.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
      const normalize = (value, extent) => Math.max(0, Math.min(1000, Math.round(value * 1000 / extent)));
      return { element, role, name, interaction: role === 'textbox' ? 'type' : 'click', center_normalized_1000: { x: normalize(rect.x + rect.width / 2, innerWidth), y: normalize(rect.y + rect.height / 2, innerHeight) } };
    }).filter(Boolean).slice(0, 120);
    visible.forEach((item, index) => { item.element.dataset.pssTargetId = `c${index}`; });
    // Do not retain the live DOM handle even as an `undefined` property. The
    // hybrid boundary validator rejects the key itself, because a serialized
    // structure must contain only the allow-listed visible-interactable
    // projection.
    return visible.map((item, index) => {
      const { element: _liveElement, ...safe } = item;
      return { ...safe, target_id: `c${index}` };
    });
  });
  return { controls };
}

async function runArm({ profile, env, arm }) {
  const optimization = resolveAgentOptimization({ env: { ...env, PSS_AGENT_PROFILE: profile.optimization_profile }, arm, taskFamily: 'navigation' });
  const hybridActionMode = env.CUA_HYBRID_ACTION_MODE ?? optimization.hybrid_action_mode ?? 'coordinate';
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const startedAt = Date.now();
  const outcome = { arm, status: 'failed', actions: [], conformance: null, error: null, elapsed_ms: 0 };
  try {
    await login(page, env);
    const observe = async () => {
      const image = await page.screenshot({ type: 'jpeg', quality: 80, animations: 'disabled' });
      const state = { url: page.url() };
      if (arm === 'visual') return { screenshot: `data:image/jpeg;base64,${image.toString('base64')}` };
      return { screenshot: image.toString('base64'), pageStructure: await structure(page), viewport };
    };
    const executeAction = async (action) => {
      if (['click', 'double_click'].includes(action.type) && (action.x < 0 || action.y < 0 || action.x >= viewport.width || action.y >= viewport.height)) {
        throw new Error(`pointer action outside viewport: ${action.x},${action.y}`);
      }
      if (arm === 'hybrid' && action.target_id && ['click', 'double_click'].includes(action.type)) {
        const target = page.locator(`[data-pss-target-id="${action.target_id}"]`).first();
        if (!await target.isVisible().catch(() => false)) throw new Error(`hybrid target is not visible: ${action.target_id}`);
        if (action.type === 'double_click') await target.dblclick(); else await target.click();
        await page.waitForTimeout(650);
        return;
      }
      if (action.type === 'click') await page.mouse.click(action.x, action.y);
      else if (action.type === 'double_click') await page.mouse.dblclick(action.x, action.y);
      else if (action.type === 'type') await page.keyboard.type(action.text);
      else if (action.type === 'keypress') {
        const key = action.key?.toUpperCase();
        await page.keyboard.press(({ ENTER: 'Enter', RETURN: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab' })[key] ?? action.key);
      } else if (action.type === 'scroll') await page.mouse.wheel(0, action.delta_y);
      else if (action.type === 'wait') await page.waitForTimeout(Math.min(Math.max(action.ms ?? 500, 100), 3000));
      else throw new Error(`Unsupported action: ${action.type}`);
      await page.waitForTimeout(action.type === 'type' ? 350 : 650);
    };
    const driverOptions = {
      env,
      timeoutMs: Number.parseInt(env.CUA_TIMEOUT_MS ?? String(optimization.timeout_ms), 10),
      maxRetries: Number.parseInt(env.CUA_MAX_RETRIES ?? String(optimization.max_retries), 10),
      maxDecisionRetries: Number.parseInt(env.CUA_MAX_DECISION_RETRIES ?? String(optimization.max_decision_retries), 10),
      coordinateMode: env.CUA_COORDINATE_MODE ?? optimization.coordinate_mode,
      executeAction
    };
    const driver = arm === 'visual'
      ? createVolcengineCuaDriver({ ...driverOptions, observeScreenshot: observe })
      : createVolcengineHybridDriver({ ...driverOptions, observeHybrid: observe, hybridActionMode });
    const adapter = createAgentAdapter({ arm, driver, maxSteps });
    const intent = [
      'You are on an authenticated PrestaShop catalog page.',
      `Step 1: click the visible product search box. Step 2: type the single search term "${query}". Step 3: press Enter.`,
      'Do not scroll and do not open any product. As soon as those three actions have been issued, return done with verdict pass.'
    ].join(' ');
    const result = await adapter.run({ intent });
    outcome.actions = result.actions.map((entry) => ({ step: entry.step, ...entry.action }));
    outcome.conformance = containsSequence(outcome.actions, ['click', 'type', 'keypress']);
    const typed = outcome.actions.find((action) => action.type === 'type');
    outcome.conformance.typed_text_non_empty = Boolean(typed?.text?.trim());
    outcome.status = outcome.conformance.passed && outcome.conformance.typed_text_non_empty ? 'ready' : 'failed';
    if (outcome.status === 'failed') outcome.error = { name: 'ConformanceFailure', message: `actions did not contain click -> type -> keypress (missing: ${JSON.stringify(outcome.conformance.missing ?? [])})` };
    outcome.protocol = driver.getProtocolResolution?.() ?? null;
  } catch (error) {
    outcome.error = { name: error.name, message: String(error.message).slice(0, 300) };
    // A provider quota/account limit is an external boundary, not a protocol
    // defect. Keep it distinguishable so the stratum can be reported blocked.
    outcome.status = /\(429\)|inference limit|Safe Experience Mode/i.test(outcome.error.message) ? 'blocked' : 'failed';
  } finally {
    outcome.elapsed_ms = Date.now() - startedAt;
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  return outcome;
}

const manifest = loadProviderProfileManifest();
const selected = manifest.profiles.filter((profile) => gateStatuses.has(profile.status))
  .filter((profile) => requestedProviders.size === 0 || requestedProviders.has(profile.provider_id) || requestedProviders.has(profile.profile_id));

if (selected.length === 0) {
  console.error(`No gate-eligible profiles selected (gate statuses: ${[...gateStatuses].join(', ')}).`);
  process.exitCode = 1;
} else {
  const report = { schema_version: '0.1', generated_at: new Date().toISOString(), gate: 'prestashop click-type-keypress conformance', evidence_boundary: 'protocol/plumbing gate only; not a capability or strategy comparison', profiles: [] };
  for (const profile of selected) {
    console.log(`\n=== ${profile.profile_id} (${profile.provider_id}/${profile.model_id}) ===`);
    const entry = { profile_id: profile.profile_id, provider_id: profile.provider_id, model_id: profile.model_id, optimization_profile: profile.optimization_profile, arms: {}, status: 'ready', reason: null };
    let env;
    try {
      env = profileEnv(profile);
    } catch (error) {
      entry.status = 'blocked';
      entry.reason = error.message;
      report.profiles.push(entry);
      console.log(`blocked: ${error.message}`);
      continue;
    }
    for (const arm of arms) {
      const outcome = await runArm({ profile, env, arm });
      entry.arms[arm] = outcome;
      console.log(`${arm}: ${outcome.status} (${outcome.elapsed_ms} ms) actions=${outcome.actions.map((action) => action.type).join('->') || '(none)'}${outcome.error ? ` error=${outcome.error.message}` : ''}`);
      if (outcome.status === 'blocked') { entry.status = 'blocked'; entry.reason = outcome.error?.message ?? 'provider blocked'; }
      else if (outcome.status === 'failed' && entry.status !== 'blocked') { entry.status = 'failed'; entry.reason = outcome.error?.message ?? 'conformance failed'; }
    }
    report.profiles.push(entry);
  }
  const summary = report.profiles.reduce((accumulator, entry) => { accumulator[entry.status] = (accumulator[entry.status] ?? 0) + 1; return accumulator; }, {});
  report.summary = summary;
  fs.writeFileSync(readinessPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReadiness summary: ${JSON.stringify(summary)} -> ${path.relative(codeRoot, readinessPath)}`);
  const blocked = (summary.blocked ?? 0) > 0;
  const failed = (summary.failed ?? 0) > 0;
  if (failed || (blocked && process.env.PSS_READINESS_ALLOW_BLOCKED !== '1')) {
    if (blocked) console.error('A provider stratum is blocked by an external account/quota limit. Set PSS_READINESS_ALLOW_BLOCKED=1 to continue with the remaining strata.');
    process.exitCode = 1;
  }
}
