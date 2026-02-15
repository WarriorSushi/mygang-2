import { test, expect } from '@playwright/test';

test('Chat API rejects invalid payloads', async ({ request }) => {
  const response = await request.post('/api/chat', {
    data: { invalid: true },
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body).toHaveProperty('events');
  expect(Array.isArray(body.events)).toBeTruthy();
});
