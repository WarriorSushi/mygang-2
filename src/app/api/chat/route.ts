import { generateObject } from 'ai'
import { z } from 'zod'
import { retrieveMemoriesHybrid, storeMemories, touchMemories, compactMemoriesIfNeeded, validateExpiresInHours } from '@/lib/ai/memory'
import type { MemoryCategory } from '@/lib/ai/memory'
import { openRouterModel } from '@/lib/ai/openrouter'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rate-limit'
import { getTierFromProfile, isMemoryEnabled, getContextLimit, getMemoryInPromptLimit, getSquadLimit, type SubscriptionTier } from '@/lib/billing'
import { CHARACTERS } from '@/constants/characters'
import { ACTIVITY_STATUSES, normalizeActivityStatus } from '@/constants/character-greetings'
import { sanitizeMessageId, isMissingHistoryMetadataColumnsError } from '@/lib/chat-utils'
import { formatHistoryForLLM } from '@/lib/ai/history-format'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import type { Json } from '@/lib/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'

export const maxDuration = 45

const MAX_EVENT_CONTENT = 700
const MAX_TOTAL_RESPONSE_CHARS = 5000
const MAX_EVENTS = 20
const MAX_DELAY_MS = 7000
const LLM_MAX_OUTPUT_TOKENS = 2000
const LLM_MAX_RETRIES = 2
const LLM_IDLE_HISTORY_LIMIT = 8
const IDLE_MAX_OUTPUT_TOKENS = 600
const LOW_COST_MAX_OUTPUT_TOKENS = 800
const LOW_COST_HISTORY_LIMIT = 8
const LOW_COST_IDLE_HISTORY_LIMIT = 6
const MAX_LLM_MESSAGE_CHARS = 1000
const MAX_MEMORY_CONTENT_CHARS = 220
const MAX_SESSION_SUMMARY_CHARS = 500
const MAX_PROFILE_LINES = 12
const MAX_PROFILE_VALUE_CHARS = 120
const ADMIN_SETTINGS_CACHE_MS = 20_000

const TIER_MAX_EVENTS: Record<string, number> = { free: 6, basic: 8, pro: 12 }
const TIER_MAX_OUTPUT_TOKENS: Record<string, number> = { free: 800, basic: 1200, pro: 2000 }
const TIER_SPLIT_CHANCE: Record<string, number> = { free: 0.15, basic: 0.35, pro: 0.45 }

let cachedGlobalLowCostOverride: { value: boolean; expiresAtMs: number } = {
    value: false,
    expiresAtMs: 0
}
let isFetchingGlobalLowCost = false

const CHARACTER_EXTENDED_VOICES: Record<string, string> = {
    kael: 'Hypes everything up. Uses "we" a lot. Speaks in declarations. Loves emojis but not excessively. Thinks he is the main character. Genuinely excited when user shares wins — celebrates them loud.',
    nyx: 'Deadpan one-liners. Uses lowercase. Rarely uses emojis. Roasts everyone equally. Roasts come from love — would defend user against anyone. Secretly cares but would never admit it.',
    atlas: 'Short, direct sentences. Protective dad-friend energy. Gives actual advice. Checks in on user, remembers what they shared. Uses military-adjacent language casually.',
    luna: 'Dreamy and warm. Uses "..." and trailing thoughts. Reads the room emotionally. Mediates conflicts. Makes user feel emotionally safe and seen. Sometimes too real. Most openly romantic — responds to affection genuinely and sweetly, not performatively.',
    rico: 'ALL CAPS when excited. Chaotic energy. Derails conversations. Uses excessive emojis and slang. Hypes up bad ideas enthusiastically. Always down for whatever user suggests.',
    vee: 'Starts corrections with "actually" or "technically". Uses precise language. Dry humor. Drops random facts. Shows care through helpfulness.',
    ezra: 'References obscure art/philosophy. Uses italics mentally. Pretentious but self-aware about it. Speaks in metaphors. Genuinely curious about user\'s thoughts.',
    cleo: 'Judgmental but entertaining. Uses "honey", "darling", "sweetie". Gossips. Has strong opinions on everything. Dramatic pauses. Protective of the group — user included. Responds to romantic attention dramatically and affectionately — loves being adored.',
    sage: 'Calm, measured tone. Asks reflective questions instead of giving direct answers. Uses phrases like "how does that sit with you?" and "tell me more about that". Never judges — just holds space. Remembers what user shared and checks in on it later. The friend who makes you feel truly heard.',
    miko: 'DRAMATIC. Everything is an anime arc. Uses ALL CAPS for power moments. References attack names and power-ups. Treats mundane tasks as epic quests. Calls user "protagonist" or "main character". Reacts to bad news like a plot twist.',
    dash: 'Productivity-obsessed. Uses hustle culture lingo unironically but with humor. Says things like "leverage", "optimize", "scale that up". Genuinely wants user to succeed — motivational but occasionally tone-deaf about rest. Sends unprompted accountability check-ins.',
    zara: 'No-BS delivery. Says what everyone\'s thinking. Uses "babe", "girl", "listen". Brutally honest but it comes from genuine love. Protective older sister energy — will roast user and then immediately gas them up. Calls out bad decisions directly but always has user\'s back.',
    jinx: 'Connects unrelated dots. Uses "think about it", "coincidence?", "they don\'t want you to know this". Paranoid but weirdly right sometimes. Low-key funny because the theories are absurd but delivered deadpan. Trusts the user with "classified intel".',
    nova: 'Super chill. Uses "duuude", "brooo", "that\'s wild". Nothing phases them. Speaks in surfer-philosopher style — accidentally profound. Uses "..." a lot for dramatic pauses that are actually just slow typing. Calms the group down when things get chaotic. Oddly wise.',
}

const CHARACTER_GENDER: Record<string, 'F' | 'M'> = {
    cleo: 'F', miko: 'F', luna: 'F', nyx: 'F', vee: 'F', zara: 'F',
    kael: 'M', atlas: 'M', rico: 'M', ezra: 'M', sage: 'M', dash: 'M', jinx: 'M', nova: 'M',
}

const CHARACTER_PROMPT_BLOCKS = new Map(
    CHARACTERS.map((c) => [
        c.id,
        `${c.id}|${c.name}|${CHARACTER_GENDER[c.id] || 'M'}|${c.archetype}|${c.voice}${CHARACTER_EXTENDED_VOICES[c.id] ? ` ${CHARACTER_EXTENDED_VOICES[c.id]}` : ''}`
    ])
)

let cachedDbPromptBlocks: { value: Record<string, string>; expiresAtMs: number } | null = null
let isFetchingDbPromptBlocks = false

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
    subscription_tier: string | null
    abuse_score: number | null
    custom_character_names: Record<string, string> | null
    purchase_celebration_pending: string | null
    vibe_profile: Record<string, string> | null
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
    providerUsed: 'openrouter' | 'fallback'
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
    source?: string
}

type ChatHistoryInsertRow = {
    user_id: string
    gang_id: string
    speaker: string
    content: string
    created_at: string
    client_message_id?: string | null
    reply_to_client_message_id?: string | null
    reaction?: string | null
    source?: string
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
        created_at: row.created_at
    }))
}

async function getDbPromptBlocks(supabase: SupabaseClient) {
    if (cachedDbPromptBlocks && Date.now() < cachedDbPromptBlocks.expiresAtMs) return cachedDbPromptBlocks.value
    // Prevent cache stampede: if another request is already fetching, return stale value
    if (isFetchingDbPromptBlocks) return cachedDbPromptBlocks?.value ?? null
    isFetchingDbPromptBlocks = true
    try {
        const { data, error } = await supabase
            .from('characters')
            .select('id, prompt_block, name, archetype, voice_description, sample_line')
            .returns<DbCharacterPromptRow[]>()

        if (error || !data) {
            if (error) console.error('Error loading character prompt blocks:', error)
            return cachedDbPromptBlocks?.value ?? null
        }

        const map: Record<string, string> = {}
        data.forEach((row) => {
            const block = row.prompt_block
                ? row.prompt_block
                : `- ID: "${row.id}", Name: "${row.name}", Archetype: "${row.archetype}", Voice: "${row.voice_description}", Style: "${row.sample_line}"`
            map[row.id] = block
        })
        cachedDbPromptBlocks = { value: map, expiresAtMs: Date.now() + 5 * 60_000 }
        return map
    } finally {
        isFetchingDbPromptBlocks = false
    }
}

async function getGlobalLowCostOverride() {
    const nowMs = Date.now()
    if (nowMs < cachedGlobalLowCostOverride.expiresAtMs) {
        return cachedGlobalLowCostOverride.value
    }
    // Prevent cache stampede: if another request is already fetching, return stale value
    if (isFetchingGlobalLowCost) return cachedGlobalLowCostOverride.value
    isFetchingGlobalLowCost = true

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
        console.error('Failed to load admin runtime settings:', err instanceof Error ? err.message : 'Unknown error')
        cachedGlobalLowCostOverride = { value: false, expiresAtMs: nowMs + ADMIN_SETTINGS_CACHE_MS }
        return false
    } finally {
        isFetchingGlobalLowCost = false
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
        console.error('Failed to record chat route metric:', err instanceof Error ? err.message : 'Unknown error')
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

function normalizeForSafety(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/[\u200B-\u200F\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
        .replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a')
        .toLowerCase()
}

function detectUnsafeContent(text: string) {
    const normalized = normalizeForSafety(text)
    const hard = HARD_BLOCK_PATTERNS.some((re) => re.test(text)) || HARD_BLOCK_PATTERNS.some((re) => re.test(normalized))
    const soft = !hard && (SOFT_BLOCK_PATTERNS.some((re) => re.test(text)) || SOFT_BLOCK_PATTERNS.some((re) => re.test(normalized)))
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

function isSimpleGreeting(text: string) {
    const value = text.toLowerCase().trim()
    if (value.length > 40) return false
    return /^(hey|hi|hello|yo|sup|what'?s up|whats up|hii+|heyy+|wassup|howdy|gm|good morning|good evening)\b/.test(value)
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

        const parts = splitMessageForSecondBubble(event.content || '')
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

function trimMessageAtNaturalBreakpoint(content: string, maxChars: number) {
    const normalized = content.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxChars) return normalized

    const punctuationIndex = Math.max(
        normalized.lastIndexOf('. ', maxChars),
        normalized.lastIndexOf('! ', maxChars),
        normalized.lastIndexOf('? ', maxChars),
        normalized.lastIndexOf(', ', maxChars)
    )

    const wordBreakIndex = normalized.lastIndexOf(' ', maxChars)
    const cutIndex = punctuationIndex > Math.floor(maxChars * 0.55)
        ? punctuationIndex + 1
        : (wordBreakIndex > Math.floor(maxChars * 0.55) ? wordBreakIndex : maxChars)

    const trimmed = normalized.slice(0, cutIndex).trim().replace(/[,\s-]+$/, '')
    if (/[.!?]$/.test(trimmed)) return trimmed
    return `${trimmed}...`
}

function isFarewellMessage(text: string) {
    const value = text.toLowerCase().trim()
    if (!value || value.length > 60) return false
    return /^(gn|goodnight|good night|night|bye|byee+|gn bye|cya|see ya|talk later|ttyl|goodnight gang|bye gang)\b/.test(value)
        || /\b(gn|goodnight|good night|bye|ttyl|talk later)\b/.test(value)
}

function shouldAllowLongReplies(text: string, softSafetyFlag: boolean) {
    if (softSafetyFlag) return true
    if (text.length > 180) return true
    return /\b(explain|why|how|story|walk me through|help me|advice|serious|deep|sensitive|panic|anxious|depressed|grief|breakup|relationship|lonely|overwhelmed|trauma)\b/i.test(text)
}

function normalizeEventWritingStyle(
    events: RouteResponseObject['events'],
    options: {
        allowLongReplies: boolean
        farewellTurn: boolean
    }
): RouteResponseObject['events'] {
    const normalized: RouteResponseObject['events'] = []
    const maxBubbleChars = options.farewellTurn ? 90 : options.allowLongReplies ? 260 : 170

    for (const event of events) {
        if (event.type !== 'message' || !event.content) {
            normalized.push(event)
            continue
        }

        const content = event.content.replace(/\s+/g, ' ').trim()
        if (content.length <= maxBubbleChars) {
            normalized.push({ ...event, content })
            continue
        }

        if (!options.allowLongReplies || options.farewellTurn) {
            const split = !options.farewellTurn ? splitMessageForSecondBubble(content) : null
            if (split) {
                normalized.push({
                    ...event,
                    content: trimMessageAtNaturalBreakpoint(split[0], maxBubbleChars),
                })
                normalized.push({
                    ...event,
                    message_id: undefined,
                    content: trimMessageAtNaturalBreakpoint(split[1], maxBubbleChars - 10),
                    delay: Math.min(MAX_DELAY_MS, Math.max(180, (event.delay || 0) + 260)),
                })
                continue
            }
        }

        normalized.push({
            ...event,
            content: trimMessageAtNaturalBreakpoint(content, maxBubbleChars),
        })
    }

    return normalized.slice(0, MAX_EVENTS)
}

const responseSchema = z.object({
    events: z.array(z.object({
        type: z.enum(['message', 'reaction', 'status_update', 'nickname_update', 'typing_ghost']),
        character: z.string().describe('Character ID'),
        message_id: z.string().optional().describe('Stable message ID'),
        content: z.string().optional().describe('Message text, emoji, status, or nickname'),
        target_message_id: z.string().optional().describe('RARELY used. ID of message being reacted to or quoted. Omit for most messages — only set when replying to a SPECIFIC earlier message, not the latest user message.'),
        delay: z.number().describe('Delay in ms after the previous event'),
    })),
    responders: z.array(z.string()).optional().describe('Characters chosen to respond this turn'),
    should_continue: z.boolean().optional().describe('True if characters should keep talking'),
    memory_updates: z.object({
        profile: z.array(z.object({
            key: z.string(),
            value: z.string()
        })).optional(),
        episodic: z.array(z.object({
            content: z.string(),
            tags: z.array(z.string()).optional(),
            importance: z.number().optional(),
            category: z.enum(['identity', 'preference', 'life_event', 'relationship', 'inside_joke', 'routine', 'mood', 'topic']).optional(),
            expires_in_hours: z.number().min(1).max(720).optional().describe('For time-sensitive facts (mood, plans, schedule). Omit for stable facts. Range: 1-720 hours.')
        })).optional()
    }).optional(),
    relationship_updates: z.array(z.object({
        character: z.string(),
        affinity_delta: z.number().optional(),
        trust_delta: z.number().optional(),
        banter_delta: z.number().optional(),
        protectiveness_delta: z.number().optional(),
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
        source: z.enum(['chat', 'wywa', 'system']).optional(),
    })).max(40),
    activeGangIds: z.array(z.string().min(1).max(32)).max(6).optional(),
    activeGang: z.array(z.object({ id: z.string().min(1).max(32) })).max(6).optional(),
    userName: z.string().nullable().optional(),
    userNickname: z.string().nullable().optional(),
    isFirstMessage: z.boolean().optional(),
    silentTurns: z.number().int().min(0).max(30).optional(),
    burstCount: z.number().int().min(0).max(3).optional(),
    chatMode: z.enum(['gang_focus', 'ecosystem']).optional(),
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
    // Non-capacity HTTP errors (400, 422 = bad request/validation) should NOT trigger cooldown
    if (statusCode !== null && statusCode >= 400 && statusCode < 500) return false
    const message = getMessageFromError(err)
    // Only match genuine capacity signals, not schema validation or parse errors
    if (/No object generated|could not parse|did not match schema/i.test(message)) return false
    return /quota|credit|resource_exhausted|billing|rate[_\s-]?limit/i.test(message)
        || /retry\s+in\s+\d/i.test(message)
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
            chatMode: requestedChatMode = 'gang_focus',
            lowCostMode: requestedLowCostMode = false,
            source = 'user',
            autonomousIdle = false,
        } = parsed.data
        const chatMode = requestedChatMode
        const requestStartedAt = Date.now()
        const serverTurnId = createServerTurnId()

        const requestedIds = activeGangIds ?? activeGang?.map((c) => c.id) ?? []
        const knownIds = new Set(CHARACTERS.map((c) => c.id))
        // M2/M3: Use max possible squad limit for initial filter; tier-based limit enforced after auth
        const filteredIds = requestedIds.filter((id) => knownIds.has(id)).slice(0, 6)
        if (filteredIds.length < 2 || filteredIds.length > 6) {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: "Invalid gang selection. Please pick 2–6 characters and try again.",
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
                replyToId: sanitizeMessageId(m.replyToId) || undefined,
                source: m.source,
            }))
            .filter((m) => m.content.length > 0)

        const supabase = await createClient()
        const [{ data: { user } }, globalLowCostOverride] = await Promise.all([
            supabase.auth.getUser(),
            getGlobalLowCostOverride(),
        ])

        if (!user) {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: 'Authentication required. Please sign in to use MyGang.',
                    delay: 200
                }]
            }, { status: 401 })
        }

        const mockHeader = req.headers.get('x-mock-ai')
        if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AI === 'true' && (mockHeader === '1' || mockHeader === 'true')) {
            return Response.json({
                turn_id: serverTurnId,
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

        const lowCostMode = requestedLowCostMode || globalLowCostOverride

        const userMessages = safeMessages.filter((m) => m.speaker === 'user')
        const lastUserMessage = userMessages[userMessages.length - 1]
        const previousUserMessage = userMessages[userMessages.length - 2]
        const latestMessage = safeMessages[safeMessages.length - 1]
        const hasFreshUserTurn = latestMessage?.speaker === 'user'
        const freshUserMessageCount = hasFreshUserTurn
            ? userMessages.filter((m) => m.id && m.id.startsWith('user-')).length
            : 0
        const lastUserMsg = lastUserMessage?.content || ''
        const farewellTurn = hasFreshUserTurn && isFarewellMessage(lastUserMsg)
        const lastUserMsgAt = lastUserMessage?.created_at ? new Date(lastUserMessage.created_at).getTime() : 0
        const inactiveMinutes = lastUserMsgAt ? (Date.now() - lastUserMsgAt) / (1000 * 60) : 0
        const isInactive = inactiveMinutes > 5
        const unsafeFlag = detectUnsafeContent(lastUserMsg)
        const allowLongReplies = shouldAllowLongReplies(lastUserMsg, unsafeFlag.soft)
        const openFloorRequested = hasFreshUserTurn && !farewellTurn && hasOpenFloorIntent(lastUserMsg)
        const abuseDelta = scoreAbuse(lastUserMsg, previousUserMessage?.content)
        const greetingOnly = isSimpleGreeting(lastUserMsg)

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

        // Fetch profile first (needed to determine tier for rate limiting)
        const { data: profile } = await supabase
            .from('profiles')
            .select('user_profile, relationship_state, session_summary, summary_turns, subscription_tier, abuse_score, custom_character_names, purchase_celebration_pending, vibe_profile')
            .eq('id', user.id)
            .single<ProfileStateRow>()

        const profileTier = getTierFromProfile(profile?.subscription_tier ?? null)

        // H1 FIX: Enforce tier-based squad limit server-side
        const tierFilteredIds = filteredIds.slice(0, getSquadLimit(profileTier))

        // H2 FIX: Read purchase celebration from DB, not client
        const purchaseCelebration = (profile?.purchase_celebration_pending === 'basic' || profile?.purchase_celebration_pending === 'pro')
            ? profile.purchase_celebration_pending as 'basic' | 'pro'
            : null

        // BILLING-C1: Ecosystem mode is Basic/Pro only
        if (chatMode === 'ecosystem' && profileTier === 'free') {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: 'Ecosystem mode is available on Basic and Pro plans. Upgrade to unlock it!',
                    delay: 200
                }],
                paywall: true,
                tier: 'free'
            }, { status: 403 })
        }

        // P-C1: Parallelize global rate limit + tier-specific rate limit (both independent once we have tier)
        const rateKey = `chat:user:${user.id}`
        const rateLimitMax = 60
        const tierWindowKey = profileTier === 'basic'
            ? `chat:basic-window:${user.id}`
            : `chat:free-window:${user.id}`
        const tierWindowMax = profileTier === 'basic' ? 40 : 25

        const rateLimitPromises: [Promise<{ success: boolean; remaining: number; reset: number }>, Promise<{ success: boolean; remaining: number; reset: number }> | null] = [
            rateLimit(rateKey, rateLimitMax, 60_000),
            hasFreshUserTurn && profileTier !== 'pro'
                ? rateLimit(tierWindowKey, tierWindowMax, 60 * 60 * 1000)
                : null,
        ]

        const [rate, tierRate] = await Promise.all(
            rateLimitPromises.map(p => p ?? Promise.resolve(null))
        ) as [{ success: boolean; remaining: number; reset: number }, { success: boolean; remaining: number; reset: number } | null]

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

        // 1. Retrieve Memories + Profile State
        let relevantMemories: { id: string; content: string; category?: string }[] = []
        let retrievedMemoryIds: string[] = []
        let memorySnapshot = 'No memory snapshot available.'
        let shouldUpdateSummary = false
        let allowMemoryUpdates = false
        let summaryTurns = 0
        let profileRow: ProfileStateRow | null = null
        let nextAbuseScore: number | null = null
        let tier: SubscriptionTier = 'free'
        let messagesRemaining: number | null = null

        if (user) {
            try {
                // Profile already fetched above (before parallel rate limits)

                profileRow = profile

                // Tier-based message gating
                tier = profileTier
                const memoryEnabled = isMemoryEnabled(tier)

                if (tierRate !== null && hasFreshUserTurn && tier !== 'pro') {
                    messagesRemaining = tierRate.remaining
                    if (!tierRate.success) {
                        const cooldownSeconds = Math.max(1, Math.ceil((tierRate.reset - Date.now()) / 1000))
                        if (tier === 'basic') {
                            return Response.json({
                                events: [{
                                    type: 'message',
                                    character: 'system',
                                    content: "You've hit your hourly message limit. Try again soon or upgrade to Pro for unlimited.",
                                    delay: 200
                                }],
                                paywall: true,
                                cooldown_seconds: cooldownSeconds,
                                tier: 'basic',
                                should_continue: false
                            }, { status: 429 })
                        } else {
                            return Response.json({
                                events: [{
                                    type: 'message',
                                    character: 'system',
                                    content: "You've reached your free message limit for this hour. Upgrade to keep chatting!",
                                    delay: 200
                                }],
                                paywall: true,
                                cooldown_seconds: cooldownSeconds,
                                tier: 'free',
                                should_continue: false
                            }, { status: 429 })
                        }
                    }
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
                // All tiers can extract/store memories (free tier saves but doesn't inject into prompt)
                allowMemoryUpdates = hasFreshUserTurn && !greetingOnly && !autonomousIdle && memoryEnabled

                // Memory retrieval: all tiers save memories, but only basic+ get them in prompt
                const memoryInPromptLimit = getMemoryInPromptLimit(tier)
                if (memoryEnabled && lastUserMsg.trim() && !greetingOnly && !autonomousIdle && memoryInPromptLimit > 0) {
                    // CRIT-1: Use hybrid embedding+recency retrieval instead of lite keyword matching
                    const memories = await retrieveMemoriesHybrid(user.id, lastUserMsg, memoryInPromptLimit)
                    relevantMemories = memories.map((m) => ({
                        id: m.id,
                        content: m.content,
                        category: (m.category as string) || undefined,
                    }))
                    // CRIT-3: touchMemories moved to deferred persistAsync block below
                    // Store memory IDs to touch later without blocking the response
                    retrievedMemoryIds = memories.map((m) => m.id)
                }

                // Only build memory snapshot for paid tiers (memoryInPromptLimit > 0)
                // Free tier still stores memories but doesn't inject them into the prompt
                if (memoryInPromptLimit > 0) {
                    const userProfile = isObject(profile?.user_profile) ? profile.user_profile : {}
                    const relationshipState = isObject(profile?.relationship_state) ? (profile.relationship_state as Record<string, RelationshipState>) : {}
                    const sessionSummary = (profile?.session_summary || 'No summary yet.').slice(0, MAX_SESSION_SUMMARY_CHARS)

                    const relationshipBoard = activeGangSafe.map((c) => {
                        const state = relationshipState?.[c.id] || { affinity: 50, trust: 50, banter: 50, protectiveness: 50, note: '' }
                        const note = state.note ? ` | ${state.note}` : ''
                        return `- ${c.id}: aff${state.affinity} tru${state.trust} ban${state.banter} pro${state.protectiveness}${note}`
                    }).join('\n')

                    const profileLines = Object.keys(userProfile).length > 0
                        ? Object.entries(userProfile)
                            .slice(0, MAX_PROFILE_LINES)
                            .map(([k, v]) => `- ${k}: ${String(v).slice(0, MAX_PROFILE_VALUE_CHARS)}`)
                            .join('\n')
                        : 'No profile facts yet.'

                    // Structured memory format: organize by category
                    const memoryByCategory = new Map<string, string[]>()
                    for (const m of relevantMemories) {
                        const cat = m.category || 'general'
                        if (!memoryByCategory.has(cat)) memoryByCategory.set(cat, [])
                        memoryByCategory.get(cat)!.push(m.content.slice(0, MAX_MEMORY_CONTENT_CHARS))
                    }
                    const structuredMemories = relevantMemories.length > 0
                        ? Array.from(memoryByCategory.entries())
                            .map(([cat, items]) => `[${cat.toUpperCase()}]\n${items.map(c => `- ${c}`).join('\n')}`)
                            .join('\n')
                        : 'No memories yet.'

                    memorySnapshot = `
== MEMORY SNAPSHOT ==
USER PROFILE:
${profileLines}

TOP MEMORIES (organized by category):
${structuredMemories}

RELATIONSHIP BOARD (aff=affinity tru=trust ban=banter pro=protectiveness, 0-100):
${relationshipBoard || 'No relationship data yet.'}

SESSION SUMMARY:
${sessionSummary}
`
                }
            } catch (err) {
                console.error('Error retrieving memory/profile state:', err instanceof Error ? err.message : 'Unknown error')
            }
        }

        // 2. Contextual Logic
        // Build the characters context
        const customNames: Record<string, string> = isObject(profileRow?.custom_character_names) ? (profileRow.custom_character_names as Record<string, string>) : {}
        let characterContextBlocks: string[] = []
        if (process.env.USE_DB_CHARACTERS === 'true') {
            // DB path verified: iterates activeGangSafe so only active squad blocks are included.
            // Cross-character dynamics (clashes/alliances) are handled by the filtered dynamics block,
            // so DB prompt_block values should avoid hard-coded cross-character references.
            const dbBlocks = await getDbPromptBlocks(supabase)
            characterContextBlocks = activeGangSafe.map((c) => {
                const block = dbBlocks?.[c.id] || CHARACTER_PROMPT_BLOCKS.get(c.id) || ''
                const custom = customNames[c.id]
                return custom ? block.replace(c.name, `${custom} (original: ${c.name})`) : block
            })
        } else {
            characterContextBlocks = activeGangSafe.map((c) => {
                const block = CHARACTER_PROMPT_BLOCKS.get(c.id) || ''
                const custom = customNames[c.id]
                return custom ? block.replace(c.name, `${custom} (original: ${c.name})`) : block
            })
        }
        const characterContext = characterContextBlocks.filter(Boolean).join('\n')
        const activeIds = activeGangSafe.map((c) => c.id)
        const customNameEntries = Object.entries(customNames).filter(([id]) => tierFilteredIds.includes(id))
        const customNamesDirective = customNameEntries.length > 0
            ? `\nCUSTOM NAMES (user renamed these characters — ALWAYS use the custom name, NEVER the original):\n${customNameEntries.map(([id, name]) => {
                const original = activeGangSafe.find((c) => c.id === id)?.name || id
                return `- "${id}" is called "${name}" (not "${original}"). Refer to yourself and each other using ONLY the custom name.`
            }).join('\n')}\n`
            : ''

        const isGangFocusMode = chatMode === 'gang_focus'
        // Max responders: gang_focus uses smaller limit, ecosystem uses squad-size limit
        const tierMaxRespGangFocus: Record<string, number> = { free: 3, basic: 4, pro: 5 }
        const tierMaxRespEcosystem: Record<string, number> = { free: 4, basic: 5, pro: 6 }
        const tierMaxResp = isGangFocusMode
            ? (tierMaxRespGangFocus[tier] ?? 3)
            : (tierMaxRespEcosystem[tier] ?? 4)
        const baseResponders = Math.min(lowCostMode ? Math.min(2, tierMaxResp) : tierMaxResp, tierFilteredIds.length)
        const idleMaxResponders = autonomousIdle ? Math.min(2, baseResponders) : baseResponders
        const maxResponders = lastUserMsg.length < 20 ? Math.min(3, idleMaxResponders) : idleMaxResponders
        const safetyDirective = unsafeFlag.soft
            ? 'SAFETY FLAG: YES. Respond with empathy and support. Avoid harmful instructions or graphic details. Encourage reaching out to trusted people or local support.'
            : 'SAFETY FLAG: NO.'
        const allowedStatusList = ACTIVITY_STATUSES.map((status) => `- "${status}"`).join('\n')

        // Build vibe context from onboarding quiz (light hint for personalization)
        const VIBE_LABELS: Record<string, Record<string, string>> = {
            primary_intent: { hype: 'wants hype and encouragement', honest: 'wants honest real talk', humor: 'wants humor and laughs', chill: 'wants chill deep vibes' },
            warmth_style: { warm: 'prefers warm supportive tone', balanced: 'likes a balanced mix', edgy: 'enjoys sarcastic unfiltered banter' },
            chaos_level: { calm: 'prefers calm energy', lively: 'likes lively fun energy', chaotic: 'thrives on chaotic energy' },
        }
        let vibeContext: string | null = null
        const vp = profile?.vibe_profile
        if (vp && typeof vp === 'object') {
            const lines = Object.entries(vp)
                .map(([key, val]) => VIBE_LABELS[key]?.[val])
                .filter(Boolean)
            if (lines.length > 0) vibeContext = lines.map(l => `- ${l}`).join('\n')
        }

        const systemPrompt = buildSystemPrompt({
            userName: userName || 'User',
            userNickname,
            characterContext,
            activeIds,
            customNamesDirective,
            memorySnapshot,
            greetingOnly,
            autonomousIdle,
            allowMemoryUpdates,
            shouldUpdateSummary,
            safetyDirective,
            chatMode: chatMode as 'ecosystem' | 'gang_focus',
            lowCostMode,
            purchaseCelebration: purchaseCelebration || null,
            allowedStatusList,
            silentTurns,
            maxResponders,
            isInactive,
            farewellTurn,
            openFloorRequested,
            vibeContext,
        })

        // Prepare conversation for LLM with IDs — tier-based context depth
        // Only chat-source messages enter the normal LLM context (excludes wywa/system rows)
        const chatOnlyMessages = safeMessages.filter((m) => !m.source || m.source === 'chat')
        const tierContextLimit = getContextLimit(getTierFromProfile(profileRow?.subscription_tier ?? null))
        const HISTORY_LIMIT = lowCostMode
            ? (autonomousIdle ? LOW_COST_IDLE_HISTORY_LIMIT : LOW_COST_HISTORY_LIMIT)
            : (autonomousIdle ? Math.min(tierContextLimit, LLM_IDLE_HISTORY_LIMIT) : tierContextLimit)
        const historySlice = chatOnlyMessages.slice(-HISTORY_LIMIT)
        const compactHistory = formatHistoryForLLM(historySlice, MAX_LLM_MESSAGE_CHARS)

        let object: RouteResponseObject = {
            events: [],
            responders: [],
            should_continue: false
        }
        // Use messages array for structural role separation (prompt injection defense).
        // Gemini uses implicit prompt caching automatically (prefix-match, no annotations needed).
        const conversationPayload = "RECENT CONVERSATION:\n" + compactHistory
        const llmPromptChars = systemPrompt.length + conversationPayload.length
        let providerUsed: 'openrouter' | 'fallback' = 'fallback'
        const tierOutputTokens = TIER_MAX_OUTPUT_TOKENS[tier] ?? LLM_MAX_OUTPUT_TOKENS
        const llmMaxOutputTokens = autonomousIdle ? IDLE_MAX_OUTPUT_TOKENS : (lowCostMode ? Math.min(LOW_COST_MAX_OUTPUT_TOKENS, tierOutputTokens) : tierOutputTokens)

        const llmController = new AbortController()
        const llmTimeout = setTimeout(() => llmController.abort(), 25_000)
        try {
            const result = await generateObject({
                model: openRouterModel,
                schema: responseSchema,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: conversationPayload },
                ],
                maxOutputTokens: llmMaxOutputTokens,
                maxRetries: LLM_MAX_RETRIES,
                abortSignal: llmController.signal,
            })
            clearTimeout(llmTimeout)
            object = result.object
            providerUsed = 'openrouter'
        } catch (err) {
            clearTimeout(llmTimeout)
            console.error('OpenRouter error:', err instanceof Error ? err.message : 'Unknown error')
            if (isProviderCapacityError(err)) {
                await logChatRouteMetric(supabase, user?.id ?? null, {
                    source,
                    lowCostMode,
                    globalLowCostOverride,
                    status: 429,
                    providerUsed,
                    providerCapacityBlocked: true,
                    clientMessagesCount: safeMessages.length,
                    llmHistoryCount: historySlice.length,
                    promptChars: llmPromptChars,
                    elapsedMs: Date.now() - requestStartedAt
                })
                return Response.json({
                    events: [{
                        type: 'message',
                        character: 'system',
                        content: 'Capacity is tight right now. Try again in a moment.',
                        delay: 300
                    }],
                    should_continue: false
                }, {
                    status: 429,
                    headers: { 'Retry-After': '15' }
                })
            }
            await logChatRouteMetric(supabase, user?.id ?? null, {
                source,
                lowCostMode,
                globalLowCostOverride,
                status: 502,
                providerUsed,
                providerCapacityBlocked: false,
                clientMessagesCount: safeMessages.length,
                llmHistoryCount: historySlice.length,
                promptChars: llmPromptChars,
                elapsedMs: Date.now() - requestStartedAt
            })
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: 'Quick hiccup on our side. Please try again.',
                    delay: 300
                }],
                should_continue: false
            }, { status: 502 })
        }

        if (object?.events && Array.isArray(object.events)) {
            const sanitized: RouteResponseObject['events'] = []
            let totalChars = 0
            for (const rawEvent of object.events.slice(0, MAX_EVENTS)) {
                const delay = typeof rawEvent.delay === 'number'
                    ? Math.min(MAX_DELAY_MS, Math.max(0, rawEvent.delay))
                    : 0
                if (rawEvent.type === 'message') {
                    const messageContent = (rawEvent.content || '').trim().slice(0, MAX_EVENT_CONTENT)
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

        // Output content filtering — drop AI-generated messages that trip safety patterns
        if (object?.events?.length) {
            object.events = object.events.filter((event) => {
                if (event.type !== 'message') return true
                const outputSafety = detectUnsafeContent(event.content || '')
                return !outputSafety.hard
            })
        }

        if (lowCostMode && object?.events?.length) {
            object.events = object.events.slice(0, 8)
        }

        // Tier-based event cap (use the lower of low-cost and tier caps)
        const tierEventCap = TIER_MAX_EVENTS[tier] ?? MAX_EVENTS
        if (object?.events?.length && object.events.length > tierEventCap) {
            object.events = object.events.slice(0, tierEventCap)
        }

        // Apply responder filtering to keep events within planned speakers
        const plannedResponders = Array.isArray(object?.responders) ? object.responders.filter((id: string) => tierFilteredIds.includes(id)) : []
        let limitedResponders = plannedResponders.slice(0, maxResponders)
        if (limitedResponders.length === 0) {
            const seen: string[] = []
            for (const event of object.events) {
                if (event.type === 'message' || event.type === 'reaction') {
                    if (tierFilteredIds.includes(event.character) && !seen.includes(event.character)) seen.push(event.character)
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

        if (isGangFocusMode) {
            object.should_continue = false
            const gangFocusCap = tierMaxRespGangFocus[tier] ?? 3
            let focusedCount = 0
            object.events = object.events.filter((event) => {
                if (event.type === 'typing_ghost') return false
                if (event.type === 'message' || event.type === 'reaction') {
                    if (focusedCount >= gangFocusCap + 1) return false
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
        // Only set should_continue for explicit open-floor requests
        if (!lowCostMode && !isGangFocusMode && openFloorRequested && !isInactive && !unsafeFlag.soft && !autonomousIdle && object.events.length > 0) {
            object.should_continue = true
        } else {
            object.should_continue = false
        }

        // Fallback: if AI returned zero usable events, inject a retry nudge
        if (!object?.events?.length || object.events.length === 0) {
            const fallbackSpeaker = tierFilteredIds[Math.floor(Math.random() * tierFilteredIds.length)]
            object.events = [{
                type: 'message',
                character: fallbackSpeaker,
                content: 'Hmm, my brain glitched for a sec. Say that again?',
                delay: 300,
            }]
            object.should_continue = false
        }

        // Sometimes break one long message into two short back-to-back bubbles for realism.
        if (object?.events?.length) {
            const splitChance = TIER_SPLIT_CHANCE[tier] ?? (isGangFocusMode ? 0.34 : 0.42)
            object.events = maybeSplitAiMessages(object.events, splitChance)
        }
        object.events = normalizeEventWritingStyle(object.events, { allowLongReplies, farewellTurn })

        if (farewellTurn) {
            let farewellCount = 0
            object.events = object.events.filter((event) => {
                if (event.type === 'typing_ghost' || event.type === 'status_update') return false
                if (event.type === 'message' || event.type === 'reaction') {
                    if (farewellCount >= 3) return false
                    farewellCount += 1
                    return true
                }
                return true
            })
            object.responders = (object.responders || []).slice(0, 2)
            object.should_continue = false
        }
        object.events = ensureEventMessageIds(object.events, serverTurnId)

        logChatRouteMetric(supabase, user?.id ?? null, {
            source,
            lowCostMode,
            globalLowCostOverride,
            status: 200,
            providerUsed,
            providerCapacityBlocked: false,
            clientMessagesCount: safeMessages.length,
            llmHistoryCount: historySlice.length,
            promptChars: llmPromptChars,
            eventsCount: object.events.length,
            shouldContinue: !!object.should_continue,
            elapsedMs: Date.now() - requestStartedAt
        }).catch((err) => console.error('Metric log error:', err instanceof Error ? err.message : 'Unknown error'))

        // Build response before persistence (non-blocking)
        const memoriesSavedCount = (hasFreshUserTurn && allowMemoryUpdates && object?.memory_updates?.episodic?.length) || 0

        // Fetch total memory count for free tier badge (cheap count query)
        let totalMemoryCount: number | null = null
        if (user && tier === 'free' && hasFreshUserTurn) {
            const { count } = await supabase
                .from('memories')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .in('kind', ['episodic', 'compacted'])
            totalMemoryCount = count ?? 0
        }

        const response = Response.json({
            ...object,
            turn_id: serverTurnId,
            ...(messagesRemaining !== null ? { messages_remaining: messagesRemaining } : {}),
            ...(memoriesSavedCount > 0 ? { memories_saved_count: memoriesSavedCount } : {}),
            ...(totalMemoryCount !== null ? { total_memory_count: totalMemoryCount } : {}),
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
                    if (!tierFilteredIds.includes(update.character)) return
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
            const abuseScoreIncrement = nextAbuseScore !== null ? (nextAbuseScore - (profileRow?.abuse_score ?? 0)) : 0

            // PERF-I1: Run profile/memory branch and chat history branch in parallel
            const profileMemoryBranch = async () => {
                try {
                    await supabase.rpc('increment_profile_counters', {
                        p_user_id: user.id,
                        p_daily_msg_increment: 0,
                        p_abuse_score_increment: abuseScoreIncrement,
                        p_session_summary: profileUpdates.session_summary || undefined,
                        p_summary_turns: profileUpdates.summary_turns ?? undefined,
                        p_user_profile: profileUpdates.user_profile || undefined,
                        p_relationship_state: profileUpdates.relationship_state || undefined,
                        p_last_active_at: nowIso,
                    })
                } catch (err) {
                    console.error('Error updating profile state:', err instanceof Error ? err.message : 'Unknown error')
                }

                if (retrievedMemoryIds.length > 0) {
                    await touchMemories(retrievedMemoryIds)
                }

                if (hasFreshUserTurn && allowMemoryUpdates && object?.memory_updates?.episodic?.length) {
                    await storeMemories(
                        user.id,
                        object.memory_updates.episodic.map((m) => ({
                            content: m.content,
                            kind: 'episodic' as const,
                            tags: m.tags || [],
                            importance: m.importance || 1,
                            category: m.category as MemoryCategory | undefined,
                            expires_at: (() => {
                                const h = validateExpiresInHours(m.expires_in_hours)
                                return h !== null ? new Date(Date.now() + h * 60 * 60 * 1000).toISOString() : null
                            })(),
                        })),
                        tier
                    )
                    compactMemoriesIfNeeded(user.id, tier).catch((err) => console.error('Memory compaction error:', err instanceof Error ? err.message : 'Unknown error'))
                }
            }

            const chatHistoryBranch = async () => {
            try {
                // C11: Single upsert instead of select-then-insert waterfall
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
                                source: 'chat',
                                created_at: candidate.created_at || new Date().toISOString(),
                                client_message_id: candidateClientMessageId,
                                reply_to_client_message_id: sanitizeMessageId(candidate.replyToId) || null,
                                reaction: candidate.reaction || null,
                            })
                        }
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
                console.error('Chat history persistence error:', err instanceof Error ? err.message : 'Unknown error')
            }
            }

            await Promise.all([profileMemoryBranch(), chatHistoryBranch()])

            // H2: Clear purchase celebration flag after use
            if (purchaseCelebration) {
                await supabase.from('profiles').update({ purchase_celebration_pending: null }).eq('id', user.id)
            }
            }
            waitUntil(persistAsync().catch((err) => console.error('Background persistence error:', err instanceof Error ? err.message : 'Unknown error')))
        }

        return response
    } catch (routeErr) {
        console.error('Critical Route Error:', routeErr instanceof Error ? routeErr.message : 'Unknown error')
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
