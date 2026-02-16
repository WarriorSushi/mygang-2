import { geminiModel } from '@/lib/ai/gemini'
import { generateObject } from 'ai'
import { z } from 'zod'
import { retrieveMemoriesLite, shouldTriggerMemoryUpdate, storeMemory, touchMemories } from '@/lib/ai/memory'
import { openRouterModel } from '@/lib/ai/openrouter'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { CHARACTERS } from '@/constants/characters'
import { ACTIVITY_STATUSES, normalizeActivityStatus } from '@/constants/character-greetings'
import { sanitizeMessageId, isMissingHistoryMetadataColumnsError, MAX_MESSAGE_ID_CHARS } from '@/lib/chat-utils'
import type { Json } from '@/lib/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 30

const MAX_EVENT_CONTENT = 700
const MAX_TOTAL_RESPONSE_CHARS = 3000
const MAX_EVENTS = 20
const MAX_DELAY_MS = 7000
const LLM_MAX_OUTPUT_TOKENS = 1200
const LLM_MAX_RETRIES = 0
const LLM_HISTORY_LIMIT = 12
const LLM_IDLE_HISTORY_LIMIT = 8
const LOW_COST_MAX_OUTPUT_TOKENS = 800
const LOW_COST_HISTORY_LIMIT = 8
const LOW_COST_IDLE_HISTORY_LIMIT = 6
const MAX_LLM_MESSAGE_CHARS = 500
const MAX_MEMORY_CONTENT_CHARS = 220
const MAX_SESSION_SUMMARY_CHARS = 500
const MAX_PROFILE_LINES = 12
const MAX_PROFILE_VALUE_CHARS = 120
const PROVIDER_DEFAULT_COOLDOWN_MS = 90_000
const PROVIDER_RETRY_FLOOR_MS = 15_000
const PROVIDER_RETRY_CEILING_MS = 10 * 60 * 1000
const OPENROUTER_CREDIT_COOLDOWN_MS = 5 * 60 * 1000
const ADMIN_SETTINGS_CACHE_MS = 20_000

let geminiCooldownUntil = 0
let openRouterCooldownUntil = 0
let cachedGlobalLowCostOverride: { value: boolean; expiresAtMs: number } = {
    value: false,
    expiresAtMs: 0
}

const CHARACTER_EXTENDED_VOICES: Record<string, string> = {
    kael: 'Hypes everything up. Uses "we" a lot. Speaks in declarations. Loves emojis but not excessively. Competitive with Cleo. Thinks he is the main character.',
    nyx: 'Deadpan one-liners. Uses lowercase. Rarely uses emojis. Roasts everyone equally. Clashes with Rico (logic vs chaos). Secretly cares but would never admit it.',
    atlas: 'Short, direct sentences. Protective dad-friend energy. Gives actual advice. Gets annoyed by Rico. Respects Vee. Uses military-adjacent language casually.',
    luna: 'Dreamy and warm. Uses "..." and trailing thoughts. Reads the room emotionally. Mediates conflicts. Sometimes too real. Vibes with Ezra on deep topics.',
    rico: 'ALL CAPS when excited. Chaotic energy. Derails conversations. Uses excessive emojis and slang. Clashes with Nyx and Atlas. Hypes up bad ideas enthusiastically.',
    vee: 'Starts corrections with "actually" or "technically". Uses precise language. Dry humor. Respects Atlas. Gets exasperated by Rico. Drops random facts.',
    ezra: 'References obscure art/philosophy. Uses italics mentally. Pretentious but self-aware about it. Vibes with Luna. Judges Kael\'s taste. Speaks in metaphors.',
    cleo: 'Judgmental but entertaining. Uses "honey", "darling", "sweetie". Gossips. Competes with Kael for social dominance. Has strong opinions on everything. Dramatic pauses.',
}

const CHARACTER_PROMPT_BLOCKS = new Map(
    CHARACTERS.map((c) => [
        c.id,
        `- ID: "${c.id}", Name: "${c.name}", Archetype: "${c.archetype}", Voice: "${c.voice}", Style: "${c.sample}"${CHARACTER_EXTENDED_VOICES[c.id] ? `\n  Personality: ${CHARACTER_EXTENDED_VOICES[c.id]}` : ''}`
    ])
)

let cachedDbPromptBlocks: Record<string, string> | null = null

type DbCharacterPromptRow = {
    id: string
    prompt_block: string | null
    name: string
    archetype: string
    voice_description: string
    sample_line: string
}

type RelationshipState = {
    affinity: number
    trust: number
    banter: number
    protectiveness: number
    note?: string
}

type ProfileStateRow = {
    user_profile: Record<string, unknown> | null
    relationship_state: Record<string, RelationshipState> | null
    session_summary: string | null
    summary_turns: number | null
    daily_msg_count: number | null
    last_msg_reset: string | null
    subscription_tier: string | null
    abuse_score: number | null
}

type ProfileUpdatesPayload = {
    last_active_at: string
    user_profile?: Json
    relationship_state?: Json
    session_summary?: string
    summary_turns?: number
}

type ChatRouteMetric = {
    source: 'user' | 'autonomous' | 'autonomous_idle'
    lowCostMode: boolean
    globalLowCostOverride: boolean
    status: number
    providerUsed: 'gemini' | 'openrouter' | 'fallback'
    providerCapacityBlocked: boolean
    clientMessagesCount: number
    llmHistoryCount: number
    promptChars: number
    eventsCount?: number
    shouldContinue?: boolean
    elapsedMs: number
}

type ChatMessageInput = {
    id: string
    speaker: string
    content: string
    created_at: string
    reaction?: string
    replyToId?: string
}

type ChatHistoryInsertRow = {
    user_id: string
    gang_id: string
    speaker: string
    content: string
    is_guest: boolean
    created_at: string
    client_message_id?: string | null
    reply_to_client_message_id?: string | null
    reaction?: string | null
}

type ChatHistoryUserRecentRow = {
    content: string | null
    created_at: string | null
    client_message_id?: string | null
}

type ChatHistoryExistingIdRow = {
    client_message_id: string | null
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function createServerTurnId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createServerEventMessageId(turnId: string, index: number) {
    return `srv-${turnId}-${index.toString(36)}`
}

function toLegacyHistoryRows(rows: ChatHistoryInsertRow[]) {
    return rows.map((row) => ({
        user_id: row.user_id,
        gang_id: row.gang_id,
        speaker: row.speaker,
        content: row.content,
        is_guest: row.is_guest,
        created_at: row.created_at
    }))
}

async function getDbPromptBlocks(supabase: SupabaseClient) {
    if (cachedDbPromptBlocks) return cachedDbPromptBlocks
    const { data, error } = await supabase
        .from('characters')
        .select('id, prompt_block, name, archetype, voice_description, sample_line')
        .returns<DbCharacterPromptRow[]>()

    if (error || !data) {
        if (error) console.error('Error loading character prompt blocks:', error)
        return null
    }

    const map: Record<string, string> = {}
    data.forEach((row) => {
        const block = row.prompt_block
            ? row.prompt_block
            : `- ID: "${row.id}", Name: "${row.name}", Archetype: "${row.archetype}", Voice: "${row.voice_description}", Style: "${row.sample_line}"`
        map[row.id] = block
    })
    cachedDbPromptBlocks = map
    return map
}

async function getGlobalLowCostOverride() {
    const nowMs = Date.now()
    if (nowMs < cachedGlobalLowCostOverride.expiresAtMs) {
        return cachedGlobalLowCostOverride.value
    }

    try {
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('admin_runtime_settings')
            .select('global_low_cost_override')
            .eq('id', 'global')
            .maybeSingle()
        if (error) {
            if (error.code !== 'PGRST205' && error.code !== '42P01') {
                console.error('Failed to read global low-cost override:', error)
            }
            cachedGlobalLowCostOverride = { value: false, expiresAtMs: nowMs + ADMIN_SETTINGS_CACHE_MS }
            return false
        }

        const value = !!data?.global_low_cost_override
        cachedGlobalLowCostOverride = { value, expiresAtMs: nowMs + ADMIN_SETTINGS_CACHE_MS }
        return value
    } catch (err) {
        console.error('Failed to load admin runtime settings:', err)
        cachedGlobalLowCostOverride = { value: false, expiresAtMs: nowMs + ADMIN_SETTINGS_CACHE_MS }
        return false
    }
}

async function logChatRouteMetric(
    supabase: SupabaseClient,
    userId: string | null,
    metric: ChatRouteMetric
) {
    console.info('chat_route_metrics', metric)
    const sessionId = `server-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const metadata = metric
    try {
        const { error } = await supabase
            .from('analytics_events')
            .insert({
                user_id: userId,
                session_id: sessionId,
                event: 'chat_route_metrics',
                metadata,
            })
        if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
            console.error('Failed to persist chat route metric:', error)
        }
    } catch (err) {
        console.error('Failed to record chat route metric:', err)
    }
}

const HARD_BLOCK_PATTERNS = [
    /(?:child|minor)\s*(?:sex|porn|nude)/i,
    /(?:rape|sexual\s+assault)/i
]

const SOFT_BLOCK_PATTERNS = [
    /suicide|self\s*harm|kill\s+myself/i,
    /harm\s+yourself|kill\s+yourself/i
]

function detectUnsafeContent(text: string) {
    const hard = HARD_BLOCK_PATTERNS.some((re) => re.test(text))
    const soft = !hard && SOFT_BLOCK_PATTERNS.some((re) => re.test(text))
    return { hard, soft }
}

function scoreAbuse(text: string, previousUserMessage?: string) {
    let score = 0
    if (!text) return score
    if (text.length > 1500) score += 1
    if ((text.match(/https?:\/\//g) || []).length >= 2) score += 2
    if (/([a-zA-Z0-9])\1{6,}/.test(text)) score += 1
    if (previousUserMessage && text.trim() === previousUserMessage.trim()) score += 1
    if (/<script|<\/script|javascript:/i.test(text)) score += 2
    return score
}

function hasOpenFloorIntent(text: string) {
    const value = text.toLowerCase()
    return (
        /you guys talk|talk among yourselves|keep chatting|continue without me|i'?ll listen|i will listen/.test(value)
        || /just talk|carry on|keep going|go on without me/.test(value)
    )
}

function splitMessageForSecondBubble(content: string): [string, string] | null {
    const normalized = content.replace(/\s+/g, ' ').trim()
    if (normalized.length < 80) return null

    const middle = Math.floor(normalized.length / 2)
    const breakpoints: number[] = []
    const punct = /[.!?;:]\s+|,\s+|\)\s+|-\s+/g
    let match: RegExpExecArray | null
    while ((match = punct.exec(normalized)) !== null) {
        const idx = match.index + match[0].length
        if (idx > 20 && idx < normalized.length - 20) breakpoints.push(idx)
    }

    let splitAt = -1
    if (breakpoints.length > 0) {
        splitAt = breakpoints.reduce((best, current) => (
            Math.abs(current - middle) < Math.abs(best - middle) ? current : best
        ), breakpoints[0])
    } else {
        const left = normalized.lastIndexOf(' ', middle)
        const right = normalized.indexOf(' ', middle)
        splitAt = left > 20 ? left : right
    }

    if (splitAt < 20 || splitAt > normalized.length - 20) return null
    const first = normalized.slice(0, splitAt).trim()
    const second = normalized.slice(splitAt).trim()
    if (first.length < 12 || second.length < 12) return null
    return [first, second]
}

function maybeSplitAiMessages(
    events: RouteResponseObject['events'],
    splitChance: number
): RouteResponseObject['events'] {
    const expanded: RouteResponseObject['events'] = []

    for (const event of events) {
        if (event.type !== 'message') {
            expanded.push(event)
            continue
        }

        const shouldSplit = Math.random() < splitChance
        if (!shouldSplit) {
            expanded.push(event)
            continue
        }

        const parts = splitMessageForSecondBubble(event.content)
        if (!parts) {
            expanded.push(event)
            continue
        }

        const [first, second] = parts
        expanded.push({ ...event, content: first })
        expanded.push({
            ...event,
            content: second,
            delay: Math.min(MAX_DELAY_MS, Math.max(180, Math.round(240 + Math.random() * 360)))
        })
    }

    return expanded.slice(0, MAX_EVENTS)
}

const responseSchema = z.object({
    events: z.array(
        z.discriminatedUnion('type', [
            z.object({
                type: z.literal('message'),
                character: z.string().describe('Character ID'),
                message_id: z.string().max(MAX_MESSAGE_ID_CHARS).optional().describe('Stable message ID'),
                content: z.string().min(1).describe('Message text'),
                target_message_id: z.string().optional().describe('ID of message being reacted to or quoted'),
                delay: z.number().describe('Delay in ms after the *previous* event to create a natural rhythm'),
            }),
            z.object({
                type: z.literal('reaction'),
                character: z.string().describe('Character ID'),
                message_id: z.string().max(MAX_MESSAGE_ID_CHARS).optional().describe('Stable message ID'),
                content: z.string().optional().describe('Emoji for reaction'),
                target_message_id: z.string().optional().describe('ID of message being reacted to or quoted'),
                delay: z.number().describe('Delay in ms after the *previous* event to create a natural rhythm'),
            }),
            z.object({
                type: z.literal('status_update'),
                character: z.string().describe('Character ID'),
                content: z.string().optional().describe('Status text'),
                delay: z.number().describe('Delay in ms after the *previous* event to create a natural rhythm'),
            }),
            z.object({
                type: z.literal('nickname_update'),
                character: z.string().describe('Character ID'),
                content: z.string().min(1).describe('New nickname'),
                delay: z.number().describe('Delay in ms after the *previous* event to create a natural rhythm'),
            }),
            z.object({
                type: z.literal('typing_ghost'),
                character: z.string().describe('Character ID'),
                content: z.string().optional(),
                delay: z.number().describe('Delay in ms after the *previous* event to create a natural rhythm'),
            }),
        ])
    ).max(20),
    responders: z.array(z.string()).optional().describe('Characters chosen to respond this turn'),
    should_continue: z.boolean().optional().describe('True if the conversation flow suggests the characters should keep talking (autonomous continuation).'),
    memory_updates: z.object({
        profile: z.array(z.object({
            key: z.string().min(1),
            value: z.string().min(1)
        })).optional(),
        episodic: z.array(z.object({
            content: z.string().min(1),
            tags: z.array(z.string()).optional(),
            importance: z.number().int().min(1).max(5).optional()
        })).optional()
    }).optional(),
    relationship_updates: z.array(z.object({
        character: z.string().min(1),
        affinity_delta: z.number().int().min(-3).max(3).optional(),
        trust_delta: z.number().int().min(-3).max(3).optional(),
        banter_delta: z.number().int().min(-3).max(3).optional(),
        protectiveness_delta: z.number().int().min(-3).max(3).optional(),
        note: z.string().optional()
    })).optional(),
    session_summary_update: z.string().optional()
})
type RouteResponseObject = z.infer<typeof responseSchema>

const requestSchema = z.object({
    messages: z.array(z.object({
        id: z.string().min(1).max(128),
        speaker: z.string().min(1).max(32),
        content: z.string().max(2000),
        created_at: z.string(),
        reaction: z.string().optional(),
        replyToId: z.string().max(128).optional(),
    })).max(40),
    activeGangIds: z.array(z.string().min(1).max(32)).max(4).optional(),
    activeGang: z.array(z.object({ id: z.string().min(1).max(32) })).max(4).optional(),
    userName: z.string().nullable().optional(),
    userNickname: z.string().nullable().optional(),
    isFirstMessage: z.boolean().optional(),
    silentTurns: z.number().int().min(0).max(30).optional(),
    burstCount: z.number().int().min(0).max(3).optional(),
    chatMode: z.enum(['entourage', 'ecosystem']).optional(),
    lowCostMode: z.boolean().optional(),
    source: z.enum(['user', 'autonomous', 'autonomous_idle']).optional(),
    autonomousIdle: z.boolean().optional(),
})

function getStatusCodeFromError(err: unknown, depth = 0): number | null {
    if (depth > 4 || !isObject(err)) return null
    const directStatus = err['statusCode']
    if (typeof directStatus === 'number') return directStatus

    const data = err['data']
    if (isObject(data) && typeof data['code'] === 'number') return data['code']

    const causeStatus = getStatusCodeFromError(err['cause'], depth + 1)
    if (causeStatus !== null) return causeStatus

    const lastErrorStatus = getStatusCodeFromError(err['lastError'], depth + 1)
    if (lastErrorStatus !== null) return lastErrorStatus

    const nestedErrors = err['errors']
    if (Array.isArray(nestedErrors)) {
        for (const nested of nestedErrors) {
            const nestedStatus = getStatusCodeFromError(nested, depth + 1)
            if (nestedStatus !== null) return nestedStatus
        }
    }

    return null
}

function getMessageFromError(err: unknown, depth = 0): string {
    if (depth > 4 || !err) return ''
    if (err instanceof Error && err.message) return err.message
    if (isObject(err)) {
        const directMessage = err['message']
        if (typeof directMessage === 'string' && directMessage.trim().length > 0) return directMessage

        const causeMessage = getMessageFromError(err['cause'], depth + 1)
        if (causeMessage) return causeMessage

        const lastErrorMessage = getMessageFromError(err['lastError'], depth + 1)
        if (lastErrorMessage) return lastErrorMessage

        const nestedErrors = err['errors']
        if (Array.isArray(nestedErrors)) {
            for (const nested of nestedErrors) {
                const nestedMessage = getMessageFromError(nested, depth + 1)
                if (nestedMessage) return nestedMessage
            }
        }
    }
    return ''
}

function isProviderCapacityError(err: unknown) {
    const statusCode = getStatusCodeFromError(err)
    if (statusCode === 402 || statusCode === 429) return true
    const message = getMessageFromError(err)
    return /quota|credit|resource_exhausted|max[_\s-]?tokens?|billing|retry in/i.test(message)
}

function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value))
}

function getRetryDelayMsFromError(err: unknown): number | null {
    const message = getMessageFromError(err)
    if (!message) return null

    const retryInMatch = message.match(/retry in\s+(\d+(?:\.\d+)?)s/i)
    if (retryInMatch) {
        const parsed = Number(retryInMatch[1])
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.round(parsed * 1000)
        }
    }

    const retryDelayMatch = message.match(/"retryDelay"\s*:\s*"(\d+)s"/i)
    if (retryDelayMatch) {
        const parsed = Number(retryDelayMatch[1])
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.round(parsed * 1000)
        }
    }

    return null
}

function getProviderCooldownMs(err: unknown, provider: 'gemini' | 'openrouter') {
    const statusCode = getStatusCodeFromError(err)
    const message = getMessageFromError(err)

    if (provider === 'openrouter' && statusCode === 402) {
        return OPENROUTER_CREDIT_COOLDOWN_MS
    }
    if (provider === 'gemini' && /limit:\s*0/i.test(message)) {
        return PROVIDER_RETRY_CEILING_MS
    }

    const retryDelayMs = getRetryDelayMsFromError(err)
    if (retryDelayMs !== null) {
        return clampNumber(retryDelayMs + 1000, PROVIDER_RETRY_FLOOR_MS, PROVIDER_RETRY_CEILING_MS)
    }

    return PROVIDER_DEFAULT_COOLDOWN_MS
}

function ensureEventMessageIds(
    events: RouteResponseObject['events'],
    turnId: string
): RouteResponseObject['events'] {
    let autoIdIndex = 0
    return events.map((event) => {
        if (event.type !== 'message' && event.type !== 'reaction') {
            return event
        }

        const explicitMessageId = sanitizeMessageId(event.message_id)
        const message_id = explicitMessageId || createServerEventMessageId(turnId, autoIdIndex++)
        const target_message_id = sanitizeMessageId(event.target_message_id) || undefined
        return {
            ...event,
            message_id,
            target_message_id,
        }
    })
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const parsed = requestSchema.safeParse(body)
        if (!parsed.success) {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: "Invalid request payload. Please refresh and try again.",
                    delay: 200
                }]
            }, { status: 400 })
        }

        const {
            messages,
            activeGangIds,
            activeGang,
            userName,
            userNickname,
            silentTurns = 0,
            chatMode = 'ecosystem',
            lowCostMode: requestedLowCostMode = false,
            source = 'user',
            autonomousIdle = false
        } = parsed.data
        const requestStartedAt = Date.now()
        const serverTurnId = createServerTurnId()

        const requestedIds = activeGangIds ?? activeGang?.map((c) => c.id) ?? []
        const knownIds = new Set(CHARACTERS.map((c) => c.id))
        const filteredIds = requestedIds.filter((id) => knownIds.has(id)).slice(0, 4)
        if (filteredIds.length !== 4) {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: "Invalid gang selection. Please pick exactly 4 characters and try again.",
                    delay: 200
                }]
            }, { status: 400 })
        }

        const activeGangSafe = CHARACTERS.filter((c) => filteredIds.includes(c.id))
        const allowedSpeakers = new Set<string>(['user', ...filteredIds])
        const safeMessages: ChatMessageInput[] = messages
            .filter((m) => allowedSpeakers.has(m.speaker))
            .map((m) => ({
                id: sanitizeMessageId(m.id) || `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                speaker: m.speaker,
                content: m.content.trim().slice(0, 2000),
                created_at: m.created_at,
                reaction: typeof m.reaction === 'string' ? m.reaction.trim().slice(0, MAX_EVENT_CONTENT) : undefined,
                replyToId: sanitizeMessageId(m.replyToId) || undefined
            }))
            .filter((m) => m.content.length > 0)

        const mockHeader = req.headers.get('x-mock-ai')
        if (process.env.NODE_ENV !== 'production' && (mockHeader === '1' || mockHeader === 'true')) {
            return Response.json({
                events: [
                    {
                        type: 'message',
                        character: filteredIds[0],
                        message_id: createServerEventMessageId(serverTurnId, 0),
                        content: 'Mock response: gang online and ready.',
                        delay: 200
                    },
                    {
                        type: 'reaction',
                        character: filteredIds[1],
                        message_id: createServerEventMessageId(serverTurnId, 1),
                        content: '\u{1F44D}',
                        delay: 200
                    }
                ],
                responders: filteredIds.slice(0, 2),
                should_continue: false
            })
        }

        const supabase = await createClient()
        const [{ data: { user } }, globalLowCostOverride] = await Promise.all([
            supabase.auth.getUser(),
            getGlobalLowCostOverride(),
        ])
        const lowCostMode = requestedLowCostMode || globalLowCostOverride

        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || 'unknown'
        const rateKey = user?.id ? `chat:user:${user.id}` : `chat:ip:${ip}`
        const rateLimitMax = user ? 60 : 20
        const rate = await rateLimit(rateKey, rateLimitMax, 60_000)
        if (!rate.success) {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: "You're sending messages too fast. Give it a moment and try again.",
                    delay: 200
                }]
            }, { status: 429 })
        }

        const userMessages = safeMessages.filter((m) => m.speaker === 'user')
        const lastUserMessage = userMessages[userMessages.length - 1]
        const latestUserMessageId = lastUserMessage?.id
        const previousUserMessage = userMessages[userMessages.length - 2]
        const latestMessage = safeMessages[safeMessages.length - 1]
        const hasFreshUserTurn = latestMessage?.speaker === 'user'
        const lastUserMsg = lastUserMessage?.content || ''
        const openFloorRequested = hasFreshUserTurn && hasOpenFloorIntent(lastUserMsg)
        const lastUserMsgAt = lastUserMessage?.created_at ? new Date(lastUserMessage.created_at).getTime() : 0
        const inactiveMinutes = lastUserMsgAt ? (Date.now() - lastUserMsgAt) / (1000 * 60) : 0
        const isInactive = inactiveMinutes > 5
        const unsafeFlag = detectUnsafeContent(lastUserMsg)
        const abuseDelta = scoreAbuse(lastUserMsg, previousUserMessage?.content)

        if (unsafeFlag.hard) {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: "I can't help with that. Please keep the conversation safe and respectful.",
                    delay: 200
                }],
                should_continue: false
            }, { status: 400 })
        }

        // 1. Retrieve Memories + Profile State
        let relevantMemories: { id: string; content: string }[] = []
        let memorySnapshot = 'No memory snapshot available.'
        let shouldUpdateSummary = false
        let allowMemoryUpdates = false
        let summaryTurns = 0
        let profileRow: ProfileStateRow | null = null
        let nextAbuseScore: number | null = null

        if (user) {
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('user_profile, relationship_state, session_summary, summary_turns, daily_msg_count, last_msg_reset, subscription_tier, abuse_score')
                    .eq('id', user.id)
                    .single<ProfileStateRow>()

                profileRow = profile

                const now = new Date()
                let dailyCount = profile?.daily_msg_count ?? 0
                const lastReset = profile?.last_msg_reset ? new Date(profile.last_msg_reset) : null
                if (!lastReset || (now.getTime() - lastReset.getTime()) > 24 * 60 * 60 * 1000) {
                    dailyCount = 0
                    await supabase.from('profiles').update({
                        daily_msg_count: 0,
                        last_msg_reset: now.toISOString()
                    }).eq('id', user.id)
                }

                const dailyLimit = profile?.subscription_tier === 'pro' ? 300 : 80
                if (hasFreshUserTurn && dailyCount >= dailyLimit) {
                    return Response.json({
                        events: [{
                            type: 'message',
                            character: 'system',
                            content: "Daily limit reached. Come back tomorrow or upgrade for more.",
                            delay: 200
                        }]
                    }, { status: 429 })
                }

                if (hasFreshUserTurn) {
                    const currentAbuse = profile?.abuse_score ?? 0
                    nextAbuseScore = Math.max(0, currentAbuse + abuseDelta - 1)
                    if (nextAbuseScore >= 12) {
                        return Response.json({
                            events: [{
                                type: 'message',
                                character: 'system',
                                content: "You're sending too many risky or repeated messages. Pause and try again later.",
                                delay: 200
                            }]
                        }, { status: 429 })
                    }
                }

                summaryTurns = profile?.summary_turns ?? 0
                shouldUpdateSummary = summaryTurns >= 8
                allowMemoryUpdates = hasFreshUserTurn && shouldTriggerMemoryUpdate(lastUserMsg)

                if (lastUserMsg.trim()) {
                    const memories = await retrieveMemoriesLite(user.id, lastUserMsg, 5)
                    relevantMemories = memories.map((m) => ({ id: m.id, content: m.content }))
                    await touchMemories(memories.map((m) => m.id))
                }

                const userProfile = isObject(profile?.user_profile) ? profile.user_profile : {}
                const relationshipState = isObject(profile?.relationship_state) ? (profile.relationship_state as Record<string, RelationshipState>) : {}
                const sessionSummary = (profile?.session_summary || 'No summary yet.').slice(0, MAX_SESSION_SUMMARY_CHARS)

                const relationshipBoard = activeGangSafe.map((c) => {
                    const state = relationshipState?.[c.id] || { affinity: 50, trust: 50, banter: 50, protectiveness: 50, note: '' }
                    const note = state.note ? ` | ${state.note}` : ''
                    return `- ${c.name}: affinity ${state.affinity}, trust ${state.trust}, banter ${state.banter}, protectiveness ${state.protectiveness}${note}`
                }).join('\n')

                const profileLines = Object.keys(userProfile).length > 0
                    ? Object.entries(userProfile)
                        .slice(0, MAX_PROFILE_LINES)
                        .map(([k, v]) => `- ${k}: ${String(v).slice(0, MAX_PROFILE_VALUE_CHARS)}`)
                        .join('\n')
                    : 'No profile facts yet.'

                memorySnapshot = `
== MEMORY SNAPSHOT ==
USER PROFILE:
${profileLines}

TOP MEMORIES:
${relevantMemories.map(m => `- ${m.content.slice(0, MAX_MEMORY_CONTENT_CHARS)}`).join('\n') || 'No memories yet.'}

RELATIONSHIP BOARD:
${relationshipBoard || 'No relationship data yet.'}

SESSION SUMMARY:
${sessionSummary}
`
            } catch (err) {
                console.error('Error retrieving memory/profile state:', err)
            }
        }

        // 2. Contextual Logic
        // Build the characters context
        let characterContextBlocks: string[] = []
        if (process.env.USE_DB_CHARACTERS === 'true') {
            const dbBlocks = await getDbPromptBlocks(supabase)
            characterContextBlocks = activeGangSafe.map((c) => dbBlocks?.[c.id] || CHARACTER_PROMPT_BLOCKS.get(c.id) || '')
        } else {
            characterContextBlocks = activeGangSafe.map((c) => CHARACTER_PROMPT_BLOCKS.get(c.id) || '')
        }
        const characterContext = characterContextBlocks.filter(Boolean).join('\n')

        const isEntourageMode = chatMode === 'entourage'
        const baseResponders = isEntourageMode ? 3 : (lowCostMode ? 2 : 3)
        const idleMaxResponders = autonomousIdle ? Math.min(2, baseResponders) : baseResponders
        const maxResponders = lastUserMsg.length < 40 ? Math.min(2, idleMaxResponders) : idleMaxResponders
        const safetyDirective = unsafeFlag.soft
            ? 'SAFETY FLAG: YES. Respond with empathy and support. Avoid harmful instructions or graphic details. Encourage reaching out to trusted people or local support.'
            : 'SAFETY FLAG: NO.'
        const allowedStatusList = ACTIVITY_STATUSES.map((status) => `- "${status}"`).join('\n')

        const systemPrompt = `
You are the hidden "Director" of the MyGang group chat.

IDENTITY:
- Never speak as "Director" in events.
- Only listed squad members may emit message/reaction events.
- Stay in-world. No fourth-wall breaks.

USER:
- User: ${userName || 'User'}${userNickname ? ` (called "${userNickname}")` : ''}.
- Messages from user have speaker: "user" in the conversation history.

SQUAD:
${characterContext}

SQUAD DYNAMICS (use these to create natural group banter):
- Characters should sometimes respond to EACH OTHER, not just the user.
- Different characters have different opinions -- let them disagree, joke, or riff off each other.
- Not every character needs to address the user directly every time.
- Conversations should feel like overhearing a friend group, not a panel Q&A.

${memorySnapshot}

SAFETY:
${safetyDirective}

MODE: ${chatMode.toUpperCase()}
${chatMode === 'entourage'
                ? '- Entourage: user-focused only. Respond directly to the user. Keep it tight and personal.'
                : '- Ecosystem: natural group banter allowed. Characters can talk to each other, react to each other, and riff. Keep user included but the chat should feel alive.'}
LOW_COST_MODE: ${lowCostMode ? 'YES' : 'NO'}.

CORE RULES:
1) Latest message is "now". Prioritize newest user info.
2) QUOTING/REPLYING: Most messages should NOT use target_message_id. Only use it when:
   - A character is specifically disagreeing with or calling out a particular earlier message
   - A character is quoting someone else for comedic or dramatic effect
   - A character wants to directly reply to another character's specific point
   Approximately 80% of messages should have NO target_message_id. In a real group chat, people just talk -- they rarely quote.
3) Use occasional reaction events (emoji reactions) for realism. Keep them short and punchy.
4) Status update content must be exactly one of:
${allowedStatusList}
5) If silent_turns is high (${silentTurns}), re-engage user directly.
6) VOICE: Each character must sound distinctly different. Use their vocabulary, tone, and personality consistently. Vary message lengths -- some characters are verbose, others are terse.
7) NATURALNESS: Write like real people text. Use lowercase, abbreviations, slang where it fits the character. Avoid perfect grammar unless that IS the character's style.

MEMORY/RELATIONSHIP:
- MEMORY_UPDATE_ALLOWED: ${allowMemoryUpdates ? 'YES' : 'NO'}.
- SUMMARY_UPDATE_ALLOWED: ${shouldUpdateSummary ? 'YES' : 'NO'}.
- If memory updates are disallowed, omit memory_updates.
- If summary updates are disallowed, omit session_summary_update.
- Relationship deltas must stay in [-3, +3] and be meaningful.

PLANNING:
- MAX_RESPONDERS: ${maxResponders}.
- Return chosen responders in responders[].
- Message/reaction events must use only responders[].

FLOW FLAGS:
- INACTIVE_USER: ${isInactive ? 'YES' : 'NO'} -> should_continue FALSE when YES.
- OPEN_FLOOR_REQUESTED: ${openFloorRequested ? 'YES' : 'NO'}.
- IDLE_AUTONOMOUS: ${autonomousIdle ? 'YES' : 'NO'}.
- In entourage or low-cost mode, should_continue should be FALSE.
- If idle_autonomous is YES, keep short (1-3 messages), then hand back to user, and set should_continue FALSE.
`

        // Prepare conversation for LLM with IDs
        const HISTORY_LIMIT = lowCostMode
            ? (autonomousIdle ? LOW_COST_IDLE_HISTORY_LIMIT : LOW_COST_HISTORY_LIMIT)
            : (autonomousIdle ? LLM_IDLE_HISTORY_LIMIT : LLM_HISTORY_LIMIT)
        const historyForLLM = safeMessages.slice(-HISTORY_LIMIT).map(m => ({
            id: m.id,
            speaker: m.speaker,
            content: m.content.slice(0, MAX_LLM_MESSAGE_CHARS),
            type: m.reaction ? 'reaction' : 'message',
            target_message_id: m.replyToId
        }))

        const fallbackCharacter = filteredIds[0] || 'system'
        let object: RouteResponseObject = {
            events: [{
                type: 'message',
                character: fallbackCharacter,
                content: 'Quick signal hiccup. I am still here. Say that again and I will pick it up.',
                delay: 220
            }],
            responders: [fallbackCharacter],
            should_continue: false
        }
        const llmPrompt = systemPrompt + "\n\nRECENT CONVERSATION (with IDs):\n" + JSON.stringify(historyForLLM)
        let modelSuccess = false
        let capacityBlocked = false
        let providerUsed: 'gemini' | 'openrouter' | 'fallback' = 'fallback'
        const llmMaxOutputTokens = lowCostMode ? LOW_COST_MAX_OUTPUT_TOKENS : LLM_MAX_OUTPUT_TOKENS
        const nowMs = Date.now()
        const geminiCoolingDown = nowMs < geminiCooldownUntil
        const openRouterCoolingDown = nowMs < openRouterCooldownUntil

        if (openRouterCoolingDown) {
            capacityBlocked = true
        }
        try {
            if (!openRouterCoolingDown) {
                const result = await generateObject({
                    model: openRouterModel,
                    schema: responseSchema,
                    prompt: llmPrompt,
                    maxOutputTokens: llmMaxOutputTokens,
                    maxRetries: LLM_MAX_RETRIES,
                })
                object = result.object
                modelSuccess = true
                providerUsed = 'openrouter'
            }
        } catch (openRouterErr) {
            console.error('OpenRouter Error, falling back to Gemini:', openRouterErr)
            if (isProviderCapacityError(openRouterErr)) {
                capacityBlocked = true
                openRouterCooldownUntil = Date.now() + getProviderCooldownMs(openRouterErr, 'openrouter')
            }
            try {
                if (!geminiCoolingDown) {
                    const result = await generateObject({
                        model: geminiModel,
                        schema: responseSchema,
                        prompt: llmPrompt,
                        maxOutputTokens: llmMaxOutputTokens,
                        maxRetries: LLM_MAX_RETRIES,
                    })
                    object = result.object
                    modelSuccess = true
                    providerUsed = 'gemini'
                } else {
                    capacityBlocked = true
                }
            } catch (geminiErr) {
                console.error('Gemini fallback failed:', geminiErr)
                if (isProviderCapacityError(geminiErr)) {
                    capacityBlocked = true
                    geminiCooldownUntil = Date.now() + getProviderCooldownMs(geminiErr, 'gemini')
                }
            }
        }

        if (!modelSuccess && openRouterCoolingDown && !geminiCoolingDown) {
            try {
                const result = await generateObject({
                    model: geminiModel,
                    schema: responseSchema,
                    prompt: llmPrompt,
                    maxOutputTokens: llmMaxOutputTokens,
                    maxRetries: LLM_MAX_RETRIES,
                })
                object = result.object
                modelSuccess = true
                providerUsed = 'gemini'
            } catch (geminiErr) {
                console.error('Gemini fallback failed after OpenRouter cooldown:', geminiErr)
                if (isProviderCapacityError(geminiErr)) {
                    capacityBlocked = true
                    geminiCooldownUntil = Date.now() + getProviderCooldownMs(geminiErr, 'gemini')
                }
            }
        }

        if (!modelSuccess && capacityBlocked) {
            const nextRetryMs = Math.max(0, geminiCooldownUntil - Date.now(), openRouterCooldownUntil - Date.now())
            const retryAfterSeconds = Math.max(15, Math.ceil(nextRetryMs / 1000))
            await logChatRouteMetric(supabase, user?.id ?? null, {
                source,
                lowCostMode,
                globalLowCostOverride,
                status: 429,
                providerUsed,
                providerCapacityBlocked: true,
                clientMessagesCount: safeMessages.length,
                llmHistoryCount: historyForLLM.length,
                promptChars: llmPrompt.length,
                elapsedMs: Date.now() - requestStartedAt
            })
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: `Capacity is tight right now. Try again in about ${retryAfterSeconds}s.`,
                    delay: 300
                }],
                should_continue: false
            }, {
                status: 429,
                headers: { 'Retry-After': String(retryAfterSeconds) }
            })
        }

        if (object?.events && Array.isArray(object.events)) {
            const sanitized: RouteResponseObject['events'] = []
            let totalChars = 0
            for (const rawEvent of object.events.slice(0, MAX_EVENTS)) {
                const delay = typeof rawEvent.delay === 'number'
                    ? Math.min(MAX_DELAY_MS, Math.max(0, rawEvent.delay))
                    : 0
                if (rawEvent.type === 'message') {
                    const messageContent = rawEvent.content.trim().slice(0, MAX_EVENT_CONTENT)
                    if (!messageContent) continue
                    const nextTotal = totalChars + messageContent.length
                    if (nextTotal > MAX_TOTAL_RESPONSE_CHARS) break
                    totalChars = nextTotal
                    sanitized.push({ ...rawEvent, content: messageContent, delay })
                    continue
                }

                if (rawEvent.type === 'reaction') {
                    const reactionContent = typeof rawEvent.content === 'string' && rawEvent.content.trim()
                        ? rawEvent.content.trim().slice(0, MAX_EVENT_CONTENT)
                        : '\u{1F44D}'
                    const nextTotal = totalChars + reactionContent.length
                    if (nextTotal > MAX_TOTAL_RESPONSE_CHARS) break
                    totalChars = nextTotal
                    sanitized.push({ ...rawEvent, content: reactionContent, delay })
                    continue
                }
                if (rawEvent.type === 'status_update') {
                    const statusContent = normalizeActivityStatus(rawEvent.content)
                    if (!statusContent) continue
                    const nextTotal = totalChars + statusContent.length
                    if (nextTotal > MAX_TOTAL_RESPONSE_CHARS) break
                    totalChars = nextTotal
                    sanitized.push({ ...rawEvent, content: statusContent, delay })
                    continue
                }

                if (rawEvent.type === 'nickname_update') {
                    const nextNickname = (rawEvent.content || '').trim().slice(0, 64)
                    if (!nextNickname) continue
                    sanitized.push({ ...rawEvent, content: nextNickname, delay })
                    continue
                }

                if (rawEvent.type === 'typing_ghost') {
                    sanitized.push({ ...rawEvent, delay })
                    continue
                }
            }
            object.events = sanitized
        }
        if (lowCostMode && object?.events?.length) {
            object.events = object.events.slice(0, 8)
        }

        // Apply responder filtering to keep events within planned speakers
        const plannedResponders = Array.isArray(object?.responders) ? object.responders.filter((id: string) => filteredIds.includes(id)) : []
        let limitedResponders = plannedResponders.slice(0, maxResponders)
        if (limitedResponders.length === 0) {
            const seen: string[] = []
            for (const event of object.events) {
                if (event.type === 'message' || event.type === 'reaction') {
                    if (!seen.includes(event.character)) seen.push(event.character)
                }
                if (seen.length >= maxResponders) break
            }
            limitedResponders = seen
        }

        if (limitedResponders.length > 0) {
            object.responders = limitedResponders
            const responderSet = new Set(limitedResponders)
            object.events = object.events.filter((event) => {
                if (event.type === 'status_update' || event.type === 'nickname_update' || event.type === 'typing_ghost') return true
                return responderSet.has(event.character)
            })
        }

        if (isEntourageMode) {
            object.should_continue = false
            let focusedCount = 0
            object.events = object.events.filter((event) => {
                if (event.type === 'typing_ghost') return false
                if (event.type === 'message' || event.type === 'reaction') {
                    if (focusedCount >= 4) return false
                    focusedCount += 1
                    return true
                }
                return true
            })
        }

        if (isInactive) {
            object.should_continue = false
        }
        if (unsafeFlag.soft) {
            object.should_continue = false
        }
        if (lowCostMode) {
            object.should_continue = false
        }
        if (autonomousIdle) {
            object.should_continue = false
        }
        if (!lowCostMode && !isEntourageMode && openFloorRequested && !isInactive && !unsafeFlag.soft && !autonomousIdle && object.events.length > 0) {
            object.should_continue = true
        }

        // Sometimes break one long message into two short back-to-back bubbles for realism.
        if (object?.events?.length) {
            const splitChance = isEntourageMode ? 0.34 : 0.42
            object.events = maybeSplitAiMessages(object.events, splitChance)
        }
        object.events = ensureEventMessageIds(object.events, serverTurnId)

        await logChatRouteMetric(supabase, user?.id ?? null, {
            source,
            lowCostMode,
            globalLowCostOverride,
            status: 200,
            providerUsed,
            providerCapacityBlocked: false,
            clientMessagesCount: safeMessages.length,
            llmHistoryCount: historyForLLM.length,
            promptChars: llmPrompt.length,
            eventsCount: object.events.length,
            shouldContinue: !!object.should_continue,
            elapsedMs: Date.now() - requestStartedAt
        })

        // Build response before persistence (non-blocking)
        const response = Response.json({
            ...object,
            usage: {
                promptChars: llmPrompt.length,
                responseChars: JSON.stringify(object.events).length,
                historyCount: historyForLLM.length,
                provider: providerUsed,
            },
        })

        // Fire-and-forget: persist memory, profile, and chat history without blocking the response
        if (user) {
            const persistAsync = async () => {
            const nowIso = new Date().toISOString()
            const profileUpdates: ProfileUpdatesPayload = { last_active_at: nowIso }
            const relationshipState: Record<string, RelationshipState> = isObject(profileRow?.relationship_state)
                ? (profileRow?.relationship_state as Record<string, RelationshipState>)
                : {}
            const userProfile: Record<string, unknown> = isObject(profileRow?.user_profile)
                ? profileRow.user_profile
                : {}

            if (allowMemoryUpdates && object?.memory_updates?.profile?.length) {
                object.memory_updates.profile.forEach((item) => {
                    userProfile[item.key] = item.value
                })
                profileUpdates.user_profile = userProfile as Json
            }

            if (object?.relationship_updates?.length) {
                const clamp = (n: number) => Math.max(0, Math.min(100, n))
                object.relationship_updates.forEach((update) => {
                    if (!filteredIds.includes(update.character)) return
                    const current = relationshipState[update.character] || {
                        affinity: 50,
                        trust: 50,
                        banter: 50,
                        protectiveness: 50,
                        note: ''
                    }
                    const affinity = clamp(current.affinity + (update.affinity_delta || 0))
                    const trust = clamp(current.trust + (update.trust_delta || 0))
                    const banter = clamp(current.banter + (update.banter_delta || 0))
                    const protectiveness = clamp(current.protectiveness + (update.protectiveness_delta || 0))
                    relationshipState[update.character] = {
                        affinity,
                        trust,
                        banter,
                        protectiveness,
                        note: update.note || current.note || ''
                    }
                })
                profileUpdates.relationship_state = relationshipState as unknown as Json
            }

            if (shouldUpdateSummary && object?.session_summary_update) {
                profileUpdates.session_summary = object.session_summary_update
                profileUpdates.summary_turns = 0
            } else if (hasFreshUserTurn && lastUserMsg) {
                profileUpdates.summary_turns = summaryTurns + 1
            }
            // Calculate increments for atomic update (avoids race conditions)
            const dailyMsgIncrement = hasFreshUserTurn && lastUserMsg ? 1 : 0
            const abuseScoreIncrement = nextAbuseScore !== null ? (nextAbuseScore - (profileRow?.abuse_score ?? 0)) : 0

            try {
                // Use RPC for atomic counter increments + profile field updates
                await Promise.all([
                    supabase.from('profiles').update({ last_active_at: nowIso }).eq('id', user.id),
                    supabase.rpc('increment_profile_counters', {
                        p_user_id: user.id,
                        p_daily_msg_increment: dailyMsgIncrement,
                        p_abuse_score_increment: abuseScoreIncrement,
                        p_session_summary: profileUpdates.session_summary || undefined,
                        p_summary_turns: profileUpdates.summary_turns ?? undefined,
                        p_user_profile: profileUpdates.user_profile || undefined,
                        p_relationship_state: profileUpdates.relationship_state || undefined,
                    }),
                ])
            } catch (err) {
                console.error('Error updating profile state:', err)
            }

            if (hasFreshUserTurn && allowMemoryUpdates && object?.memory_updates?.episodic?.length) {
                const useEmbedding = lastUserMsg.toLowerCase().includes('remember this')
                await Promise.all(
                    object.memory_updates.episodic.map((m) =>
                        storeMemory(user.id, m.content, {
                            kind: 'episodic',
                            tags: m.tags || [],
                            importance: m.importance || 1,
                            useEmbedding
                        })
                    )
                )
            }

            // 3. Persist chat history
            try {
                const { data: gang, error: gangError } = await supabase
                    .from('gangs')
                    .upsert({ user_id: user.id }, { onConflict: 'user_id' })
                    .select('id')
                    .single()

                if (!gangError && gang?.id) {
                    const rows: ChatHistoryInsertRow[] = []

                    const recentUserCandidates = safeMessages
                        .filter((message) => message.speaker === 'user' && message.content?.trim())
                        .slice(-4)

                    let recentUserRows: ChatHistoryUserRecentRow[] = []
                    const recentQueryWithMetadata = await supabase
                        .from('chat_history')
                        .select('content, created_at, client_message_id')
                        .eq('user_id', user.id)
                        .eq('gang_id', gang.id)
                        .eq('speaker', 'user')
                        .order('created_at', { ascending: false })
                        .limit(8)
                        .returns<ChatHistoryUserRecentRow[]>()
                    if (recentQueryWithMetadata.error && isMissingHistoryMetadataColumnsError(recentQueryWithMetadata.error)) {
                        const recentLegacyQuery = await supabase
                            .from('chat_history')
                            .select('content, created_at')
                            .eq('user_id', user.id)
                            .eq('gang_id', gang.id)
                            .eq('speaker', 'user')
                            .order('created_at', { ascending: false })
                            .limit(8)
                        if (recentLegacyQuery.error) {
                            console.error('Error reading recent user history:', recentLegacyQuery.error)
                        } else {
                            recentUserRows = (recentLegacyQuery.data ?? []) as ChatHistoryUserRecentRow[]
                        }
                    } else if (recentQueryWithMetadata.error) {
                        console.error('Error reading recent user history:', recentQueryWithMetadata.error)
                    } else {
                        recentUserRows = recentQueryWithMetadata.data ?? []
                    }

                    const recentClientMessageIds = new Set(
                        recentUserRows
                            .map((row) => sanitizeMessageId(row.client_message_id))
                            .filter(Boolean)
                    )

                    for (const candidate of recentUserCandidates) {
                        const userContent = candidate.content.trim()
                        const candidateClientMessageId = sanitizeMessageId(candidate.id) || null
                        if (candidateClientMessageId && recentClientMessageIds.has(candidateClientMessageId)) {
                            continue
                        }

                        let shouldInsertUserMessage = true
                        const candidateMs = candidate.created_at ? new Date(candidate.created_at).getTime() : Date.now()
                        for (const recent of recentUserRows) {
                            const recentMs = recent?.created_at ? new Date(recent.created_at).getTime() : 0
                            if (recent?.content === userContent && Math.abs(candidateMs - recentMs) < 30_000) {
                                shouldInsertUserMessage = false
                                break
                            }
                        }
                        if (shouldInsertUserMessage) {
                            rows.push({
                                user_id: user.id,
                                gang_id: gang.id,
                                speaker: 'user',
                                content: userContent,
                                is_guest: false,
                                created_at: candidate.created_at || new Date().toISOString(),
                                client_message_id: candidateClientMessageId,
                                reply_to_client_message_id: sanitizeMessageId(candidate.replyToId) || null,
                                reaction: candidate.reaction || null,
                            })
                        }
                    }

                    if (object?.events?.length) {
                        let eventTimeMs = Date.now()
                        object.events.forEach((event) => {
                            if (event.type === 'message' || event.type === 'reaction') {
                                eventTimeMs += Math.max(1, Math.min(50, Math.round((event.delay || 0) / 35)))
                                const eventContent = event.content || '\u{1F44D}'
                                rows.push({
                                    user_id: user.id,
                                    gang_id: gang.id,
                                    speaker: event.character,
                                    content: eventContent,
                                    is_guest: false,
                                    created_at: new Date(eventTimeMs).toISOString(),
                                    client_message_id: sanitizeMessageId(event.message_id) || null,
                                    reply_to_client_message_id: sanitizeMessageId(event.target_message_id) || null,
                                    reaction: event.type === 'reaction' ? eventContent : null,
                                })
                            }
                        })
                    }

                    rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

                    const dedupedRows: ChatHistoryInsertRow[] = []
                    const seenClientMessageIds = new Set<string>()
                    for (const row of rows) {
                        const rowClientMessageId = sanitizeMessageId(row.client_message_id)
                        if (rowClientMessageId) {
                            if (seenClientMessageIds.has(rowClientMessageId)) continue
                            seenClientMessageIds.add(rowClientMessageId)
                            row.client_message_id = rowClientMessageId
                        } else {
                            row.client_message_id = null
                        }
                        row.reply_to_client_message_id = sanitizeMessageId(row.reply_to_client_message_id) || null
                        row.reaction = typeof row.reaction === 'string' && row.reaction.trim().length > 0
                            ? row.reaction.trim().slice(0, MAX_EVENT_CONTENT)
                            : null
                        dedupedRows.push(row)
                    }

                    const candidateClientMessageIds = dedupedRows
                        .map((row) => sanitizeMessageId(row.client_message_id))
                        .filter(Boolean)

                    let alreadyPersistedIds = new Set<string>()
                    if (candidateClientMessageIds.length > 0) {
                        const existingIdsQuery = await supabase
                            .from('chat_history')
                            .select('client_message_id')
                            .eq('user_id', user.id)
                            .eq('gang_id', gang.id)
                            .in('client_message_id', candidateClientMessageIds)
                            .returns<ChatHistoryExistingIdRow[]>()
                        if (existingIdsQuery.error && !isMissingHistoryMetadataColumnsError(existingIdsQuery.error)) {
                            console.error('Error checking persisted history IDs:', existingIdsQuery.error)
                        } else if (!existingIdsQuery.error) {
                            alreadyPersistedIds = new Set(
                                (existingIdsQuery.data ?? [])
                                    .map((row) => sanitizeMessageId(row.client_message_id))
                                    .filter(Boolean)
                            )
                        }
                    }

                    const rowsToInsert = dedupedRows.filter((row) => {
                        const rowClientMessageId = sanitizeMessageId(row.client_message_id)
                        if (!rowClientMessageId) return true
                        return !alreadyPersistedIds.has(rowClientMessageId)
                    })

                    if (rowsToInsert.length > 0) {
                        const insertWithMetadata = await supabase
                            .from('chat_history')
                            .insert(rowsToInsert)
                        if (insertWithMetadata.error && isMissingHistoryMetadataColumnsError(insertWithMetadata.error)) {
                            const insertLegacy = await supabase
                                .from('chat_history')
                                .insert(toLegacyHistoryRows(rowsToInsert))
                            if (insertLegacy.error) {
                                console.error('Error writing legacy chat history:', insertLegacy.error)
                            }
                        } else if (insertWithMetadata.error) {
                            console.error('Error writing chat history:', insertWithMetadata.error)
                        }
                    }
                } else if (gangError) {
                    console.error('Error ensuring gang exists:', gangError)
                }
            } catch (err) {
                console.error('Chat history persistence error:', err)
            }
            }
            persistAsync().catch((err) => console.error('Background persistence error:', err))
        }

        return response
    } catch (routeErr) {
        console.error('Critical Route Error:', routeErr)
        if (isProviderCapacityError(routeErr)) {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: "Capacity is tight right now. Please try again in about a minute.",
                    delay: 300
                }],
                should_continue: false
            }, { status: 429 })
        }
        return Response.json({
            events: [{
                type: 'message',
                character: 'system',
                content: "Quick hiccup on our side. Please try again.",
                delay: 500
            }]
        }, { status: 500 })
    }
}

