import { expect, type Page } from '@playwright/test'
import * as nextEnv from '@next/env'
import { createClient } from '@supabase/supabase-js'

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())

export const TEST_PASSWORD = 'testtest'

type SubscriptionTier = 'free' | 'basic' | 'pro'

interface SeedHistoryMessage {
    speaker: string
    content: string
    createdAt: string
}

interface SeedUserOptions {
    email: string
    password?: string
    username: string
    subscriptionTier: SubscriptionTier
    preferredSquad: string[]
    historyMessages?: SeedHistoryMessage[]
    fallbackOnly?: boolean
}

export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )
}

export async function ensurePasswordUser(email: string, password = TEST_PASSWORD) {
    const supabase = createAdminClient()
    const usersPage = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersPage.error) throw usersPage.error

    let user = usersPage.data.users.find((entry) => entry.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
        const created = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })
        if (created.error) throw created.error
        user = created.data.user ?? undefined
    } else {
        const updated = await supabase.auth.admin.updateUserById(user.id, {
            password,
            email_confirm: true,
        })
        if (updated.error) throw updated.error
    }

    if (!user) throw new Error(`Could not provision test user for ${email}`)
    return { supabase, userId: user.id }
}

export async function clearBrowserState(
    page: Page,
    options?: {
        localStorage?: Record<string, string>
        sessionStorage?: Record<string, string>
    }
) {
    await page.context().clearCookies()
    await page.addInitScript((payload) => {
        window.localStorage.clear()
        window.sessionStorage.clear()

        for (const [key, value] of Object.entries(payload.localStorage || {})) {
            window.localStorage.setItem(key, value)
        }

        for (const [key, value] of Object.entries(payload.sessionStorage || {})) {
            window.sessionStorage.setItem(key, value)
        }
    }, options || {})
}

export async function seedUserState({
    email,
    password = TEST_PASSWORD,
    username,
    subscriptionTier,
    preferredSquad,
    historyMessages = [],
    fallbackOnly = false,
}: SeedUserOptions) {
    const { supabase, userId } = await ensurePasswordUser(email, password)

    await supabase.from('analytics_events').delete().eq('user_id', userId)
    await supabase.from('squad_tier_members').delete().eq('user_id', userId)
    await supabase.from('chat_history').delete().eq('user_id', userId)

    const { data: gangs, error: gangsError } = await supabase
        .from('gangs')
        .select('id')
        .eq('user_id', userId)
    if (gangsError) throw gangsError

    const gangIds = (gangs || []).map((gang) => gang.id)
    if (gangIds.length > 0) {
        const { error: deleteMembersError } = await supabase
            .from('gang_members')
            .delete()
            .in('gang_id', gangIds)
        if (deleteMembersError) throw deleteMembersError

        const { error: deleteGangsError } = await supabase
            .from('gangs')
            .delete()
            .eq('user_id', userId)
        if (deleteGangsError) throw deleteGangsError
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .update({
            username,
            subscription_tier: subscriptionTier,
            onboarding_completed: true,
            preferred_squad: preferredSquad,
            custom_character_names: null,
            purchase_celebration_pending: null,
            pending_squad_downgrade: false,
            restored_members_pending: [],
            chat_mode: 'ecosystem',
            low_cost_mode: false,
        })
        .eq('id', userId)
    if (profileError) throw profileError

    let gangId: string | null = null
    if (!fallbackOnly) {
        const { data: gang, error: gangError } = await supabase
            .from('gangs')
            .upsert({ user_id: userId }, { onConflict: 'user_id' })
            .select('id')
            .single()
        if (gangError) throw gangError

        gangId = gang.id

        const { error: memberError } = await supabase
            .from('gang_members')
            .upsert(
                preferredSquad.map((characterId) => ({
                    gang_id: gang.id,
                    character_id: characterId,
                })),
                { onConflict: 'gang_id,character_id' }
            )
        if (memberError) throw memberError

        if (subscriptionTier !== 'free') {
            const { error: tierError } = await supabase
                .from('squad_tier_members')
                .upsert(
                    preferredSquad.map((characterId) => ({
                        user_id: userId,
                        character_id: characterId,
                        added_at_tier: subscriptionTier,
                        is_active: true,
                        deactivated_at: null,
                    })),
                    { onConflict: 'user_id,character_id' }
                )
            if (tierError) throw tierError
        }
    }

    if (gangId && historyMessages.length > 0) {
        const { error: historyError } = await supabase
            .from('chat_history')
            .insert(
                historyMessages.map((message) => ({
                    user_id: userId,
                    gang_id: gangId,
                    speaker: message.speaker,
                    content: message.content,
                    created_at: message.createdAt,
                    source: 'chat',
                }))
            )
        if (historyError) throw historyError
    }

    return { supabase, userId, gangId }
}

export async function loginWithPassword(page: Page, email: string, password = TEST_PASSWORD) {
    await page.goto('/')

    await page.getByRole('button', { name: 'Log in' }).click()
    await page.getByRole('button', { name: 'Continue with email' }).click()
    await page.getByRole('checkbox').first().check()
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Continue', exact: true }).click()

    try {
        await page.waitForURL(/\/(post-auth|onboarding|chat)/, { timeout: 20_000 })
    } catch {
        const authWallText = await page.getByTestId('auth-wall').textContent()
        throw new Error(`Auth wall did not resolve after submit. Visible text: ${authWallText}`)
    }
}

export async function expectChatReady(page: Page) {
    await page.waitForURL(/\/chat/, { timeout: 30_000 })
    await expect(page.getByTestId('chat-header')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 15_000 })
}

export async function getAnalyticsEvents(userId: string, event: string, sinceIso?: string) {
    const supabase = createAdminClient()
    let query = supabase
        .from('analytics_events')
        .select('event, metadata, created_at')
        .eq('user_id', userId)
        .eq('event', event)
        .order('created_at', { ascending: true })

    if (sinceIso) {
        query = query.gte('created_at', sinceIso)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
}
