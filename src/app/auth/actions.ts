'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { CHARACTERS } from '@/constants/characters'
import { AVATAR_STYLES, normalizeAvatarStyle, type AvatarStyle } from '@/lib/avatar-style'
import { sanitizeMessageId } from '@/lib/chat-utils'
import { getMemoryVaultPreviewLimit, getTierFromProfile, getSquadLimit } from '@/lib/billing'
import { filterActiveMemories } from '@/lib/ai/memory'
import {
    createMemoryMutationFailure,
    createMemoryMutationSuccess,
    type MemoryMutationResult,
} from '@/lib/memory-mutation'
import { persistGangMembership, SquadPersistenceError } from '@/lib/supabase/squad-persistence'
import { generateEventId, buildCompleteRegistrationEvent, sendCAPIEvent } from '@/lib/meta'

type ChatHistoryPageRow = {
    id: string
    speaker: string
    content: string
    created_at: string
    reaction?: string | null
    reply_to_client_message_id?: string | null
    client_message_id?: string | null
    source?: string | null
}

const validCharacterIds = CHARACTERS.map(c => c.id)

const usernameSchema = z.string().trim().min(1).max(50)
const memoryContentSchema = z.string().trim().min(1).max(2000)
const passwordResetEmailSchema = z.string().trim().email('Enter a valid email address.')
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
    avatar_style_preference: z.enum(AVATAR_STYLES).optional(),
}).strict()

async function getOrigin() {
    const headerBag = await headers()
    return (headerBag.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://mygang.ai').replace(/\/$/, '')
}

async function getRequestIp() {
    const headerBag = await headers()
    return headerBag.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headerBag.get('x-real-ip')
        || 'unknown'
}

function isCredentialErrorMessage(message: string) {
    return (
        message.includes('invalid login credentials') ||
        message.includes('invalid login') ||
        message.includes('invalid credentials') ||
        message.includes('email or password')
    )
}

function isEmailConfirmationError(code: string | undefined, message: string) {
    return code === 'email_not_confirmed' || message.includes('not confirmed')
}

type PasswordAuthIntent = 'auto' | 'sign_up'

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

export async function signInOrSignUpWithPassword(
    email: string,
    password: string,
    captchaToken?: string,
    intent: PasswordAuthIntent = 'auto',
) {
    try {
        const rate = await rateLimit('auth-login:' + email.toLowerCase().trim(), 10, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait a moment.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait a moment.' }
    }

    const supabase = await createClient()
    const origin = await getOrigin()

    if (intent !== 'sign_up') {
        const signInAttempt = await supabase.auth.signInWithPassword({
            email,
            password,
            options: captchaToken ? { captchaToken } : undefined,
        })

        if (!signInAttempt.error) {
            return { ok: true, action: 'signed_in' as const }
        }

        const signInMessage = signInAttempt.error.message?.toLowerCase() || ''
        if (isEmailConfirmationError(signInAttempt.error.code, signInMessage)) {
            return { ok: true, action: 'confirmation_required' as const, email }
        }

        const shouldTrySignUp = isCredentialErrorMessage(signInMessage)
        if (!shouldTrySignUp) {
            return { ok: false, error: signInAttempt.error.message }
        }

        // Turnstile tokens are single-use. If sign-in consumed one, the client
        // needs to fetch a fresh token before we can safely call sign-up.
        if (captchaToken) {
            return { ok: false as const, action: 'refresh_captcha_for_signup' as const }
        }
    }

    const signUpAttempt = await supabase.auth.signUp({
        email,
        password,
        options: {
            ...(captchaToken ? { captchaToken } : {}),
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
        // Fire CAPI CompleteRegistration (non-blocking)
        void (async () => {
            try {
                const headerBag = await headers()
                const ip = headerBag.get('x-forwarded-for')?.split(',')[0]?.trim()
                    || headerBag.get('x-real-ip')
                    || 'unknown'
                const userAgent = headerBag.get('user-agent') || ''
                const eventId = generateEventId()
                await sendCAPIEvent([
                    buildCompleteRegistrationEvent({ eventId, email, ip, userAgent }),
                ])
            } catch { /* non-fatal */ }
        })()
        return { ok: true, action: 'signed_up' as const }
    }

    if (!captchaToken) {
        const retrySignIn = await supabase.auth.signInWithPassword({ email, password })
        if (!retrySignIn.error) {
            return { ok: true, action: 'signed_in' as const }
        }

        const retryMessage = retrySignIn.error.message?.toLowerCase() || ''
        if (isEmailConfirmationError(retrySignIn.error.code, retryMessage)) {
            return { ok: true, action: 'confirmation_required' as const, email }
        }
    }

    return { ok: true, action: 'confirmation_required' as const, email }
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}

export async function requestPasswordReset(email: string, captchaToken?: string) {
    const parsedEmail = passwordResetEmailSchema.safeParse(email)
    if (!parsedEmail.success) {
        return { ok: false as const, error: parsedEmail.error.issues[0]?.message || 'Enter a valid email address.' }
    }

    const normalizedEmail = parsedEmail.data.toLowerCase()
    const requestIp = await getRequestIp()

    try {
        const [emailRate, ipRate] = await Promise.all([
            rateLimit('auth-reset-email:' + normalizedEmail, 5, 15 * 60_000),
            rateLimit('auth-reset-ip:' + requestIp, 12, 15 * 60_000),
        ])

        if (!emailRate.success || !ipRate.success) {
            return { ok: false as const, error: 'Too many reset attempts. Please wait a bit and try again.' }
        }
    } catch {
        return { ok: false as const, error: 'Too many reset attempts. Please wait a bit and try again.' }
    }

    const supabase = await createClient()
    const origin = await getOrigin()
    const redirectTo = `${origin}/auth/callback?next=/reset-password`

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
        ...(captchaToken ? { captchaToken } : {}),
    })

    if (error) {
        return { ok: false as const, error: error.message || 'Unable to send reset link right now.' }
    }

    return {
        ok: true as const,
        email: normalizedEmail,
    }
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

    if (!user) {
        throw new SquadPersistenceError('not_authenticated', 'You must be signed in to save your squad.')
    }

    try {
        const rate = await rateLimit('save-gang:' + user.id, 10, 60_000)
        if (!rate.success) {
            throw new SquadPersistenceError('rate_limited', 'Too many squad changes. Please wait a moment and try again.')
        }
    } catch (error) {
        if (error instanceof SquadPersistenceError) throw error
        throw new SquadPersistenceError('rate_limited', 'Too many squad changes. Please wait a moment and try again.')
    }

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) {
        throw new SquadPersistenceError('invalid_character_ids', parsed.error.issues[0]?.message || 'Invalid character ID')
    }

    // Enforce tier-based squad limit
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

    const tier = getTierFromProfile(profile?.subscription_tier ?? null)
    const limit = getSquadLimit(tier)
    if (parsed.data.length > limit) {
        throw new SquadPersistenceError(
            'tier_limit_exceeded',
            `Your ${tier} plan supports up to ${limit} squad members.`,
            { tier, limit }
        )
    }

    const persistedGang = await persistGangMembership(supabase, user.id, parsed.data)

    const { error: settingsError } = await supabase
        .from('profiles')
        .update({ preferred_squad: persistedGang.characterIds, onboarding_completed: true })
        .eq('id', user.id)

    if (settingsError) {
        throw new SquadPersistenceError(
            'profile_update_failed',
            'Could not update the saved squad settings.',
            { error: settingsError.message, userId: user.id }
        )
    }

    return {
        ok: true as const,
        gangId: persistedGang.gangId,
        characterIds: persistedGang.characterIds,
    }
}

export async function completeOnboarding(payload: {
    username: string
    characterIds: string[]
    customCharacterNames?: Record<string, string>
    vibeProfile?: Record<string, string>
    avatarStylePreference?: AvatarStyle
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new SquadPersistenceError('not_authenticated', 'You must be signed in to complete onboarding.')
    }

    try {
        const rate = await rateLimit('complete-onboarding:' + user.id, 10, 60_000)
        if (!rate.success) {
            throw new SquadPersistenceError('rate_limited', 'Too many onboarding attempts. Please wait a moment and try again.')
        }
    } catch (error) {
        if (error instanceof SquadPersistenceError) throw error
        throw new SquadPersistenceError('rate_limited', 'Too many onboarding attempts. Please wait a moment and try again.')
    }

    const parsedName = usernameSchema.safeParse(payload.username)
    if (!parsedName.success) {
        throw new SquadPersistenceError('profile_update_failed', parsedName.error.issues[0]?.message || 'Invalid username')
    }

    const parsedIds = characterIdsSchema.safeParse(payload.characterIds)
    if (!parsedIds.success) {
        throw new SquadPersistenceError('invalid_character_ids', parsedIds.error.issues[0]?.message || 'Invalid character ID')
    }

    const persistedGang = await persistGangMembership(supabase, user.id, parsedIds.data)
    const updates: Record<string, unknown> = {
        username: parsedName.data,
        preferred_squad: persistedGang.characterIds,
        onboarding_completed: true,
        custom_character_names: payload.customCharacterNames ?? null,
        avatar_style_preference: normalizeAvatarStyle(payload.avatarStylePreference),
    }

    if (payload.vibeProfile) {
        updates.vibe_profile = payload.vibeProfile
    }

    const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

    if (profileUpdateError) {
        throw new SquadPersistenceError(
            'profile_update_failed',
            'Could not finish onboarding in the cloud.',
            { error: profileUpdateError.message, userId: user.id }
        )
    }

    return {
        ok: true as const,
        gangId: persistedGang.gangId,
        characterIds: persistedGang.characterIds,
    }
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

    const tier = await getSubscriptionTierForUser(supabase, user.id)
    const previewLimit = getMemoryVaultPreviewLimit(tier)

    let query = supabase
        .from('memories')
        .select('id, content, created_at, expires_at')
        .eq('user_id', user.id)
        .in('kind', ['episodic', 'compacted'])
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })

    query = query.limit(previewLimit ?? 200)

    const { data, error } = await query

    if (error) {
        console.error('Error fetching memories:', error)
        return []
    }

    return filterActiveMemories(data ?? [])
}

export async function deleteMemory(id: string): Promise<MemoryMutationResult> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return createMemoryMutationFailure('not_authenticated', 'Not authenticated.')

    const tier = await getSubscriptionTierForUser(supabase, user.id)
    if (tier === 'free') return createMemoryMutationFailure('forbidden', 'Memory editing is not available on the free tier.')

    try {
        const rate = await rateLimit('delete-memory:' + user.id, 20, 60_000)
        if (!rate.success) return createMemoryMutationFailure('rate_limited', 'Too many attempts. Please wait.')
    } catch {
        return createMemoryMutationFailure('rate_limited', 'Too many attempts. Please wait.')
    }

    const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error deleting memory:', error)
        return createMemoryMutationFailure('unknown', 'Failed to delete memory. Please try again.')
    }

    return createMemoryMutationSuccess()
}

export async function updateMemory(id: string, content: string): Promise<MemoryMutationResult> {
    const parsed = memoryContentSchema.safeParse(content)
    if (!parsed.success) return createMemoryMutationFailure('invalid_content', parsed.error.issues[0]?.message || 'Invalid memory content.')

    const { generateEmbedding } = await import('@/lib/ai/memory')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return createMemoryMutationFailure('not_authenticated', 'Not authenticated.')

    const tier = await getSubscriptionTierForUser(supabase, user.id)
    if (tier === 'free') return createMemoryMutationFailure('forbidden', 'Memory editing is not available on the free tier.')

    try {
        const rate = await rateLimit('update-memory:' + user.id, 10, 60_000)
        if (!rate.success) return createMemoryMutationFailure('rate_limited', 'Too many attempts. Please wait.')
    } catch {
        return createMemoryMutationFailure('rate_limited', 'Too many attempts. Please wait.')
    }

    let embedding: number[] = []
    try {
        embedding = await generateEmbedding(parsed.data)
    } catch (err) {
        console.error('Error generating embedding:', err)
        return createMemoryMutationFailure('unknown', 'Unable to update memory right now.')
    }

    const { error } = await supabase
        .from('memories')
        .update({ content: parsed.data, embedding: embedding as unknown as string })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        console.error('Error updating memory:', error)
        return createMemoryMutationFailure('unknown', 'Failed to update memory. Please try again.')
    }

    return createMemoryMutationSuccess()
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

    if (!user) {
        return {
            items: [],
            hasMore: false,
            nextBefore: null as string | null,
            totalCount: 0,
            lockedCount: 0,
            previewLimit: 0,
            isPreview: false,
            canManage: false,
        }
    }

    await rateLimit('get-memories:' + user.id, 30, 60_000)

    const tier = await getSubscriptionTierForUser(supabase, user.id)
    const previewLimit = getMemoryVaultPreviewLimit(tier)
    const nowIso = new Date().toISOString()

    if (previewLimit) {
        const [countResult, pageResult] = await Promise.all([
            supabase
                .from('memories')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('kind', ['episodic', 'compacted'])
                .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
            supabase
                .from('memories')
                .select('id, content, created_at, expires_at')
                .eq('user_id', user.id)
                .in('kind', ['episodic', 'compacted'])
                .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
                .order('created_at', { ascending: false })
                .limit(previewLimit),
        ])

        if (countResult.error) {
            console.error('Error counting memory preview:', countResult.error)
        }

        if (pageResult.error) {
            console.error('Error fetching memory preview:', pageResult.error)
            return {
                items: [],
                hasMore: false,
                nextBefore: null as string | null,
                totalCount: 0,
                lockedCount: 0,
                previewLimit,
                isPreview: true,
                canManage: false,
            }
        }

        const activeRows = filterActiveMemories(pageResult.data ?? [], Date.now())
        const totalCount = countResult.count ?? activeRows.length
        return {
            items: activeRows,
            hasMore: false,
            nextBefore: null as string | null,
            totalCount,
            lockedCount: Math.max(totalCount - previewLimit, 0),
            previewLimit,
            isPreview: true,
            canManage: false,
        }
    }

    const limit = Math.min(Math.max(params?.limit ?? 30, 10), 80)
    const [countResult, pageResult] = await Promise.all([
        supabase
            .from('memories')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('kind', ['episodic', 'compacted'])
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
        (() => {
            let query = supabase
                .from('memories')
                .select('id, content, created_at, expires_at')
                .eq('user_id', user.id)
                .in('kind', ['episodic', 'compacted'])
                .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
                .order('created_at', { ascending: false })
                .limit(limit + 1)

            if (params?.before) {
                query = query.lt('created_at', params.before)
            }

            return query
        })(),
    ])

    const { data, error } = pageResult
    if (error) {
        console.error('Error fetching memory page:', error)
        return {
            items: [],
            hasMore: false,
            nextBefore: null as string | null,
            totalCount: 0,
            lockedCount: 0,
            previewLimit: 0,
            isPreview: false,
            canManage: true,
        }
    }

    const safeRows = filterActiveMemories(data ?? [], Date.now())
    const hasMore = safeRows.length > limit
    const items = (hasMore ? safeRows.slice(0, limit) : safeRows)
    const nextBefore = hasMore ? items[items.length - 1]?.created_at ?? null : null

    return {
        items,
        hasMore,
        nextBefore,
        totalCount: countResult.count ?? items.length,
        lockedCount: 0,
        previewLimit: 0,
        isPreview: false,
        canManage: true,
    }
}

async function getSubscriptionTierForUser(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
) {
    const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .maybeSingle()

    if (error) {
        console.error('Error fetching subscription tier for memory access:', error)
    }

    return getTierFromProfile(data?.subscription_tier ?? null)
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
        .select('id, speaker, content, created_at, reaction, reply_to_client_message_id, client_message_id, source')
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
            source: (row.source as 'chat' | 'wywa' | 'system') || 'chat',
        }))

    return {
        items,
        hasMore,
        nextBefore,
    }
}

export async function updateUserSettings(settings: {
    theme?: string
    chat_mode?: string
    low_cost_mode?: boolean
    preferred_squad?: string[]
    chat_wallpaper?: string
    custom_character_names?: Record<string, string>
    avatar_style_preference?: AvatarStyle
}) {
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
            vibe_profile: null,
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
const squadTierTable = (supabase: Awaited<ReturnType<typeof createClient>>) =>
    supabase.from('squad_tier_members')

export async function addSquadTierMembers(characterIds: string[], requestedTier?: 'basic' | 'pro') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new SquadPersistenceError('not_authenticated', 'You must be signed in to change paid squad members.')
    }
    void requestedTier

    try {
        const rate = await rateLimit('add-squad-tier:' + user.id, 10, 60_000)
        if (!rate.success) {
            throw new SquadPersistenceError('rate_limited', 'Too many squad changes. Please wait a moment and try again.')
        }
    } catch (error) {
        if (error instanceof SquadPersistenceError) throw error
        throw new SquadPersistenceError('rate_limited', 'Too many squad changes. Please wait a moment and try again.')
    }

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) {
        throw new SquadPersistenceError('invalid_character_ids', parsed.error.issues[0]?.message || 'Invalid character ID')
    }

    // Read actual tier from DB instead of trusting client
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()
    const tier = getTierFromProfile(profile?.subscription_tier ?? null)
    if (tier === 'free') {
        throw new SquadPersistenceError('tier_limit_exceeded', 'A paid plan is required to add paid squad members.', { tier })
    }

    const rows = parsed.data.map(id => ({
        user_id: user.id,
        character_id: id,
        added_at_tier: tier,
        is_active: true,
        deactivated_at: null,
    }))

    const { error } = await squadTierTable(supabase).upsert(rows, { onConflict: 'user_id,character_id' })
    if (error) {
        throw new SquadPersistenceError(
            'squad_tier_upsert_failed',
            'Could not save paid-tier squad members.',
            { error: error.message, userId: user.id, characterIds: parsed.data }
        )
    }

    return { ok: true as const, characterIds: parsed.data }
}

export async function deactivateSquadTierMembers(characterIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        throw new SquadPersistenceError('not_authenticated', 'You must be signed in to update paid squad members.')
    }

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) {
        throw new SquadPersistenceError('invalid_character_ids', parsed.error.issues[0]?.message || 'Invalid character ID')
    }

    try {
        const rate = await rateLimit('squad-tier-action:' + user.id, 10, 60_000)
        if (!rate.success) {
            throw new SquadPersistenceError('rate_limited', 'Too many squad changes. Please wait a moment and try again.')
        }
    } catch (error) {
        if (error instanceof SquadPersistenceError) throw error
        throw new SquadPersistenceError('rate_limited', 'Too many squad changes. Please wait a moment and try again.')
    }

    const { error } = await squadTierTable(supabase)
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('character_id', parsed.data)
    if (error) {
        throw new SquadPersistenceError(
            'squad_tier_deactivate_failed',
            'Could not deactivate paid squad members.',
            { error: error.message, userId: user.id, characterIds: parsed.data }
        )
    }

    return { ok: true as const, characterIds: parsed.data }
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
    if (!user) {
        throw new SquadPersistenceError('not_authenticated', 'You must be signed in to restore paid squad members.')
    }

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) {
        throw new SquadPersistenceError('invalid_character_ids', parsed.error.issues[0]?.message || 'Invalid character ID')
    }

    try {
        const rate = await rateLimit('squad-tier-action:' + user.id, 10, 60_000)
        if (!rate.success) {
            throw new SquadPersistenceError('rate_limited', 'Too many squad changes. Please wait a moment and try again.')
        }
    } catch (error) {
        if (error instanceof SquadPersistenceError) throw error
        throw new SquadPersistenceError('rate_limited', 'Too many squad changes. Please wait a moment and try again.')
    }

    const { error } = await squadTierTable(supabase)
        .update({ is_active: true, deactivated_at: null })
        .eq('user_id', user.id)
        .in('character_id', parsed.data)
    if (error) {
        throw new SquadPersistenceError(
            'squad_tier_restore_failed',
            'Could not restore paid squad members.',
            { error: error.message, userId: user.id, characterIds: parsed.data }
        )
    }

    return { ok: true as const, characterIds: parsed.data }
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
