import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test('Chat API returns valid response schema for a basic request', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/api/chat`, {
    data: {
      messages: [
        {
          id: 't1',
          speaker: 'user',
          content: 'Hello gang, quick test.',
          created_at: new Date().toISOString(),
        },
      ],
      activeGangIds: ['kael', 'nyx', 'rico', 'cleo'],
      userName: 'TestUser',
      userNickname: 'Tester',
      silentTurns: 0,
      burstCount: 0,
      chatMode: 'ecosystem',
    },
    headers: {
      'x-mock-ai': 'true',
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.events)).toBeTruthy();
  expect(body.events.length).toBeGreaterThan(0);

  const validTypes = ['message', 'reaction', 'status_update', 'nickname_update', 'typing_ghost'];
  for (const event of body.events) {
    expect(validTypes.includes(event.type)).toBeTruthy();
    expect(typeof event.character).toBe('string');
    expect(typeof event.delay).toBe('number');
  }
});

test('Chat API handles short messages with limited responders', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/api/chat`, {
    data: {
      messages: [
        {
          id: 't2',
          speaker: 'user',
          content: 'Yo',
          created_at: new Date().toISOString(),
        },
      ],
      activeGangIds: ['kael', 'nyx', 'rico', 'cleo'],
      userName: 'TestUser',
      silentTurns: 0,
      burstCount: 0,
      chatMode: 'entourage',
    },
    headers: {
      'x-mock-ai': 'true',
    },
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.events)).toBeTruthy();
  expect(body.responders).toBeTruthy();
});
