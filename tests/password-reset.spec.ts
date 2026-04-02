import { test, expect } from '@playwright/test'

test.describe('Password Reset Flow', () => {
    test('forgot password page renders request form', async ({ page }) => {
        await page.goto('/forgot-password')

        await expect(page.getByRole('heading', { name: /Reset your password/i })).toBeVisible()
        await expect(page.locator('input[type="email"]')).toBeVisible()
        await expect(page.getByRole('button', { name: /Send reset link/i })).toBeVisible()
    })

    test('reset password page shows invalid state for expired links', async ({ page }) => {
        await page.goto('/reset-password?error=invalid_or_expired')

        await expect(page.getByRole('heading', { name: /This reset link can't be used/i })).toBeVisible()
        await expect(page.getByRole('link', { name: /Request a new link/i })).toBeVisible()
    })
})
