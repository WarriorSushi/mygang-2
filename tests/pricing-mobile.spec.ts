import { test, expect } from '@playwright/test'

test.describe('Pricing Comparison - Mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('comparison stays side by side and scrolls to reveal Pro', async ({ page }) => {
        await page.goto('/pricing')

        const table = page.getByRole('table', { name: 'Plan comparison' })
        await expect(table).toBeVisible()

        const scrollContainer = table.locator('..')
        const scrollMetrics = await scrollContainer.evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
        }))

        expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth)

        await scrollContainer.evaluate((element) => {
            element.scrollTo({ left: element.scrollWidth, behavior: 'instant' })
        })

        const proHeader = page.getByRole('columnheader', { name: 'Pro' })
        await expect(proHeader).toBeVisible()

        const [containerBox, proBox] = await Promise.all([
            scrollContainer.boundingBox(),
            proHeader.boundingBox(),
        ])

        expect(containerBox).toBeTruthy()
        expect(proBox).toBeTruthy()
        expect(proBox!.x + proBox!.width).toBeLessThanOrEqual(containerBox!.x + containerBox!.width + 4)
    })

    test('pricing page does not log hydration mismatch errors', async ({ page }) => {
        const consoleErrors: string[] = []
        page.on('console', (message) => {
            if (message.type() === 'error') {
                consoleErrors.push(message.text())
            }
        })

        await page.goto('/pricing')
        await expect(page.getByRole('heading', { name: /Compare plans side by side/i })).toBeVisible()

        const hydrationErrors = consoleErrors.filter((entry) => /hydration|did not match|react error/i.test(entry))
        expect(hydrationErrors).toEqual([])
    })
})
