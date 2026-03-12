import { test, expect, type Page } from '@playwright/test'
import {
    clearBrowserState,
    expectChatReady,
    loginWithPassword,
    seedUserState,
    TEST_PASSWORD,
} from './helpers/auth'

type SubscriptionTier = 'free' | 'basic' | 'pro'

const BADGE_SCENARIOS: Array<{
    email: string
    username: string
    tier: SubscriptionTier
    expectedBadge: string | null
}> = [
    { email: 'release-free@test.com', username: 'Release Free', tier: 'free', expectedBadge: null },
    { email: 'release-basic@test.com', username: 'Release Basic', tier: 'basic', expectedBadge: 'Basic' },
    { email: 'release-pro@test.com', username: 'Release Pro', tier: 'pro', expectedBadge: 'Pro' },
]

async function seedAndLogin(page: Page, scenario: typeof BADGE_SCENARIOS[number]) {
    await seedUserState({
        email: scenario.email,
        password: TEST_PASSWORD,
        username: scenario.username,
        subscriptionTier: scenario.tier,
        preferredSquad: ['kael', 'nyx', 'vee', 'cleo'],
        historyMessages: [
            {
                speaker: 'user',
                content: `Badge validation for ${scenario.tier}`,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
            {
                speaker: 'kael',
                content: `Tier looks like ${scenario.tier} from my side.`,
                createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ],
    })

    await clearBrowserState(page)
    await loginWithPassword(page, scenario.email, TEST_PASSWORD)
    await expectChatReady(page)
}

test.describe('Release signoff gaps', () => {
    test.setTimeout(120_000)

    test('desktop paid tier badges match free/basic/pro state', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })

        for (const scenario of BADGE_SCENARIOS) {
            await seedAndLogin(page, scenario)

            const desktopBadge = page.getByTestId('chat-plan-badge-desktop')
            if (!scenario.expectedBadge) {
                await expect(desktopBadge).toHaveCount(0)
            } else {
                await expect(desktopBadge).toHaveAttribute('data-tier', scenario.tier)
                await expect(desktopBadge).toHaveText(scenario.expectedBadge)
            }
        }
    })

    test('mobile paid tier badges stay visible for paid plans', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })

        for (const scenario of BADGE_SCENARIOS.filter((entry) => entry.expectedBadge)) {
            await seedAndLogin(page, scenario)
            const mobileBadge = page.getByTestId('chat-plan-badge-mobile')
            await expect(mobileBadge).toHaveAttribute('data-tier', scenario.tier)
            await expect(mobileBadge).toHaveText(scenario.expectedBadge!)
        }
    })

    test('chat send exits Sending when api chat hangs', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await seedUserState({
            email: 'release-chat-timeout@test.com',
            password: TEST_PASSWORD,
            username: 'Release Timeout',
            subscriptionTier: 'pro',
            preferredSquad: ['kael', 'nyx', 'vee', 'cleo'],
            historyMessages: [
                {
                    speaker: 'user',
                    content: 'Prior conversation exists.',
                    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                },
                {
                    speaker: 'nyx',
                    content: 'yeah, i remember.',
                    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
                },
            ],
        })

        await clearBrowserState(page, {
            localStorage: {
                'mygang-test-chat-request-timeout-ms': '600',
            },
        })

        await page.route('**/api/chat', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 2_000))
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ events: [] }),
            })
        })

        await loginWithPassword(page, 'release-chat-timeout@test.com', TEST_PASSWORD)
        await expectChatReady(page)

        await page.getByTestId('chat-input').fill('Please help me stop overthinking tonight.')
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText('Sending…')).toBeVisible()
        await expect(page.locator('span', { hasText: 'Reply took too long. Please retry.' }).first()).toBeVisible({ timeout: 10_000 })
        await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
        await expect(page.getByText('Sending…')).toHaveCount(0)
        await page.unroute('**/api/chat')
    })

    test('correction turn reconciles cleanly after a concrete directive reply', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await seedUserState({
            email: 'release-correction-turn@test.com',
            password: TEST_PASSWORD,
            username: 'Release Correction',
            subscriptionTier: 'pro',
            preferredSquad: ['kael', 'nyx', 'vee', 'cleo'],
            historyMessages: [
                {
                    speaker: 'user',
                    content: 'Prior conversation exists.',
                    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                },
                {
                    speaker: 'varisha',
                    content: 'I am ready when you are.',
                    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
                },
            ],
        })

        await clearBrowserState(page)
        await loginWithPassword(page, 'release-correction-turn@test.com', TEST_PASSWORD)
        await expectChatReady(page)

        const capturedPayloads: Array<{ messages?: Array<{ content?: string }> }> = []
        const scriptedReplies = [
            {
                turn_id: 'turn-correction-1',
                events: [{
                    type: 'message',
                    character: 'varisha',
                    content: 'Set a five-minute timer and do the smallest useful next step in front of you.',
                    delay: 0,
                }],
            },
            {
                turn_id: 'turn-correction-2',
                events: [{
                    type: 'message',
                    character: 'varisha',
                    content: 'Pick up the nearest object and describe its texture out loud for one minute.',
                    delay: 0,
                }],
            },
        ]
        let callIndex = 0
        const visibleReplyBubble = (text: string) => page
            .getByTestId('chat-scroll')
            .locator('p')
            .filter({ hasText: text })
            .last()

        await page.route('**/api/chat', async (route) => {
            const postData = route.request().postData()
            capturedPayloads.push(postData ? JSON.parse(postData) : {})
            const reply = scriptedReplies[Math.min(callIndex, scriptedReplies.length - 1)]
            callIndex += 1
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(reply),
            })
        })
        await page.route('**/api/chat/rendered', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: true }),
            })
        })

        await page.getByTestId('chat-input').fill('Give me one single action for the next three minutes. No intro, no list.')
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText('Sending…')).toBeVisible()
        await expect(visibleReplyBubble('Set a five-minute timer and do the smallest useful next step in front of you.')).toBeVisible({ timeout: 10_000 })
        await expect(page.getByText('Sending…')).toHaveCount(0)

        await page.getByTestId('chat-input').fill('No, make it one concrete action only. No intro, no empathy preamble, no multiple suggestions.')
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText('Sending…')).toBeVisible()
        await expect(visibleReplyBubble('Pick up the nearest object and describe its texture out loud for one minute.')).toBeVisible({ timeout: 10_000 })
        await expect(page.getByText('Sending…')).toHaveCount(0)
        await expect(page.getByText('Reply took too long. Please retry.')).toHaveCount(0)

        expect(callIndex).toBe(2)
        expect(capturedPayloads[1]?.messages?.at(-1)?.content).toBe('No, make it one concrete action only. No intro, no empathy preamble, no multiple suggestions.')
        expect(capturedPayloads[1]?.messages?.some((message) => message.content === 'Give me one single action for the next three minutes. No intro, no list.')).toBe(true)

        await page.unroute('**/api/chat')
        await page.unroute('**/api/chat/rendered')
    })

    test('post-auth timeout surfaces recovery UI instead of hanging forever', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 })
        await seedUserState({
            email: 'release-post-auth@test.com',
            password: TEST_PASSWORD,
            username: 'Release Post Auth',
            subscriptionTier: 'basic',
            preferredSquad: ['kael', 'nyx', 'vee', 'cleo'],
            historyMessages: [
                {
                    speaker: 'user',
                    content: 'Ready for post-auth recovery.',
                    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                },
            ],
        })

        await clearBrowserState(page, {
            localStorage: {
                'mygang-test-post-auth-timeout-ms': '600',
            },
        })

        await loginWithPassword(page, 'release-post-auth@test.com', TEST_PASSWORD)
        await expectChatReady(page)

        const restoreControl: { release: (() => void) | null } = { release: null }
        const restoreGate = new Promise<void>((resolve) => {
            restoreControl.release = resolve
        })

        await page.route('**/rest/v1/**', async (route) => {
            await restoreGate
            try {
                await route.continue()
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                if (!message.includes('Route is already handled')) {
                    throw error
                }
            }
        })

        await page.goto('/post-auth')
        await expect(page).toHaveURL(/\/post-auth/, { timeout: 10_000 })
        await expect(page.getByTestId('post-auth-recovery')).toBeVisible({ timeout: 10_000 })
        await expect(page.getByTestId('post-auth-retry-button')).toBeVisible()
        await expect(page.getByTestId('post-auth-reload-button')).toBeVisible()

        await page.getByTestId('post-auth-retry-button').click()
        if (!restoreControl.release) {
            throw new Error('Restore gate was never initialized.')
        }
        restoreControl.release()
        await page.unroute('**/rest/v1/**')
        await page.waitForURL(/\/(chat|onboarding)/, { timeout: 15_000 })
    })
})
