import { test } from '@playwright/test';

test.setTimeout(120000);

test('Capture All Screens', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('mock_ai', 'true');
    });
    // Set viewport to a common desktop size
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Landing Page
    console.log('Capturing Landing Page...');
    await page.goto('http://localhost:3000');
    await page.screenshot({ path: 'screenshots/1_landing.png', animations: 'disabled' });

    // 2. Onboarding - Identity
    console.log('Clicking Assemble Your Gang...');
    await page.locator('[data-testid="landing-cta"]').click({ force: true });
    await page.waitForURL(/.*onboarding/);
    await page.screenshot({ path: 'screenshots/2_onboarding_start.png' });

    console.log('Clicking Assemble the Gang...');
    await page.locator('[data-testid="onboarding-welcome-next"]').click({ force: true });
    await page.screenshot({ path: 'screenshots/3_onboarding_name.png' });

    console.log('Filling nickname...');
    const nameInput = page.locator('[data-testid="onboarding-name"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('VibeChecker');

    const nextBtn = page.locator('[data-testid="onboarding-name-next"]');
    await nextBtn.click({ force: true });

    // 3. Selection
    console.log('Selecting characters...');
    await page.waitForSelector('div[class*="grid"]');
    const characters = ['kael', 'nyx', 'rico', 'cleo'];
    for (const id of characters) {
        console.log(`Selecting ${id}...`);
        const card = page.locator(`[data-testid="character-${id}"]`);
        await card.click({ force: true });
        await page.waitForTimeout(400);
    }
    await page.screenshot({ path: 'screenshots/4_onboarding_selection.png', animations: 'disabled' });

    const letsGoBtn = page.locator('[data-testid="onboarding-selection-done"]');
    await letsGoBtn.click({ force: true });

    // 4. Chat Page
    console.log('Waiting for Chat...');
    await page.waitForURL(/.*chat/, { timeout: 15000 });
    await page.screenshot({ path: 'screenshots/5_chat_initial.png', animations: 'disabled' });

    // 5. Send Message & Typing
    console.log('Sending message...');
    const chatInput = page.locator('[data-testid="chat-input"]');
    await chatInput.fill('Is this gang ready for prime time?');
    await page.keyboard.press('Enter');

    console.log('Capturing typing indicators...');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/6_chat_typing.png', animations: 'disabled' });

    console.log('Waiting for responses...');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: 'screenshots/7_chat_complete.png', animations: 'disabled' });
    console.log('--- VISUAL CHECK COMPLETE ---');
});
