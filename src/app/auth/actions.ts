'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
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
    preferred_squad: z.array(z.string()).max(6).refine(ids => !ids || ids.every(id => validCharacterIds.includes(id)), { message: 'Invalid character ID' }).optional(),
    chat_wallpaper: z.string().max(50).optional(),
    custom_character_names: z.record(z.string().max(30)).refine(v => !v || Object.keys(v).length <= 6, { message: 'Too many custom names' }).optional(),
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
    try {
        const rate = await rateLimit('auth-login:' + email.toLowerCase().trim(), 10, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait a moment.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait a moment.' }
    }

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
            return { ok: false, error: 'Invalid email or password.' }
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

    try {
        const rate = await rateLimit('delete-account:' + user.id, 3, 60_000)
        if (!rate.success) {
            return { ok: false as const, error: 'Too many attempts. Please wait.' }
        }
    } catch {
        return { ok: false as const, error: 'Too many attempts. Please wait.' }
    }

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

    try {
        const rate = await rateLimit('save-gang:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }

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
        .not('character_id', 'in', `(${newCharacterIds.join(',')})`)
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

    try {
        const rate = await rateLimit('save-username:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }

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
        .in('kind', ['episodic', 'compacted'])
        .order('created_at', { ascending: false })
        .limit(200)

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

    try {
        const rate = await rateLimit('delete-memory:' + user.id, 20, 60_000)
        if (!rate.success) return
    } catch { return }

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

    try {
        const rate = await rateLimit('update-memory:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }

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

    await rateLimit('get-memories:' + user.id, 30, 60_000)

    const limit = Math.min(Math.max(params?.limit ?? 30, 10), 80)
    let query = supabase
        .from('memories')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .in('kind', ['episodic', 'compacted'])
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

    await rateLimit('get-history:' + user.id, 30, 60_000)

    const limit = Math.min(Math.max(params?.limit ?? 40, 10), 120)
    const beforeCreatedAt = params?.before
        ? (params.before.includes('|') ? params.before.split('|')[0] : params.before)
        : null
    let query = supabase
        .from('chat_history')
        .select('id, speaker, content, created_at, reaction, reply_to_client_message_id, client_message_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit + 1)
    if (beforeCreatedAt) {
        query = query.lt('created_at', beforeCreatedAt)
    }

    const result = await query.returns<ChatHistoryPageRow[]>()

    if (result.error) {
        console.error('Error fetching chat history page:', result.error)
        return { items: [], hasMore: false, nextBefore: null as string | null }
    }
    const rows: ChatHistoryPageRow[] = result.data ?? []
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

    try {
        const rate = await rateLimit('update-settings:' + user.id, 20, 60_000)
        if (!rate.success) return
    } catch { return }

    const parsed = userSettingsSchema.safeParse(settings)
    if (!parsed.success) return

    // SEC-C1: Enforce tier-based squad limit on preferred_squad
    if (parsed.data.preferred_squad) {
        if (!parsed.data.preferred_squad.every(id => validCharacterIds.includes(id))) return
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', user.id)
            .single()
        const tier = getTierFromProfile(profile?.subscription_tier ?? null)
        const limit = getSquadLimit(tier)
        if (parsed.data.preferred_squad.length > limit) return
    }

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

    try {
        const rate = await rateLimit('delete-all-messages:' + user.id, 3, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait.' }
    }

    // Batched deletion to avoid statement timeouts on large histories
    let deleted = 0
    do {
        const { data: batch } = await supabase
            .from('chat_history')
            .select('id')
            .eq('user_id', user.id)
            .limit(500)
        if (!batch?.length) break
        deleted = batch.length
        const { error } = await supabase
            .from('chat_history')
            .delete()
            .in('id', batch.map(r => r.id))
        if (error) {
            console.error('Error deleting chat history batch:', error)
            return { ok: false, error: 'Could not delete chat history right now.' }
        }
    } while (deleted === 500)

    return { ok: true as const }
}

export async function deleteAllMemories() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated.' }

    try {
        const rate = await rateLimit('delete-all-memories:' + user.id, 3, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait.' }
    }

    // Batched deletion to avoid statement timeouts
    let deleted = 0
    do {
        const { data: batch } = await supabase
            .from('memories')
            .select('id')
            .eq('user_id', user.id)
            .limit(500)
        if (!batch?.length) break
        deleted = batch.length
        const { error } = await supabase
            .from('memories')
            .delete()
            .in('id', batch.map(r => r.id))
        if (error) {
            console.error('Error deleting memories batch:', error)
            return { ok: false, error: 'Could not delete memories right now.' }
        }
    } while (deleted === 500)

    return { ok: true as const }
}

export async function resetOnboarding() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated.' }

    try {
        const rate = await rateLimit('reset-onboarding:' + user.id, 2, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait.' }
    }

    // Use a SINGLE supabase client for all operations to avoid session propagation issues
    // when delegating to sub-functions that create their own clients.

    // 1. Delete chat history (batched)
    let chatDeleted = 0
    do {
        const { data: batch } = await supabase
            .from('chat_history')
            .select('id')
            .eq('user_id', user.id)
            .limit(500)
        if (!batch?.length) break
        chatDeleted = batch.length
        const { error } = await supabase
            .from('chat_history')
            .delete()
            .in('id', batch.map(r => r.id))
        if (error) {
            console.error('Error deleting chat history in resetOnboarding:', error)
            return { ok: false, error: 'Failed to delete chat history.' }
        }
    } while (chatDeleted === 500)

    // 2. Delete memories (batched)
    let memDeleted = 0
    do {
        const { data: batch } = await supabase
            .from('memories')
            .select('id')
            .eq('user_id', user.id)
            .limit(500)
        if (!batch?.length) break
        memDeleted = batch.length
        const { error } = await supabase
            .from('memories')
            .delete()
            .in('id', batch.map(r => r.id))
        if (error) {
            console.error('Error deleting memories in resetOnboarding:', error)
            return { ok: false, error: 'Failed to delete memories.' }
        }
    } while (memDeleted === 500)

    // 3. Delete gang members
    const { data: gang } = await supabase
        .from('gangs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (gang?.id) {
        const { error: gmError } = await supabase.from('gang_members').delete().eq('gang_id', gang.id)
        if (gmError) console.error('Error deleting gang members in resetOnboarding:', gmError)
    }

    // 4. Reset onboarding fields (does NOT touch subscription_tier, daily_msg_count, abuse_score)
    const { error } = await supabase
        .from('profiles')
        .update({
            onboarding_completed: false,
            preferred_squad: null,
            username: null,
            custom_character_names: null,
        })
        .eq('id', user.id)

    if (error) {
        console.error('Error resetting onboarding:', error)
        return { ok: false, error: 'Failed to reset profile.' }
    }

    // 5. Verify deletions actually worked
    const { count: remainingMem } = await supabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
    const { count: remainingChat } = await supabase
        .from('chat_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

    if ((remainingMem ?? 0) > 0 || (remainingChat ?? 0) > 0) {
        console.error('resetOnboarding: verification failed — memories:', remainingMem, 'chat:', remainingChat)
        return { ok: false, error: 'Reset incomplete. Please try again.' }
    }

    return { ok: true as const }
}

export async function saveMemoryManual(content: string) {
    const { storeMemory } = await import('@/lib/ai/memory')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
        const rate = await rateLimit('save-memory:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }

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

export async function addSquadTierMembers(characterIds: string[], _tier?: 'basic' | 'pro') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
        const rate = await rateLimit('add-squad-tier:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) return

    // Read actual tier from DB instead of trusting client
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()
    const tier = getTierFromProfile(profile?.subscription_tier ?? null)
    if (tier === 'free') return

    const rows = parsed.data.map(id => ({
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

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) return

    try {
        const rate = await rateLimit('squad-tier-action:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }

    await squadTierTable(supabase)
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('character_id', parsed.data)
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

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) return

    try {
        const rate = await rateLimit('squad-tier-action:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }

    await squadTierTable(supabase)
        .update({ is_active: true, deactivated_at: null })
        .eq('user_id', user.id)
        .in('character_id', parsed.data)
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
