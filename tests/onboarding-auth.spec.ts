import { test, expect } from '@playwright/test'
import * as nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { clearBrowserState } from './helpers/auth'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

const TEST_EMAIL = 'test1@test.com'
const TEST_PASSWORD = 'testtest'

function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

async function ensureResetTestUser() {
    const supabase = createAdminClient()
    const usersPage = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersPage.error) throw usersPage.error

    let user = usersPage.data.users.find((entry) => entry.email?.toLowerCase() === TEST_EMAIL)
    if (!user) {
        const created = await supabase.auth.admin.createUser({
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            email_confirm: true,
        })
        if (created.error) throw created.error
        user = created.data.user ?? undefined
    } else {
        const updated = await supabase.auth.admin.updateUserById(user.id, {
            password: TEST_PASSWORD,
            email_confirm: true,
        })
        if (updated.error) throw updated.error
    }

    if (!user) {
        throw new Error('Test user is unavailable')
    }

    const { data: gangs, error: gangsError } = await supabase
        .from('gangs')
        .select('id')
        .eq('user_id', user.id)

    if (gangsError) throw gangsError

    const gangIds = (gangs || []).map((gang) => gang.id)
    if (gangIds.length > 0) {
        const { error: deleteMembersError } = await supabase
            .from('gang_members')
            .delete()
            .in('gang_id', gangIds)
        if (deleteMembersError) throw deleteMembersError

        const { error: deleteHistoryError } = await supabase
            .from('chat_history')
            .delete()
            .eq('user_id', user.id)
        if (deleteHistoryError) throw deleteHistoryError

        const { error: deleteGangsError } = await supabase
            .from('gangs')
            .delete()
            .eq('user_id', user.id)
        if (deleteGangsError) throw deleteGangsError
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            username: null,
            onboarding_completed: false,
            preferred_squad: null,
            custom_character_names: null,
            purchase_celebration_pending: null,
        })
        .eq('id', user.id)

    if (profileError) throw profileError

    return { supabase, userId: user.id }
}

test.describe('Auth-first onboarding', () => {
    test.setTimeout(90_000)

    test('signed-in user sees intro/rename step and names persist', async ({ page }) => {
        const { supabase, userId } = await ensureResetTestUser()

        await clearBrowserState(page)

        await page.goto('/')

        await page.getByRole('button', { name: 'Log in' }).click()
        await page.getByRole('button', { name: 'Continue with email' }).click()
        await page.getByRole('checkbox').first().check()
        await page.getByLabel('Email address').fill(TEST_EMAIL)
        await page.getByLabel('Password').fill(TEST_PASSWORD)
        await page.getByRole('button', { name: 'Continue', exact: true }).click()

        try {
            await page.waitForURL(/\/(post-auth|onboarding)/, { timeout: 20_000 })
        } catch {
            const authWallText = await page.getByTestId('auth-wall').textContent()
            throw new Error(`Auth wall did not progress after submit. Visible text: ${authWallText}`)
        }
        await page.waitForURL(/\/onboarding/, { timeout: 30_000 })

        await page.getByTestId('onboarding-welcome-next').click()
        await page.getByTestId('onboarding-name').fill('Playwright Crew')
        await page.getByTestId('onboarding-name-next').click()
        await page.getByTestId('vibe-primary_intent-hype').click()
        await page.getByTestId('vibe-warmth_style-balanced').click()
        await page.getByTestId('vibe-chaos_level-lively').click()
        await page.getByTestId('vibe-quiz-next').click()

        await page.getByTestId('character-kael').click()
        await page.getByTestId('character-nyx').click()
        await page.getByTestId('onboarding-selection-done').click()

        await expect(page.getByText('Meet your AI friends')).toBeVisible()
        await expect(page.getByText(/change them later anytime in settings/i)).toBeVisible()

        const introInputs = page.locator('input[id^="intro-name-"]')
        await introInputs.nth(0).fill('Kai')
        await introInputs.nth(1).fill('Nox')
        await page.getByRole('button', { name: 'Start Chat' }).click()

        await page.waitForURL(/\/chat/, { timeout: 30_000 })

        await expect.poll(async () => {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('username, custom_character_names, onboarding_completed')
                .eq('id', userId)
                .single()

            if (error) throw error

            return {
                username: profile?.username ?? null,
                onboardingCompleted: profile?.onboarding_completed ?? null,
                customNames: Object.values(profile?.custom_character_names || {}).sort(),
            }
        }, {
            timeout: 15_000,
        }).toEqual({
            username: 'Playwright Crew',
            onboardingCompleted: true,
            customNames: ['Kai', 'Nox'].sort(),
        })
    })
})
