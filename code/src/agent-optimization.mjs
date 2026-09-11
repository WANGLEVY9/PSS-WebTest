import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const profilePath = path.join(codeRoot, 'config', 'agent-optimization-profiles.v0.1.json');

function readProfiles() {
  return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
}

export function loadAgentOptimizationProfiles() {
  return readProfiles();
}

export function resolveAgentOptimization({ env = process.env, arm, taskFamily = 'multi-step' } = {}) {
  if (!['visual', 'hybrid'].includes(arm)) throw new Error(`Unsupported optimization arm: ${arm}`);
  const document = readProfiles();
  const profileId = env.PSS_AGENT_PROFILE?.trim() || document.default_profile;
  const profile = document.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`Unknown PSS_AGENT_PROFILE: ${profileId}`);
  const armProfile = profile.arms[arm];
  if (!armProfile) throw new Error(`Profile ${profileId} has no ${arm} settings`);
  const maxSteps = profile.task_family_steps[taskFamily] ?? profile.task_family_steps['multi-step'] ?? 14;
  return { profile_id: profile.id, prompt_profile: profile.prompt_profile ?? 'legacy-v0', task_family: taskFamily, arm, max_steps: maxSteps, ...armProfile };
}

export { profilePath };
