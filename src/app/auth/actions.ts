'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { CHARACTERS } from '@/constants/characters'
import { sanitizeMessageId, isMissingHistoryMetadataColumnsError } from '@/lib/chat-utils'
import { getTierFromProfile, getSquadLimit } from '@/lib/billing'

type ChatHistoryPageRow = {
    id: string
    speaker: string
    content: string
    created_at: string
    reaction?: string | null
    reply_to_client_message_id?: string | null
    client_message_id?: string | null
}

const validCharacterIds = CHARACTERS.map(c => c.id)

const usernameSchema = z.string().trim().min(1).max(50)
const memoryContentSchema = z.string().trim().min(1).max(2000)
const characterIdsSchema = z.array(z.string()).min(1).max(6).refine(
    ids => ids.every(id => validCharacterIds.includes(id)),
    'Invalid character ID'
)
const userSettingsSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    chat_mode: z.enum(['ecosystem', 'gang_focus']).optional(),
    low_cost_mode: z.boolean().optional(),
    preferred_squad: z.array(z.string()).max(6).optional(),
    chat_wallpaper: z.string().max(50).optional(),
    custom_character_names: z.record(z.string().max(30)).optional(),
}).strict()

async function getOrigin() {
    const headerBag = await headers()
    return (headerBag.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://mygang.ai').replace(/\/$/, '')
}

export async function signInWithGoogle() {
    const supabase = await createClient()
    const origin = await getOrigin()

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${origin}/auth/callback`,
        },
    })

    if (error) {
        console.error('Auth error:', error.message)
        return redirect('/error')
    }

    if (data.url) {
        redirect(data.url)
    }
}

export async function signInOrSignUpWithPassword(email: string, password: string) {
    const supabase = await createClient()
    const origin = await getOrigin()

    const signInAttempt = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (!signInAttempt.error) {
        return { ok: true, action: 'signed_in' as const }
    }

    const signInMessage = signInAttempt.error.message?.toLowerCase() || ''
    const shouldTrySignUp = signInMessage.includes('invalid login') || signInMessage.includes('invalid') || signInMessage.includes('credentials')
    if (!shouldTrySignUp) {
        return { ok: false, error: signInAttempt.error.message }
    }

    const signUpAttempt = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${origin}/auth/callback`,
        },
    })

    if (signUpAttempt.error) {
        const message = signUpAttempt.error.message || 'Unable to sign in or sign up.'
        const normalized = message.toLowerCase()
        if (normalized.includes('already registered') || normalized.includes('already exists')) {
            return { ok: false, error: 'Incorrect password. Please try again.' }
        }
        return { ok: false, error: message }
    }

    if (signUpAttempt.data?.session) {
        return { ok: true, action: 'signed_up' as const }
    }

    const retrySignIn = await supabase.auth.signInWithPassword({ email, password })
    if (!retrySignIn.error) {
        return { ok: true, action: 'signed_in' as const }
    }

    return { ok: false, error: 'Check your email to confirm your account, then log in.' }
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}

export async function deleteAccount() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false as const, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
        console.error('Delete account error:', error)
        return { ok: false as const, error: 'Failed to delete account. Please try again.' }
    }

    await supabase.auth.signOut()
    redirect('/')
}

export async function saveGang(characterIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) return

    // Enforce tier-based squad limit
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

    const tier = getTierFromProfile(profile?.subscription_tier ?? null)
    const limit = getSquadLimit(tier)
    if (parsed.data.length > limit) return

    // 1. Ensure a gang exists for the user
    const { data: gang, error: gangError } = await supabase
        .from('gangs')
        .upsert({ user_id: user.id }, { onConflict: 'user_id' })
        .select()
        .single()

    if (gangError) {
        console.error('Error upserting gang:', gangError)
        return
    }

    // 2. Atomic gang update: insert new members first, then delete stale ones
    const newCharacterIds = parsed.data

    const members = newCharacterIds.map(id => ({
        gang_id: gang.id,
        character_id: id
    }))

    // Upsert new members (safe if they already exist)
    const { error: memberError } = await supabase
        .from('gang_members')
        .upsert(members, { onConflict: 'gang_id,character_id' })
    if (memberError) console.error('Error upserting gang members:', memberError)

    // Delete old members that are NOT in the new list
    const { error: deleteError } = await supabase
        .from('gang_members')
        .delete()
        .eq('gang_id', gang.id)
        .not('character_id', 'in', `(${newCharacterIds.map(id => `"${id}"`).join(',')})`)
    if (deleteError) console.error('Error removing old gang members:', deleteError)

    const { error: settingsError } = await supabase
        .from('profiles')
        .update({ preferred_squad: parsed.data, onboarding_completed: true })
        .eq('id', user.id)
    if (settingsError) console.error('Error updating preferred gang:', settingsError)
}

export async function getSavedGang() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('gang_members')
        .select(`
            character_id,
            gangs!inner(user_id)
        `)
        .eq('gangs.user_id', user.id)

    if (error) {
        console.error('Error fetching gang:', error)
        return null
    }

    return data
        .map((m) => m.character_id)
        .filter((id): id is string => typeof id === 'string')
}

export async function saveUsername(username: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const parsed = usernameSchema.safeParse(username)
    if (!parsed.success) return

    const { error } = await supabase
        .from('profiles')
        .update({ username: parsed.data })
        .eq('id', user.id)

    if (error) console.error('Error saving username:', error)
}

export async function getMemories() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('memories')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching memories:', error)
        return []
    }

    return data
}

export async function deleteMemory(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) console.error('Error deleting memory:', error)
}

export async function updateMemory(id: string, content: string) {
    const parsed = memoryContentSchema.safeParse(content)
    if (!parsed.success) return

    const { generateEmbedding } = await import('@/lib/ai/memory')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let embedding: number[] = []
    try {
        embedding = await generateEmbedding(parsed.data)
    } catch (err) {
        console.error('Error generating embedding:', err)
        return
    }

    const { error } = await supabase
        .from('memories')
        .update({ content: parsed.data, embedding: embedding as unknown as string })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) console.error('Error updating memory:', error)
}

export async function getUserSettings() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('profiles')
        .select('theme, chat_mode, low_cost_mode, preferred_squad, chat_wallpaper, custom_character_names')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('Error fetching user settings:', error)
        return null
    }

    return data
}

export async function getMemoriesPage(params?: { before?: string | null; limit?: number }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { items: [], hasMore: false, nextBefore: null as string | null }

    const limit = Math.min(Math.max(params?.limit ?? 30, 10), 80)
    let query = supabase
        .from('memories')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit + 1)

    if (params?.before) {
        query = query.lt('created_at', params.before)
    }

    const { data, error } = await query
    if (error) {
        console.error('Error fetching memory page:', error)
        return { items: [], hasMore: false, nextBefore: null as string | null }
    }

    const safeRows = data ?? []
    const hasMore = safeRows.length > limit
    const items = (hasMore ? safeRows.slice(0, limit) : safeRows)
    const nextBefore = hasMore ? items[items.length - 1]?.created_at ?? null : null

    return {
        items,
        hasMore,
        nextBefore,
    }
}

export async function getChatHistoryPage(params?: { before?: string | null; limit?: number }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { items: [], hasMore: false, nextBefore: null as string | null }

    const limit = Math.min(Math.max(params?.limit ?? 40, 10), 120)
    const beforeCreatedAt = params?.before
        ? (params.before.includes('|') ? params.before.split('|')[0] : params.before)
        : null
    const buildBaseQuery = (selectClause: string) => {
        let query = supabase
            .from('chat_history')
            .select(selectClause)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(limit + 1)
        if (beforeCreatedAt) {
            query = query.lt('created_at', beforeCreatedAt)
        }
        return query
    }

    const withMetadataResult = await buildBaseQuery('id, speaker, content, created_at, reaction, reply_to_client_message_id, client_message_id')
        .returns<ChatHistoryPageRow[]>()

    let rows: ChatHistoryPageRow[] = []
    if (withMetadataResult.error && isMissingHistoryMetadataColumnsError(withMetadataResult.error)) {
        const legacyResult = await buildBaseQuery('id, speaker, content, created_at')
            .returns<ChatHistoryPageRow[]>()
        if (legacyResult.error) {
            console.error('Error fetching chat history page:', legacyResult.error)
            return { items: [], hasMore: false, nextBefore: null as string | null }
        }
        rows = legacyResult.data ?? []
    } else if (withMetadataResult.error) {
        console.error('Error fetching chat history page:', withMetadataResult.error)
        return { items: [], hasMore: false, nextBefore: null as string | null }
    } else {
        rows = withMetadataResult.data ?? []
    }
    const hasMore = rows.length > limit
    const pageRows = (hasMore ? rows.slice(0, limit) : rows)
    const lastRow = pageRows[pageRows.length - 1]
    const nextBefore = hasMore && lastRow ? `${lastRow.created_at}|${lastRow.id}` : null

    const items = pageRows
        .reverse()
        .map((row) => ({
            id: sanitizeMessageId(row.client_message_id) || `history-${row.id}`,
            speaker: row.speaker,
            content: row.content,
            created_at: row.created_at,
            reaction: typeof row.reaction === 'string' && row.reaction.trim().length > 0 ? row.reaction : undefined,
            replyToId: sanitizeMessageId(row.reply_to_client_message_id) || undefined,
        }))

    return {
        items,
        hasMore,
        nextBefore,
    }
}

export async function updateUserSettings(settings: { theme?: string; chat_mode?: string; low_cost_mode?: boolean; preferred_squad?: string[]; chat_wallpaper?: string }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const parsed = userSettingsSchema.safeParse(settings)
    if (!parsed.success) return

    const { error } = await supabase
        .from('profiles')
        .update(parsed.data)
        .eq('id', user.id)

    if (error) console.error('Error updating user settings:', error)
}

export async function deleteAllMessages() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated.' }

    const { error } = await supabase
        .from('chat_history')
        .delete()
        .eq('user_id', user.id)

    if (error) {
        console.error('Error deleting chat history:', error)
        return { ok: false, error: 'Could not delete chat history right now.' }
    }

    return { ok: true as const }
}

export async function deleteAllMemories() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated.' }

    const { error } = await supabase
        .from('memories')
        .delete()
        .eq('user_id', user.id)

    if (error) {
        console.error('Error deleting all memories:', error)
        return { ok: false, error: 'Could not delete memories right now.' }
    }

    return { ok: true as const }
}

export async function saveMemoryManual(content: string) {
    const { storeMemory } = await import('@/lib/ai/memory')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const parsed = memoryContentSchema.safeParse(content)
    if (!parsed.success) return

    await storeMemory(user.id, parsed.data, {
        kind: 'episodic',
        tags: [],
        importance: 2,
        useEmbedding: true
    })
}

// ── Squad Tier Member Tracking ──
// Note: squad_tier_members table is not yet in generated types — use type assertion
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const squadTierTable = (supabase: Awaited<ReturnType<typeof createClient>>) =>
    (supabase as any).from('squad_tier_members')

export async function addSquadTierMembers(characterIds: string[], tier: 'basic' | 'pro') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const rows = characterIds.map(id => ({
        user_id: user.id,
        character_id: id,
        added_at_tier: tier,
        is_active: true,
        deactivated_at: null,
    }))

    await squadTierTable(supabase).upsert(rows, { onConflict: 'user_id,character_id' })
}

export async function deactivateSquadTierMembers(characterIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await squadTierTable(supabase)
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('character_id', characterIds)
}

export async function getRestorableMembers() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await squadTierTable(supabase)
        .select('character_id, added_at_tier, deactivated_at')
        .eq('user_id', user.id)
        .eq('is_active', false)
        .order('deactivated_at', { ascending: false })

    return data ?? []
}

export async function restoreSquadTierMembers(characterIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await squadTierTable(supabase)
        .update({ is_active: true, deactivated_at: null })
        .eq('user_id', user.id)
        .in('character_id', characterIds)
}

export async function getAutoRemovableMembers() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await squadTierTable(supabase)
        .select('character_id, added_at_tier')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

    return data ?? []
}
