import { expect, test } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_PANEL_EMAIL || 'drsyedirfan93@gmail.com'
const ADMIN_TEST_PASSWORD = process.env.ADMIN_TEST_PASSWORD || ''
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PANEL_PASSWORD_HASH || ''

test.describe.serial('Admin Flow', () => {
    test('redirects unauthenticated user from protected route to login', async ({ page }) => {
        await page.goto('/admin/overview')
        await expect(page).toHaveURL(/\/admin\/login\?error=unauthorized/)
    })

    test('allows valid admin login when test password is provided', async ({ page }) => {
        test.skip(!(ADMIN_EMAIL && ADMIN_TEST_PASSWORD), 'Set ADMIN_PANEL_EMAIL and ADMIN_TEST_PASSWORD for login test.')

        await page.goto('/admin/login')
        await page.fill('#admin-email', ADMIN_EMAIL)
        await page.fill('#admin-password', ADMIN_TEST_PASSWORD)

        await Promise.all([
            page.waitForURL(/\/admin\/overview/),
            page.click('button[type="submit"]'),
        ])

        await expect(page.getByText('MyGang Control Room')).toBeVisible()
    })

    test('allows admin login using configured password hash input', async ({ page }) => {
        test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD_HASH), 'Set ADMIN_PANEL_EMAIL and ADMIN_PANEL_PASSWORD_HASH for hash-input login test.')

        await page.goto('/admin/login')
        await page.fill('#admin-email', ADMIN_EMAIL)
        await page.fill('#admin-password', ADMIN_PASSWORD_HASH)

        await Promise.all([
            page.waitForURL(/\/admin\/overview/),
            page.click('button[type="submit"]'),
        ])

        await expect(page.getByText('MyGang Control Room')).toBeVisible()
    })

    test('locks repeated invalid login attempts', async ({ page }) => {
        const email = `invalid-${Date.now()}@example.com`
        const password = 'invalid-password'

        for (let i = 0; i < 5; i++) {
            await page.goto('/admin/login')
            await page.fill('#admin-email', email)
            await page.fill('#admin-password', password)
            await Promise.all([
                page.waitForURL(/\/admin\/login\?error=(invalid|locked).*/),
                page.click('button[type="submit"]'),
            ])
        }

        await expect(page).toHaveURL(/\/admin\/login\?error=locked.*/)
        await expect(page.getByText(/Too many failed attempts/)).toBeVisible()
    })
})
