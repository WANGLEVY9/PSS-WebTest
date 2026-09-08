import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';

try {
  const registry = loadConfigurationRegistry();
  const byFamily = Object.fromEntries(['visual', 'hybrid', 'scripted'].map((family) => [family, registry.configurations.filter((item) => item.family === family).length]));
  console.log(`Configuration registry validation passed: ${registry.configurations.length} configurations (${Object.entries(byFamily).map(([family, count]) => `${family}=${count}`).join(', ')}), protocol ${registry.protocol_version}.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
