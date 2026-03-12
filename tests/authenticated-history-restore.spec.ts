import { test, expect } from '@playwright/test'
import {
    clearBrowserState,
    expectChatReady,
    getAnalyticsEvents,
    loginWithPassword,
    seedUserState,
    TEST_PASSWORD,
} from './helpers/auth'

const RETURNING_EMAIL = 'returning-history@test.com'
const FALLBACK_EMAIL = 'fallback-paid@test.com'

test.describe('Authenticated history restore', () => {
    test.setTimeout(120_000)

    test('remote history wins over stale local cache and starter chips stay hidden', async ({ page }) => {
        const startedAt = new Date().toISOString()
        const { userId } = await seedUserState({
            email: RETURNING_EMAIL,
            password: TEST_PASSWORD,
            username: 'Returning Crew',
            subscriptionTier: 'basic',
            preferredSquad: ['luna', 'vee', 'ezra', 'nova'],
            historyMessages: [
                {
                    speaker: 'user',
                    content: 'Remote user history should win.',
                    createdAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
                },
                {
                    speaker: 'luna',
                    content: 'Remote reply from Luna.',
                    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
                },
            ],
        })

        const staleLocalStore = JSON.stringify({
            state: {
                activeGang: [
                    { id: 'kael', name: 'Kael', vibe: 'Rich kid energy', color: '#FFD700' },
                    { id: 'nyx', name: 'Nyx', vibe: 'Hacker energy', color: '#8A2BE2' },
                ],
                userName: 'Stale Local User',
                userNickname: null,
                userId: null,
                chatMode: 'ecosystem',
                lowCostMode: false,
                chatWallpaper: 'default',
                showPersonaRoles: true,
                customCharacterNames: {},
                messages: [
                    {
                        id: 'stale-local-message',
                        speaker: 'user',
                        content: 'STALE LOCAL MESSAGE SHOULD NOT WIN',
                        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                    },
                ],
            },
            version: 0,
        })

        await clearBrowserState(page, {
            localStorage: {
                'mygang-chat-storage': staleLocalStore,
            },
        })

        await loginWithPassword(page, RETURNING_EMAIL, TEST_PASSWORD)
        await expectChatReady(page)

        await expect(page.getByText('Remote user history should win.')).toBeVisible({ timeout: 15_000 })
        await expect(page.getByText('Remote reply from Luna.')).toBeVisible({ timeout: 15_000 })
        await expect(page.getByText('STALE LOCAL MESSAGE SHOULD NOT WIN')).toHaveCount(0)
        await expect(page.locator('[data-testid^="starter-chip-"]')).toHaveCount(0)

        const persistedState = await page.evaluate(() => {
            const raw = window.localStorage.getItem('mygang-chat-storage')
            return raw ? JSON.parse(raw) : null
        })

        expect(persistedState?.state?.activeGang?.map((entry: { id: string }) => entry.id)).toEqual(['luna', 'vee', 'ezra', 'nova'])

        await expect.poll(async () => {
            const events = await getAnalyticsEvents(userId, 'history_bootstrap_resolved', startedAt)
            return events.some((event) => event.metadata?.outcome === 'has_history')
        }, {
            timeout: 15_000,
        }).toBe(true)
    })

    test('paid preferred_squad fallback is repaired into relational squad state', async ({ page }) => {
        const startedAt = new Date().toISOString()
        const { supabase, userId } = await seedUserState({
            email: FALLBACK_EMAIL,
            password: TEST_PASSWORD,
            username: 'Fallback Crew',
            subscriptionTier: 'basic',
            preferredSquad: ['luna', 'vee', 'ezra', 'nova'],
            fallbackOnly: true,
        })

        await clearBrowserState(page)
        await loginWithPassword(page, FALLBACK_EMAIL, TEST_PASSWORD)
        await expectChatReady(page)

        const { data: gangs, error: gangsError } = await supabase
            .from('gangs')
            .select('id')
            .eq('user_id', userId)
        if (gangsError) throw gangsError

        expect(gangs?.length).toBe(1)

        const gangId = gangs?.[0]?.id
        expect(gangId).toBeTruthy()

        const { data: gangMembers, error: gangMembersError } = await supabase
            .from('gang_members')
            .select('character_id')
            .eq('gang_id', gangId!)
            .order('character_id')
        if (gangMembersError) throw gangMembersError

        expect(gangMembers?.map((entry) => entry.character_id)).toEqual(['ezra', 'luna', 'nova', 'vee'])

        const { data: tierRows, error: tierRowsError } = await supabase
            .from('squad_tier_members')
            .select('character_id, is_active')
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('character_id')
        if (tierRowsError) throw tierRowsError

        expect(tierRows?.map((entry) => entry.character_id)).toEqual(['ezra', 'luna', 'nova', 'vee'])

        const fallbackEvents = await getAnalyticsEvents(userId, 'preferred_squad_fallback_used', startedAt)
        expect(fallbackEvents.length).toBeGreaterThan(0)
    })
})
