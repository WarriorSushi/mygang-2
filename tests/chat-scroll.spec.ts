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
        messages: Array.from({ length: 120 }).map((_, idx) => ({
          id: `msg-${idx}`,
          speaker: idx % 3 === 0 ? 'user' : idx % 3 === 1 ? 'kael' : 'nyx',
          content: `Message number ${idx + 1} - This is a longer test message to ensure the scroll container overflows. Each message should take up a reasonable amount of vertical space so we can verify scrolling works correctly in the chat interface.`,
          created_at: new Date(Date.now() - (120 - idx) * 1000).toISOString(),
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
        userId: null,
        chatMode: 'ecosystem',
        chatWallpaper: 'default',
        hasSeenChatTips: true,
      },
      version: 0,
    };
    window.localStorage.setItem('mygang-chat-storage', JSON.stringify(payload));
  });

  await page.goto('/chat');

  // Wait for hydration and messages to render
  await page.waitForTimeout(3000);

  const scrollEl = page.locator('[data-testid="chat-scroll"]');
  await expect(scrollEl).toBeVisible({ timeout: 10000 });

  // Scroll to find a later message (auto-scrolled to bottom)
  const lastMsg = page.locator('text=Message number 120');
  await expect(lastMsg).toBeVisible({ timeout: 15000 });

  // Wait for all messages to render
  await page.waitForTimeout(2000);

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
