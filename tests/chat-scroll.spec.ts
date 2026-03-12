import { test, expect } from '@playwright/test'
import {
    clearBrowserState,
    expectChatReady,
    loginWithPassword,
    seedUserState,
    TEST_PASSWORD,
} from './helpers/auth'

const SCROLL_EMAIL = 'scroll-auth@test.com'

test('Chat scroll container is scrollable and input stays visible for authenticated users', async ({ page }) => {
    await seedUserState({
        email: SCROLL_EMAIL,
        password: TEST_PASSWORD,
        username: 'Scroll Tester',
        subscriptionTier: 'basic',
        preferredSquad: ['kael', 'nyx', 'rico', 'cleo'],
        historyMessages: Array.from({ length: 60 }).map((_, index) => ({
            speaker: index % 3 === 0 ? 'user' : index % 3 === 1 ? 'kael' : 'nyx',
            content: `Message number ${index + 1} - This is a longer test message to ensure the scroll container overflows and remains stable.`,
            createdAt: new Date(Date.now() - (60 - index) * 30_000).toISOString(),
        })),
    })

    await clearBrowserState(page)
    await loginWithPassword(page, SCROLL_EMAIL, TEST_PASSWORD)
    await expectChatReady(page)

    const scrollEl = page.locator('[data-testid="chat-scroll"]')
    const latestMessage = page.getByTestId('chat-scroll').locator('p').filter({ hasText: 'Message number 60' }).first()
    await expect(scrollEl).toBeVisible({ timeout: 10_000 })
    await expect(latestMessage).toBeVisible({ timeout: 15_000 })

    const scrollMetrics = await scrollEl.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
    }))

    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)

    await scrollEl.evaluate((el) => {
        el.scrollTop = el.scrollHeight
    })

    const beforeWheel = await scrollEl.evaluate((el) => el.scrollTop)
    await scrollEl.hover()
    await page.mouse.wheel(0, -800)
    await page.waitForTimeout(400)
    const afterWheel = await scrollEl.evaluate((el) => el.scrollTop)

    if (afterWheel >= beforeWheel) {
        await scrollEl.evaluate((el) => {
            el.scrollTop = Math.max(0, el.scrollTop - 800)
        })
        await page.waitForTimeout(100)
        const afterProgrammatic = await scrollEl.evaluate((el) => el.scrollTop)
        expect(afterProgrammatic).toBeLessThan(beforeWheel)
    } else {
        expect(afterWheel).toBeLessThan(beforeWheel)
    }

    const input = page.getByTestId('chat-input')
    await expect(input).toBeVisible()
    const inputBox = await input.boundingBox()
    const viewport = page.viewportSize()
    expect(inputBox).not.toBeNull()
    if (inputBox && viewport) {
        expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(viewport.height + 4)
    }
})
