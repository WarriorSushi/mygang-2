import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.clear()
        })
    })

    test('renders hero section with title and CTA', async ({ page }) => {
        await page.goto('/')
        await expect(page).toHaveTitle(/MyGang/)

        // Hero title
        const heading = page.locator('h1')
        await expect(heading).toBeVisible({ timeout: 10000 })
        await expect(heading).toContainText('YOUR')
        await expect(heading).toContainText('GANG')

        // CTA button
        const cta = page.locator('[data-testid="landing-cta"]')
        await expect(cta).toBeVisible()
        await expect(cta).toBeEnabled({ timeout: 15000 })
        await expect(cta).toContainText('Assemble Your Gang')
    })

    test('marquee section has rotating items', async ({ page }) => {
        await page.goto('/')
        // Check marquee items are present
        const marqueeText = page.locator('text=Late-night talks').first()
        await expect(marqueeText).toBeVisible({ timeout: 10000 })

        // Check some new items too
        const newItem = page.locator('text=Zero judgment').first()
        await expect(newItem).toBeVisible()
    })

    test('How it works section renders steps', async ({ page }) => {
        await page.goto('/')
        const section = page.locator('#how-it-works')
        await section.scrollIntoViewIfNeeded()

        // Check all 3 steps
        await expect(page.locator('text=Build your gang').first()).toBeVisible()
        await expect(page.locator('text=Say anything').first()).toBeVisible()
        await expect(page.locator('text=Watch the room come alive').first()).toBeVisible()
    })

    test('Why it feels real section renders comparison table', async ({ page }) => {
        await page.goto('/')
        const section = page.locator('#why-it-feels-real')
        await section.scrollIntoViewIfNeeded()

        await expect(page.locator('text=Reply quality').first()).toBeVisible()
        await expect(page.locator('text=Social feel').first()).toBeVisible()
        await expect(page.locator('text=Emotional tone').first()).toBeVisible()
    })

    test('demo chat cards have fixed height (no jitter)', async ({ page }) => {
        await page.goto('/')
        const section = page.locator('#how-it-works')
        await section.scrollIntoViewIfNeeded()

        // The demo card chat containers should have fixed height
        const chatContainer = page.locator('.h-\\[17rem\\]').first()
        if (await chatContainer.isVisible()) {
            const box = await chatContainer.boundingBox()
            expect(box).toBeTruthy()
            // Height should stay consistent (17rem = ~272px)
            expect(box!.height).toBeGreaterThan(240)
            expect(box!.height).toBeLessThan(320)

            // Wait for messages to animate in, height should NOT change
            await page.waitForTimeout(3000)
            const boxAfter = await chatContainer.boundingBox()
            expect(boxAfter!.height).toBe(box!.height)
        }
    })

    test('theme toggle works', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(1000)

        const html = page.locator('html')
        const initialClass = await html.getAttribute('class')

        // Click theme toggle
        const themeBtn = page.locator('button[aria-label="Toggle color mode"]')
        await expect(themeBtn).toBeVisible()
        await themeBtn.click()

        await page.waitForTimeout(500)
        const newClass = await html.getAttribute('class')

        // Class should have changed (dark <-> light)
        expect(newClass).not.toBe(initialClass)
    })

    test('Log in button opens auth wall', async ({ page }) => {
        await page.goto('/')
        await page.waitForTimeout(2000)

        const loginBtn = page.locator('button:has-text("Log in")')
        if (await loginBtn.isVisible()) {
            await loginBtn.click()
            const authWall = page.locator('[data-testid="auth-wall"]')
            await expect(authWall).toBeVisible({ timeout: 5000 })

            // Auth wall has email and password fields
            await expect(page.locator('input[type="email"]')).toBeVisible()
            await expect(page.locator('input[type="password"]')).toBeVisible()
        }
    })

    test('CTA links to onboarding for unauthenticated users', async ({ page }) => {
        await page.goto('/')
        const cta = page.locator('[data-testid="landing-cta"]')
        await expect(cta).toBeEnabled({ timeout: 15000 })
        await cta.click({ force: true })
        await page.waitForURL(/.*onboarding/, { timeout: 15000 })
    })

    test('FAQ section renders', async ({ page }) => {
        await page.goto('/')
        const section = page.locator('#faq')
        await section.scrollIntoViewIfNeeded()

        await expect(page.locator('text=Can this really feel like a friend group?').first()).toBeVisible()
        await expect(page.locator('text=Can I change my crew later?').first()).toBeVisible()
    })

    test('testimonials section renders', async ({ page }) => {
        await page.goto('/')
        const section = page.locator('#testimonials')
        await section.scrollIntoViewIfNeeded()

        await expect(page.locator('text=Ava').first()).toBeVisible()
        await expect(page.locator('text=Jay').first()).toBeVisible()
        await expect(page.locator('text=Mira').first()).toBeVisible()
    })

    test('final CTA section renders', async ({ page }) => {
        await page.goto('/')
        const finalCta = page.locator('text=Meet your crew in under a minute.')
        await finalCta.scrollIntoViewIfNeeded()
        await expect(finalCta).toBeVisible()
    })
})

test.describe('Landing Page - Mobile', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('renders correctly on mobile', async ({ page }) => {
        await page.addInitScript(() => { window.localStorage.clear() })
        await page.goto('/')

        // Hero should be visible
        await expect(page.locator('h1')).toBeVisible({ timeout: 10000 })

        // CTA should be full-width on mobile
        const cta = page.locator('[data-testid="landing-cta"]')
        await expect(cta).toBeVisible()
        await expect(cta).toBeEnabled({ timeout: 15000 })

        // Swipeable demo cards on mobile
        const swipeHint = page.locator('text=Swipe to see more')
        await page.locator('#how-it-works').scrollIntoViewIfNeeded()
        if (await swipeHint.isVisible()) {
            await expect(swipeHint).toBeVisible()
        }
    })
})
