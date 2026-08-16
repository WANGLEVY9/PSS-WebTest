import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const browserChannel = process.env.PSS_BROWSER_CHANNEL;

export default defineConfig({
  testDir: './tests/traditional',
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: '../artifacts/playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.SUT_BASE_URL ?? 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{
    name: 'chromium',
    use: {
      browserName: 'chromium',
      ...(browserChannel ? { channel: browserChannel } : {})
    }
  }]
});
