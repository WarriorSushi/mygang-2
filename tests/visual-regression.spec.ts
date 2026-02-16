import { test, expect } from '@playwright/test';

test.describe('Visual regression', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Landing page snapshot', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_ai', 'true');
    });
    await page.goto('/');
    await page.addStyleTag({ content: '*{animation: none !important; transition: none !important;}' });
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('landing.png', { animations: 'disabled', fullPage: true, timeout: 15000, maxDiffPixelRatio: 0.05 });
  });

  test('Onboarding snapshot', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('mock_ai', 'true');
    });
    await page.goto('/onboarding');
    await page.addStyleTag({ content: '*{animation: none !important; transition: none !important;}' });
    await expect(page).toHaveScreenshot('onboarding.png', { animations: 'disabled', fullPage: true, timeout: 15000 });
  });
});
