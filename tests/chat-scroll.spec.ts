import { test, expect } from '@playwright/test';

test('Chat scroll container is scrollable and input stays visible', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error('[browser]', msg.text());
    }
  });

  await page.addInitScript(() => {
    const payload = {
      state: {
        messages: Array.from({ length: 60 }).map((_, idx) => ({
          id: `msg-${idx}`,
          speaker: idx % 2 === 0 ? 'user' : 'kael',
          content: `Message number ${idx + 1} - lorem ipsum lorem ipsum lorem ipsum`,
          created_at: new Date(Date.now() - (60 - idx) * 1000).toISOString(),
        })),
        activeGang: [
          { id: 'kael', name: 'Kael', vibe: '', color: '#FFD700', avatar: '/avatars/kael.png' },
          { id: 'nyx', name: 'Nyx', vibe: '', color: '#8A2BE2', avatar: '/avatars/nyx.png' },
          { id: 'rico', name: 'Rico', vibe: '', color: '#FF4500', avatar: '/avatars/rico.png' },
          { id: 'cleo', name: 'Cleo', vibe: '', color: '#DDA0DD', avatar: '/avatars/cleo.png' },
        ],
        isGuest: false,
        userName: 'ScrollTester',
        userNickname: null,
        userId: 'local',
        chatMode: 'ecosystem',
        chatWallpaper: 'default',
        hasSeenChatTips: true,
      },
      version: 0,
    };
    window.localStorage.setItem('mygang-chat-storage', JSON.stringify(payload));
  });

  await page.goto('/chat');

  const scrollEl = page.locator('[data-testid="chat-scroll"]');
  await expect(scrollEl).toBeVisible();
  await expect(page.locator('text=Message number 60')).toBeVisible({ timeout: 5000 });

  const scrollMetrics = await scrollEl.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    scrollTop: el.scrollTop,
  }));

  console.log('[scroll-metrics]', scrollMetrics);
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  await scrollEl.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });

  const afterScrollTop = await scrollEl.evaluate((el) => el.scrollTop);
  expect(afterScrollTop).toBeGreaterThan(0);

  await scrollEl.hover();
  const beforeWheel = await scrollEl.evaluate((el) => el.scrollTop);
  await page.mouse.wheel(0, -800);
  await page.waitForTimeout(100);
  const afterWheel = await scrollEl.evaluate((el) => el.scrollTop);
  expect(afterWheel).toBeLessThan(beforeWheel);

  const input = page.locator('[data-testid="chat-input"]');
  await expect(input).toBeVisible();
  const inputBox = await input.boundingBox();
  const viewport = page.viewportSize();
  expect(inputBox).not.toBeNull();
  if (inputBox && viewport) {
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(viewport.height + 4);
  }
});
