import 'dotenv/config';
import { chromium } from 'playwright';

const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const username = process.env.PSS_BOOKSTACK_USERNAME;
const password = process.env.PSS_BOOKSTACK_PASSWORD;
const viewport = { width: 1280, height: 720 };
if (!username || !password) throw new Error('BookStack credentials must be configured in code/.env');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport });
try {
  await page.goto(`${baseURL}/`);
  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.goto(`${baseURL}/books/book1/draft/7`);
  const screenshot = `data:image/jpeg;base64,${(await page.screenshot({ type: 'jpeg', quality: 60, animations: 'disabled' })).toString('base64')}`;
  const response = await fetch(`${process.env.CUA_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.CUA_API_KEY}` },
    body: JSON.stringify({
      model: process.env.CUA_MODEL,
      temperature: 0,
      max_completion_tokens: 512,
      enable_thinking: false,
      tools: [{ type: 'function', function: {
        name: 'ui_action',
        description: 'Return the next browser action only.',
        parameters: {
          type: 'object',
          properties: {
            action_type: { type: 'string', enum: ['click', 'type', 'keypress', 'scroll', 'wait', 'done'] },
            x: { type: 'integer', minimum: 0, maximum: 1000 },
            y: { type: 'integer', minimum: 0, maximum: 1000 },
            text: { type: 'string', maxLength: 200 },
            key: { type: 'string' },
            delta_y: { type: 'integer' },
            ms: { type: 'integer', minimum: 100, maximum: 3000 },
            verdict: { type: 'string' }
          },
          required: ['action_type'],
          additionalProperties: false
        }
      } }],
      tool_choice: { type: 'function', function: { name: 'ui_action' } },
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'You are a UI testing agent. The current page is a BookStack new-page editor. Enter the exact page content "PSS Phase2 Content". Use the ui_action function exactly once. Do not include newline characters in text.' },
        { type: 'image_url', image_url: { url: screenshot } }
      ] }]
    })
  });
  const payload = await response.json();
  const message = payload?.choices?.[0]?.message;
  console.log(JSON.stringify({ status: response.status, finish_reason: payload?.choices?.[0]?.finish_reason ?? null, message: {
    content_type: typeof message?.content,
    content_length: typeof message?.content === 'string' ? message.content.length : null,
    tool_calls: message?.tool_calls ?? null
  }, error: payload?.error ?? null }));
} finally {
  await browser.close();
}
