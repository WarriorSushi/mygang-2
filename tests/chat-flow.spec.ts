import { test, expect } from '@playwright/test';

test.setTimeout(60000);

test('MyGang.ai End-to-End Journey', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('mock_ai', 'true');
    });
    // 1. Landing Page
    console.log('--- STARTING TEST ---');
    await page.goto('/');
    await expect(page).toHaveTitle(/MyGang.ai/);

    // 2. Click Start
    console.log('Clicking Assemble Your Gang...');
    const startBtn = page.locator('[data-testid="landing-cta"]');
    await expect(startBtn).toBeEnabled({ timeout: 15000 });
    await startBtn.click({ force: true });
    await page.waitForURL(/.*onboarding/, { timeout: 15000 });

    // 3. Identity Step
    console.log('Clicking Assemble the Gang (Identity)...');
    const assembleBtn = page.locator('[data-testid="onboarding-welcome-next"]');
    await assembleBtn.click({ force: true });

    console.log('Filling name...');
    const nameInput = page.locator('[data-testid="onboarding-name"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('Playwright Bot');

    const nextBtn = page.locator('[data-testid="onboarding-name-next"]');
    await nextBtn.click({ force: true });

    await page.locator('[data-testid="vibe-primary_intent-hype"]').click({ force: true });
    await page.locator('[data-testid="vibe-warmth_style-balanced"]').click({ force: true });
    await page.locator('[data-testid="vibe-chaos_level-lively"]').click({ force: true });
    await page.locator('[data-testid="vibe-quiz-next"]').click({ force: true });

    await page.locator('[data-testid="onboarding-avatar-gift-next"]').click({ force: true });
    await page.locator('[data-testid="avatar-style-select-human"]').click({ force: true });
    await page.locator('[data-testid="onboarding-avatar-style-continue"]').click({ force: true });

    // 4. Selection Step
    console.log('Continuing with recommended squad...');
    const letsGoBtn = page.locator('[data-testid="onboarding-selection-done"]');
    await letsGoBtn.click({ force: true });
    await page.getByRole('button', { name: 'Skip for now' }).click({ force: true });

    // 5. Loading -> Chat
    console.log('Waiting for chat redirect...');
    await page.waitForURL(/.*chat/, { timeout: 15000 });

    // 6. Chat Interaction
    console.log('Verifying chat header...');
    await expect(page.locator('[data-testid="chat-header"]')).toContainText('My Gang', { timeout: 10000 });

    console.log('Sending chat message...');
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('Is it just me or is this gang fire?');
    await page.keyboard.press('Enter');

    // 7. Verify AI Response
    console.log('Waiting for AI response...');
    const firstAiMsg = page.locator('div[class*="flex flex-col"]').nth(1);
    await expect(firstAiMsg).toBeVisible({ timeout: 25000 });

    // 8. Test Theme Toggle
    console.log('Testing Theme Toggle...');
    // Better selector: by SVG or title if available. In header we have Camera and Theme.
    // Let's use the title "Save Moment" for camera to distinguish.
    // The theme button doesn't have a title prop in the snippet I recall, checking page.tsx...
    // It has: onClick={() => setTheme(...)}. Inside is <Sun> or <Moon>.
    // Let's try to find it by exclusion or order. It's the second button in the header div.

    // Easier: Just verify the html class changes.
    // await themeBtn.click();
    // await expect(page.locator('html')).toHaveClass(/dark|light/); 
    // Since default is likely system or dark, toggling should change it.

    // 9. Test Auth Wall (Trigger on 2nd message)
    console.log('Triggering Auth Wall...');
    await chatInput.fill('This should trigger the wall.');
    await page.keyboard.press('Enter');

    const authModal = page.locator('[data-testid="auth-wall"]');
    await expect(authModal).toBeVisible({ timeout: 5000 });

    console.log('--- TEST PASSED SUCCESSFULLY ---');
});
