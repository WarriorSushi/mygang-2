/**
 * Phase 06C: While You Were Away (WYWA) single-user generator.
 *
 * Generates a short batch of character messages for an inactive paid user,
 * writes them to chat_history with source='wywa', and updates the profile
 * last_wywa_generated_at timestamp.
 *
 * This module is admin-only and manual for now — no scheduler, no batch runner.
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { openRouterModel } from '@/lib/ai/openrouter'
import { createAdminClient } from '@/lib/supabase/admin'
import { CHARACTERS } from '@/constants/characters'
import { TYPING_STYLES } from './wywa-prompt'

// ── Constants ──

/** User must be inactive for at least 2 hours before WYWA fires. */
export const INACTIVITY_THRESHOLD_MS = 2 * 60 * 60 * 1000

/** Minimum 6 hours between WYWA generations for the same user. */
export const GENERATION_COOLDOWN_MS = 6 * 60 * 60 * 1000

/** Max users to attempt per cron run. */
export const MAX_CANDIDATES_PER_RUN = 10

/** Stop generating after this many successful WYWA batches per run. */
export const MAX_GENERATED_PER_RUN = 5

/** Number of recent chat-only messages to fetch for context. */
const HISTORY_CONTEXT_LIMIT = 10

/** Max characters per generated WYWA message. */
const MAX_WYWA_MESSAGE_CHARS = 280

/** WYWA LLM output token cap — keep small and cheap. */
const WYWA_MAX_OUTPUT_TOKENS = 400

// ── Result type ──

/** Minimum effective squad size for WYWA to generate. */
export const MIN_SQUAD_SIZE = 2

export type WywaResult =
    | { status: 'generated'; messagesWritten: number }
    | { status: 'skipped_free_tier' }
    | { status: 'skipped_recently_active' }
    | { status: 'skipped_cooldown' }
    | { status: 'skipped_no_squad' }
    | { status: 'skipped_insufficient_squad'; count: number }
    | { status: 'skipped_no_profile' }
    | { status: 'error'; message: string }

export type WywaBatchResult = {
    scanned: number
    eligible: number
    attempted: number
    generated: number
    skipped: Record<string, number>
    errored: number
    cappedAt: 'candidates' | 'generated' | null
}

// ── Pure helpers (exported for testing) ──

export function isEligibleTier(tier: string | null | undefined): boolean {
    return tier === 'basic' || tier === 'pro'
}

export function isInactiveEnough(lastActiveAt: string | null | undefined, now: number): boolean {
    if (!lastActiveAt) return true // never active — treat as inactive
    const lastActive = new Date(lastActiveAt).getTime()
    if (!Number.isFinite(lastActive)) return true
    return now - lastActive >= INACTIVITY_THRESHOLD_MS
}

export function isCooldownSatisfied(lastWywaAt: string | null | undefined, now: number): boolean {
    if (!lastWywaAt) return true // never generated
    const lastGen = new Date(lastWywaAt).getTime()
    if (!Number.isFinite(lastGen)) return true
    return now - lastGen >= GENERATION_COOLDOWN_MS
}

export function pickParticipants(squadIds: string[], count: number): string[] {
    if (squadIds.length <= count) return [...squadIds]
    // Fisher-Yates partial shuffle for random selection
    const arr = [...squadIds]
    for (let i = arr.length - 1; i > 0 && arr.length - i <= count; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(-count)
}

export function buildWywaMessageId(batchId: string, index: number): string {
    return `wywa-${batchId}-${index.toString(36)}`
}

export function buildStableTimestamps(baseTime: number, count: number): string[] {
    // Space messages 30-90 seconds apart for natural feel
    const timestamps: string[] = []
    let t = baseTime
    for (let i = 0; i < count; i++) {
        t += 30_000 + Math.floor(Math.random() * 60_000)
        timestamps.push(new Date(t).toISOString())
    }
    return timestamps
}

// ── Chat-history cooldown fallback ──

/**
 * Check whether the user has any recent WYWA rows in chat_history
 * within the generation cooldown window. This acts as a secondary
 * cooldown guard in case the profile's last_wywa_generated_at
 * update failed after a previous batch insert.
 */
export async function hasRecentWywaHistory(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    now: number,
): Promise<boolean> {
    const cooldownCutoff = new Date(now - GENERATION_COOLDOWN_MS).toISOString()

    const { count, error } = await admin
        .from('chat_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('source', 'wywa')
        .gte('created_at', cooldownCutoff)

    if (error) {
        // Fail closed — if we can't check, assume cooldown is active
        console.error('[wywa] Failed to check recent WYWA history:', error.message)
        return true
    }

    return (count ?? 0) > 0
}

// ── Effective squad resolution (mirrors client-journey.ts logic) ──

/**
 * Resolve the effective squad for a user, matching the app's precedence:
 * 1. gang_members (authoritative active squad)
 * 2. preferred_squad (fallback if gang members < MIN_SQUAD_SIZE)
 * Only includes IDs that exist in the CHARACTERS catalog.
 */
export async function resolveEffectiveSquad(
    admin: ReturnType<typeof createAdminClient>,
    userId: string,
    preferredSquad: string[] | null,
): Promise<{ gangId: string | null; squadIds: string[] }> {
    const knownIds = new Set(CHARACTERS.map(c => c.id))

    // Fetch gang
    const { data: gang } = await admin
        .from('gangs')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

    if (!gang) {
        // No gang — fall back to preferred_squad
        const fallback = (preferredSquad ?? []).filter(id => knownIds.has(id)).slice(0, 6)
        return { gangId: null, squadIds: fallback }
    }

    // Fetch gang_members
    const { data: members } = await admin
        .from('gang_members')
        .select('character_id')
        .eq('gang_id', gang.id)

    const gangIds = (members ?? [])
        .map(m => m.character_id)
        .filter((id): id is string => typeof id === 'string' && knownIds.has(id))
        .slice(0, 6)

    // Fall back to preferred_squad if gang_members insufficient
    if (gangIds.length < MIN_SQUAD_SIZE) {
        const fallback = (preferredSquad ?? []).filter(id => knownIds.has(id)).slice(0, 6)
        if (fallback.length >= MIN_SQUAD_SIZE) {
            return { gangId: gang.id, squadIds: fallback }
        }
        // Both sources insufficient — return whatever we have
        return { gangId: gang.id, squadIds: gangIds.length > 0 ? gangIds : fallback }
    }

    return { gangId: gang.id, squadIds: gangIds }
}

// ── Generator ──

export async function generateWywaForUser(userId: string): Promise<WywaResult> {
    const now = Date.now()
    const admin = createAdminClient()

    // 1. Fetch profile
    const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('subscription_tier, last_active_at, last_wywa_generated_at, custom_character_names, preferred_squad, username')
        .eq('id', userId)
        .maybeSingle()

    if (profileError) {
        return { status: 'error', message: `Profile fetch failed: ${profileError.message}` }
    }
    if (!profile) {
        return { status: 'skipped_no_profile' }
    }

    // 2. Eligibility checks
    if (!isEligibleTier(profile.subscription_tier)) {
        return { status: 'skipped_free_tier' }
    }
    if (!isInactiveEnough(profile.last_active_at, now)) {
        return { status: 'skipped_recently_active' }
    }
    if (!isCooldownSatisfied(profile.last_wywa_generated_at, now)) {
        return { status: 'skipped_cooldown' }
    }

    // 2b. Secondary cooldown: check recent WYWA rows in chat_history.
    // Protects against duplicate batches if last_wywa_generated_at update failed.
    if (await hasRecentWywaHistory(admin, userId, now)) {
        return { status: 'skipped_cooldown' }
    }

    // 3. Resolve effective squad (gang_members first, preferred_squad fallback)
    const { gangId, squadIds } = await resolveEffectiveSquad(
        admin,
        userId,
        profile.preferred_squad as string[] | null,
    )
    if (squadIds.length === 0) {
        return { status: 'skipped_no_squad' }
    }
    if (squadIds.length < MIN_SQUAD_SIZE) {
        return { status: 'skipped_insufficient_squad', count: squadIds.length }
    }
    if (!gangId) {
        return { status: 'error', message: 'No gang found for user' }
    }

    // 4. Pick 2-3 participants
    const participantCount = squadIds.length <= 2 ? squadIds.length : (2 + Math.floor(Math.random() * 2)) // 2 or 3
    const participants = pickParticipants(squadIds, participantCount)

    // 5. Build character context for participants (ID-first for reliable speaker output)
    const customNames = (profile.custom_character_names as Record<string, string> | null) ?? {}
    const participantDescriptions = buildParticipantBlock(participants, customNames)

    // 6. Fetch recent chat-only history for context
    const { data: recentHistory } = await admin
        .from('chat_history')
        .select('speaker, content')
        .eq('user_id', userId)
        .eq('source', 'chat')
        .order('created_at', { ascending: false })
        .limit(HISTORY_CONTEXT_LIMIT)

    const recentContext = (recentHistory ?? [])
        .reverse()
        .map(r => `${r.speaker}: ${(r.content || '').slice(0, 200)}`)
        .join('\n')

    // 7. Build WYWA prompt
    const userName = profile.username || 'the user'
    const systemPrompt = buildWywaSystemPrompt(participants, participantDescriptions, userName)
    const userPrompt = recentContext
        ? `Recent chat context (for topic awareness only — do NOT continue this conversation directly):\n${recentContext}`
        : 'No recent chat history available. Start a fresh casual conversation among yourselves.'

    // 8. Call LLM — constrain speaker to exact participant IDs
    const speakerEnum = z.enum(participants as [string, ...string[]])
    const responseSchema = z.object({
        messages: z.array(z.object({
            speaker: speakerEnum,
            content: z.string(),
        })).min(2).max(5),
    })

    let generated: z.infer<typeof responseSchema>
    try {
        const result = await generateObject({
            model: openRouterModel,
            schema: responseSchema,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            maxOutputTokens: WYWA_MAX_OUTPUT_TOKENS,
            maxRetries: 1,
        })
        generated = result.object
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown LLM error'
        return { status: 'error', message: `LLM call failed: ${msg}` }
    }

    // 9. Validate and shape rows
    const participantSet = new Set(participants)
    const validMessages = generated.messages
        .filter(m => participantSet.has(m.speaker) && m.content.trim().length > 0)
        .slice(0, 5)

    if (validMessages.length === 0) {
        return { status: 'error', message: 'LLM returned no valid messages' }
    }

    const batchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const timestamps = buildStableTimestamps(now, validMessages.length)

    const rows = validMessages.map((m, i) => ({
        user_id: userId,
        gang_id: gangId,
        speaker: m.speaker,
        content: m.content.slice(0, MAX_WYWA_MESSAGE_CHARS),
        created_at: timestamps[i],
        client_message_id: buildWywaMessageId(batchId, i),
        source: 'wywa' as const,
    }))

    // 10. Write to chat_history
    const { error: insertError } = await admin
        .from('chat_history')
        .insert(rows)

    if (insertError) {
        return { status: 'error', message: `Insert failed: ${insertError.message}` }
    }

    // 11. Update last_wywa_generated_at
    const { error: updateError } = await admin
        .from('profiles')
        .update({ last_wywa_generated_at: new Date(now).toISOString() })
        .eq('id', userId)

    if (updateError) {
        console.error('Failed to update last_wywa_generated_at:', updateError)
        // Non-fatal — rows were already written
    }

    return { status: 'generated', messagesWritten: rows.length }
}

// ── Candidate selection ──

/** Max paid profiles to fetch before code-side filtering. */
export const CANDIDATE_PREFETCH_LIMIT = 50

/**
 * Filter a list of profile rows down to WYWA-eligible candidates.
 * Pure function — exported for testing.
 */
export function filterEligibleCandidates(
    profiles: Array<{ id: string; subscription_tier: string | null; last_active_at: string | null; last_wywa_generated_at: string | null }>,
    now: number,
    limit: number,
): Array<{ id: string }> {
    const eligible: Array<{ id: string }> = []
    for (const p of profiles) {
        if (eligible.length >= limit) break
        if (!isEligibleTier(p.subscription_tier)) continue
        if (!isInactiveEnough(p.last_active_at, now)) continue
        if (!isCooldownSatisfied(p.last_wywa_generated_at, now)) continue
        eligible.push({ id: p.id })
    }
    return eligible
}

/**
 * Find WYWA-eligible candidates from the database.
 * Fetches a broad slice of paid profiles ordered deterministically,
 * filters by eligibility in code, then validates effective squad
 * before returning candidates. This prevents squad-less users from
 * consuming the small per-run candidate cap.
 */
export async function findWywaCandidates(
    admin: ReturnType<typeof createAdminClient>,
    now: number,
    limit: number,
): Promise<Array<{ id: string }>> {
    // Overfetch paid profiles with deterministic ordering:
    // 1. Least-recently generated first (nulls = never generated = highest priority)
    // 2. Least-recently active first (nulls = never active = high priority)
    // 3. Stable tie-breaker by id
    const { data, error } = await admin
        .from('profiles')
        .select('id, subscription_tier, last_active_at, last_wywa_generated_at, preferred_squad')
        .in('subscription_tier', ['basic', 'pro'])
        .order('last_wywa_generated_at', { ascending: true, nullsFirst: true })
        .order('last_active_at', { ascending: true, nullsFirst: true })
        .order('id', { ascending: true })
        .limit(CANDIDATE_PREFETCH_LIMIT)

    if (error) {
        console.error('[wywa-batch] Candidate query failed:', error.message)
        return []
    }

    // Phase 1: filter by tier, inactivity, cooldown (pure, no DB calls)
    const profileEligible = filterEligibleCandidates(data ?? [], now, CANDIDATE_PREFETCH_LIMIT)

    // Phase 2: filter by effective squad (requires per-user gang lookups)
    const candidates: Array<{ id: string }> = []
    // Build a lookup for preferred_squad from the prefetched data
    const profileMap = new Map((data ?? []).map(p => [p.id, p]))

    for (const candidate of profileEligible) {
        if (candidates.length >= limit) break

        const profile = profileMap.get(candidate.id)
        const preferredSquad = (profile?.preferred_squad as string[] | null) ?? null
        const { gangId, squadIds } = await resolveEffectiveSquad(admin, candidate.id, preferredSquad)

        if (!gangId) continue
        if (squadIds.length < MIN_SQUAD_SIZE) continue

        candidates.push({ id: candidate.id })
    }

    return candidates
}

/**
 * Run a WYWA batch: find candidates, generate for each, respect hard caps.
 * Failures for one user do not fail the whole run.
 */
export async function runWywaBatch(): Promise<WywaBatchResult> {
    const now = Date.now()
    const admin = createAdminClient()

    const result: WywaBatchResult = {
        scanned: 0,
        eligible: 0,
        attempted: 0,
        generated: 0,
        skipped: {},
        errored: 0,
        cappedAt: null,
    }

    const candidates = await findWywaCandidates(admin, now, MAX_CANDIDATES_PER_RUN)
    result.scanned = candidates.length

    if (candidates.length === 0) {
        return result
    }

    if (candidates.length >= MAX_CANDIDATES_PER_RUN) {
        result.cappedAt = 'candidates'
    }

    result.eligible = candidates.length

    for (const candidate of candidates) {
        // Stop if generation cap reached
        if (result.generated >= MAX_GENERATED_PER_RUN) {
            result.cappedAt = 'generated'
            break
        }

        result.attempted++

        try {
            const wywaResult = await generateWywaForUser(candidate.id)

            if (wywaResult.status === 'generated') {
                result.generated++
            } else if (wywaResult.status === 'error') {
                result.errored++
                console.error(`[wywa-batch] Error for user ${candidate.id}: ${wywaResult.message}`)
            } else {
                // Skipped — track by status
                const key = wywaResult.status
                result.skipped[key] = (result.skipped[key] ?? 0) + 1
            }
        } catch (err) {
            result.errored++
            const msg = err instanceof Error ? err.message : 'Unknown error'
            console.error(`[wywa-batch] Uncaught error for user ${candidate.id}: ${msg}`)
        }
    }

    return result
}

// ── Prompt helpers (exported for testing) ──

/**
 * Build the participant block for the WYWA prompt.
 * Format: `- speaker_id: "kael" | name: "Kale" | vibe: ... | style: ...`
 * The speaker_id is always the lowercase ID from the catalog.
 */
export function buildParticipantBlock(
    participantIds: string[],
    customNames: Record<string, string>,
): string {
    return participantIds.map(id => {
        const char = CHARACTERS.find(c => c.id === id)
        if (!char) return null
        const displayName = customNames[id] || char.name
        const style = TYPING_STYLES[id] || ''
        return `- speaker_id: "${id}" | name: "${displayName}" | vibe: ${char.vibe} | style: ${style}`
    }).filter(Boolean).join('\n')
}

// ── Prompt builder ──

function buildWywaSystemPrompt(
    participantIds: string[],
    participantDescriptions: string,
    userName: string,
): string {
    const speakerList = participantIds.map(id => `"${id}"`).join(', ')
    return `You generate casual background group chat messages for MyGang.

CONTEXT:
- ${userName} is away from the chat. These characters are chatting among themselves while the user is gone.
- The user will see these messages labeled "While you were away" when they return.

CHARACTERS IN THIS CONVERSATION:
${participantDescriptions}

CRITICAL — SPEAKER ID RULE:
- The "speaker" field in your output MUST be the exact speaker_id shown above (lowercase).
- NEVER use the display name. Use the ID. For example: "kael" not "Kael", "luna" not "Luna".
- Allowed speaker IDs: ${speakerList}
- Any other value will be rejected.

RULES:
- Generate 3-5 short messages. Each message should be 1-3 sentences max.
- Write casual, natural group chat banter. Light topics only.
- Characters should talk TO EACH OTHER, not to or about the absent user.
- Do NOT address the user directly. Do NOT say "where is [user]" or "I miss [user]".
- Do NOT generate any user messages. The "user" speaker is forbidden.
- Match each character's typing style and personality closely.
- Keep it light: jokes, banter, random topics, mild debates, daily life stuff.
- If recent chat context is provided, you may lightly reference a topic from it, but do NOT continue the conversation. Start something new.
- No melodrama. No deep emotional confessions. No relationship drama.
- No memory extraction. No summary updates. Just casual chat.
- No meta-commentary about being AI or being in a group chat app.`
}
