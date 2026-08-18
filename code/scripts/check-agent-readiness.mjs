import process from 'node:process';
import { requireProviderConfig } from '../src/arms/agent-adapter.mjs';

try {
  const config = requireProviderConfig();
  console.log(JSON.stringify({ status: 'configured', provider: config.provider, model: config.model, api_key_present: true }));
} catch (error) {
  if (error.name === 'AgentProviderNotConfiguredError') {
    console.log(JSON.stringify({ status: 'blocked', reason: error.message, api_key_present: false }));
    process.exitCode = 1;
  } else {
    throw error;
  }
}
