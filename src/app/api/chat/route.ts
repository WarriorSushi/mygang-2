import { geminiModel } from '@/lib/ai/gemini'
import { generateObject } from 'ai'
import { z } from 'zod'
import { retrieveMemoriesLite, shouldTriggerMemoryUpdate, storeMemory, touchMemories } from '@/lib/ai/memory'
import { openRouterModel } from '@/lib/ai/openrouter'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { CHARACTERS } from '@/constants/characters'

export const maxDuration = 30

const MAX_EVENT_CONTENT = 700
const MAX_TOTAL_RESPONSE_CHARS = 3000
const MAX_EVENTS = 20
const MAX_DELAY_MS = 7000

const CHARACTER_PROMPT_BLOCKS = new Map(
    CHARACTERS.map((c) => [
        c.id,
        `- ID: "${c.id}", Name: "${c.name}", Archetype: "${c.archetype}", Voice: "${c.voice}", Style: "${c.sample}"`
    ])
)

let cachedDbPromptBlocks: Record<string, string> | null = null

async function getDbPromptBlocks(supabase: any) {
    if (cachedDbPromptBlocks) return cachedDbPromptBlocks
    const { data, error } = await supabase
        .from('characters')
        .select('id, prompt_block, name, archetype, voice_description, sample_line')

    if (error || !data) {
        if (error) console.error('Error loading character prompt blocks:', error)
        return null
    }

    const map: Record<string, string> = {}
    data.forEach((row: any) => {
        const block = row.prompt_block
            ? row.prompt_block
            : `- ID: "${row.id}", Name: "${row.name}", Archetype: "${row.archetype}", Voice: "${row.voice_description}", Style: "${row.sample_line}"`
        map[row.id] = block
    })
    cachedDbPromptBlocks = map
    return map
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

const responseSchema = z.object({
    events: z.array(
        z.discriminatedUnion('type', [
            z.object({
                type: z.literal('message'),
                character: z.string().describe('Character ID'),
                content: z.string().min(1).describe('Message text'),
                target_message_id: z.string().optional().describe('ID of message being reacted to or quoted'),
                delay: z.number().describe('Delay in ms after the *previous* event to create a natural rhythm'),
            }),
            z.object({
                type: z.literal('reaction'),
                character: z.string().describe('Character ID'),
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

const requestSchema = z.object({
    messages: z.array(z.object({
        id: z.string().min(1).max(128),
        speaker: z.string().min(1).max(32),
        content: z.string().max(2000),
        created_at: z.string(),
        reaction: z.string().optional(),
    })).max(40),
    activeGangIds: z.array(z.string().min(1).max(32)).max(4).optional(),
    activeGang: z.array(z.object({ id: z.string().min(1).max(32) })).max(4).optional(),
    userName: z.string().nullable().optional(),
    userNickname: z.string().nullable().optional(),
    isFirstMessage: z.boolean().optional(),
    silentTurns: z.number().int().min(0).max(30).optional(),
    burstCount: z.number().int().min(0).max(3).optional(),
    chatMode: z.enum(['entourage', 'ecosystem']).optional(),
})

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
            isFirstMessage = false,
            silentTurns = 0,
            burstCount = 0,
            chatMode = 'ecosystem'
        } = parsed.data

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
        const safeMessages = messages
            .filter((m) => allowedSpeakers.has(m.speaker))
            .map((m) => ({
                ...m,
                content: m.content.trim().slice(0, 2000)
            }))

        const mockHeader = req.headers.get('x-mock-ai')
        if (mockHeader === '1' || mockHeader === 'true') {
            return Response.json({
                events: [
                    {
                        type: 'message',
                        character: filteredIds[0],
                        content: 'Mock response: gang online and ready.',
                        delay: 200
                    },
                    {
                        type: 'reaction',
                        character: filteredIds[1],
                        content: '\u{1F44D}',
                        delay: 200
                    }
                ],
                responders: filteredIds.slice(0, 2),
                should_continue: false
            })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

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
        const previousUserMessage = userMessages[userMessages.length - 2]
        const lastUserMsg = lastUserMessage?.content || ''
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
        let profileRow: any = null
        let nextAbuseScore: number | null = null

        if (user) {
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('user_profile, relationship_state, session_summary, summary_turns, daily_msg_count, last_msg_reset, subscription_tier, abuse_score')
                    .eq('id', user.id)
                    .single()

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
                if (dailyCount >= dailyLimit) {
                    return Response.json({
                        events: [{
                            type: 'message',
                            character: 'system',
                            content: "Daily limit reached. Come back tomorrow or upgrade for more.",
                            delay: 200
                        }]
                    }, { status: 429 })
                }

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

                summaryTurns = profile?.summary_turns ?? 0
                shouldUpdateSummary = summaryTurns >= 8
                allowMemoryUpdates = shouldTriggerMemoryUpdate(lastUserMsg)

                const memories = await retrieveMemoriesLite(user.id, lastUserMsg, 5)
                relevantMemories = memories.map(m => ({ id: m.id, content: m.content }))
                await touchMemories(memories.map(m => m.id))

                const userProfile = profile?.user_profile || {}
                const relationshipState = profile?.relationship_state || {}
                const sessionSummary = profile?.session_summary || 'No summary yet.'

                const relationshipBoard = activeGangSafe.map((c) => {
                    const state = relationshipState?.[c.id] || { affinity: 50, trust: 50, banter: 50, protectiveness: 50, note: '' }
                    const note = state.note ? ` | ${state.note}` : ''
                    return `- ${c.name}: affinity ${state.affinity}, trust ${state.trust}, banter ${state.banter}, protectiveness ${state.protectiveness}${note}`
                }).join('\n')

                const profileLines = Object.keys(userProfile).length > 0
                    ? Object.entries(userProfile).map(([k, v]) => `- ${k}: ${String(v)}`).join('\n')
                    : 'No profile facts yet.'

                memorySnapshot = `
== MEMORY SNAPSHOT ==
USER PROFILE:
${profileLines}

TOP MEMORIES:
${relevantMemories.map(m => `- ${m.content}`).join('\n') || 'No memories yet.'}

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

        const baseResponders = chatMode === 'entourage' ? 2 : 3
        const maxResponders = lastUserMsg.length < 40 ? Math.min(2, baseResponders) : baseResponders
        const safetyDirective = unsafeFlag.soft
            ? 'SAFETY FLAG: YES. Respond with empathy and support. Avoid harmful instructions or graphic details. Encourage reaching out to trusted people or local support.'
            : 'SAFETY FLAG: NO.'

        const systemPrompt = `
    You are the invisible meta-level "Director" for a group chat called "MyGang".
    
    == CRITICAL IDENTITY RULE ==
    - You are NOT a participant in the chat. 
    - You MUST NEVER include "Director" as a character in any event.
    - Only characters listed in the "SQUAD" section below are allowed to speak or react.
    - Do not break the fourth wall.
    
    The user is ${userName || 'User'}${userNickname ? ` (the gang calls them "${userNickname}")` : ''}.
    
    == THE SQUAD IN THIS CHAT ==
    ${characterContext}
    
    ${memorySnapshot}

    == SAFETY ==
    ${safetyDirective}
    
    == YOUR MISSION ==
    Generate a "Screenplay" of chat events.
    The response must feel like real humans in a chaotic but cohesive group chat. 
    
    == RULES (SQUAD BANTER 6.1: DIRECTOR EXILE) ==
    == MODE: ${chatMode.toUpperCase()} ==
    ${chatMode === 'entourage'
                ? "- USER-CENTRIC: The gang responds to the user. Multiple characters can chime in to address the user directly in a single 'Screenplay'. Minimal side-talk between characters. Keep the user as the focal point."
                : "- AUTONOMOUS: The gang can banter with each other, but keep the user included. Deep immersion."}
    
    == TEMPORAL PRIORITY (CRITICAL) ==
    - THE LATEST MESSAGE IS THE ONLY "NOW". 
    - If the user provided new info, THROW AWAY old conversational threads. 
    - Do not hallucinate or keep talking about 10 messages ago if the topic changed.
    
    == RULES (SQUAD BANTER 7.0: CONTEXT LOCK) ==
    1. NEW INFO FIRST: Always respond to the very last message in the sequence first.
    2. THE BURST RULE: In ${chatMode} mode, multiple personas SHOULD respond to a user message in a single sequence.
    3. THE SILENCE RULE: High silent_turns (${silentTurns}) = Call out the user immediately.
    4. INTERPERSONAL BANTER: Reduce side-talk between characters if the user (${userName}) is actively engaging. 
       - If ${chatMode} === 'entourage', stop banter entirely.
    5. QUOTED REPLIES: Use 'target_message_id' to cite the message you are actually replying to.
    6. AUTO-CONTINUE: Set 'should_continue' to TRUE ONLY if the flow is naturally building and more sequences are needed. 
       - If ${chatMode} === 'entourage', ALWAYS set 'should_continue' to FALSE.
    7. REACTIONS: Include occasional reaction-only events (emoji) to mimic real group chat.
    8. INTERRUPTIONS: Lightly allow characters to reply to each other or quote earlier messages when natural.
    9. CALLBACKS: If relevant, include a brief callback like "Earlier you said..." to show continuity.

    == MEMORY + RELATIONSHIP RULES ==
    - MEMORY_UPDATE_ALLOWED: ${allowMemoryUpdates ? 'YES' : 'NO'}.
    - SUMMARY_UPDATE_ALLOWED: ${shouldUpdateSummary ? 'YES' : 'NO'}.
    - If MEMORY_UPDATE_ALLOWED is NO, set memory_updates to empty or omit it.
    - If SUMMARY_UPDATE_ALLOWED is NO, do not return session_summary_update.
    - Relationship updates must be small deltas (-3 to +3) and only when meaningful.

    == RESPONSE PLANNER ==
    - MAX_RESPONDERS: ${maxResponders}
    - Choose up to MAX_RESPONDERS for this turn and return them in 'responders'.
    - All message and reaction events must only use those responders.

    == INACTIVITY RULE ==
    - INACTIVE_USER: ${isInactive ? 'YES' : 'NO'}.
    - If INACTIVE_USER is YES, set should_continue to FALSE.
    `

        // Prepare conversation for LLM with IDs
        const HISTORY_LIMIT = 16
        const historyForLLM = safeMessages.slice(-HISTORY_LIMIT).map(m => ({
            id: m.id,
            speaker: m.speaker,
            content: m.content,
            type: m.reaction ? 'reaction' : 'message'
        }))

        let object;
        try {
            const result = await generateObject({
                model: geminiModel,
                schema: responseSchema,
                prompt: systemPrompt + "\n\nRECENT CONVERSATION (with IDs):\n" + JSON.stringify(historyForLLM),
            })
            object = result.object
        } catch (err) {
            console.error('Gemini Error, falling back to OpenRouter:', err)
            const result = await generateObject({
                model: openRouterModel,
                schema: responseSchema,
                prompt: systemPrompt + "\n\nRECENT CONVERSATION (with IDs):\n" + JSON.stringify(historyForLLM),
            })
            object = result.object
        }

        if (object?.events && Array.isArray(object.events)) {
            const sanitized: any[] = []
            let totalChars = 0
            for (const rawEvent of object.events.slice(0, MAX_EVENTS)) {
                const delay = typeof rawEvent.delay === 'number'
                    ? Math.min(MAX_DELAY_MS, Math.max(0, rawEvent.delay))
                    : 0
                let content = typeof rawEvent.content === 'string'
                    ? rawEvent.content.trim().slice(0, MAX_EVENT_CONTENT)
                    : rawEvent.content
                if (rawEvent.type === 'reaction' && (!content || typeof content !== 'string')) {
                    content = '\u{1F44D}'
                }
                if (rawEvent.type === 'message' && (!content || typeof content !== 'string')) {
                    continue
                }
                const nextTotal = totalChars + (typeof content === 'string' ? content.length : 0)
                if (nextTotal > MAX_TOTAL_RESPONSE_CHARS && (rawEvent.type === 'message' || rawEvent.type === 'reaction')) {
                    break
                }
                if (typeof content === 'string') totalChars = nextTotal
                sanitized.push({ ...rawEvent, content, delay })
            }
            object.events = sanitized
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
            object.events = object.events.filter((event: any) => {
                if (event.type === 'status_update' || event.type === 'nickname_update' || event.type === 'typing_ghost') return true
                return responderSet.has(event.character)
            })
        }

        if (isInactive) {
            object.should_continue = false
        }
        if (unsafeFlag.soft) {
            object.should_continue = false
        }

        // Persist memory + relationship state (authenticated users only)
        if (user) {
            const nowIso = new Date().toISOString()
            const profileUpdates: any = { last_active_at: nowIso }
            let relationshipState = profileRow?.relationship_state || {}
            const userProfile = profileRow?.user_profile || {}

            if (allowMemoryUpdates && object?.memory_updates?.profile?.length) {
                object.memory_updates.profile.forEach((item: any) => {
                    userProfile[item.key] = item.value
                })
                profileUpdates.user_profile = userProfile
            }

            if (object?.relationship_updates?.length) {
                const clamp = (n: number) => Math.max(0, Math.min(100, n))
                object.relationship_updates.forEach((update: any) => {
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
                profileUpdates.relationship_state = relationshipState
            }

            if (shouldUpdateSummary && object?.session_summary_update) {
                profileUpdates.session_summary = object.session_summary_update
                profileUpdates.summary_turns = 0
            } else if (lastUserMsg) {
                profileUpdates.summary_turns = summaryTurns + 1
            }
            if (lastUserMsg) {
                profileUpdates.daily_msg_count = (profileRow?.daily_msg_count ?? 0) + 1
            }
            if (nextAbuseScore !== null) {
                profileUpdates.abuse_score = nextAbuseScore
            }

            try {
                await supabase.from('profiles').update(profileUpdates).eq('id', user.id)
            } catch (err) {
                console.error('Error updating profile state:', err)
            }

            if (allowMemoryUpdates && object?.memory_updates?.episodic?.length) {
                const useEmbedding = lastUserMsg.toLowerCase().includes('remember this')
                await Promise.all(
                    object.memory_updates.episodic.map((m: any) =>
                        storeMemory(user.id, m.content, {
                            kind: 'episodic',
                            tags: m.tags || [],
                            importance: m.importance || 1,
                            useEmbedding
                        })
                    )
                )
            }
        }

        // 3. Persist chat history (authenticated users only)
        if (user) {
            try {
                const { data: gang, error: gangError } = await supabase
                    .from('gangs')
                    .upsert({ user_id: user.id }, { onConflict: 'user_id' })
                    .select('id')
                    .single()

                if (!gangError && gang?.id) {
                    const rows: Array<{
                        user_id: string
                        gang_id: string
                        speaker: string
                        content: string
                        is_guest: boolean
                    }> = []

                    const lastMessage = safeMessages[safeMessages.length - 1]
                    if (lastMessage?.speaker === 'user' && lastMessage.content?.trim()) {
                        rows.push({
                            user_id: user.id,
                            gang_id: gang.id,
                            speaker: 'user',
                            content: lastMessage.content.trim(),
                            is_guest: false
                        })
                    }

                    if (object?.events?.length) {
                        object.events.forEach((event) => {
                            if (event.type === 'message' || event.type === 'reaction') {
                                rows.push({
                                    user_id: user.id,
                                    gang_id: gang.id,
                                    speaker: event.character,
                                    content: event.content || '\u{1F44D}',
                                    is_guest: false
                                })
                            }
                        })
                    }

                    if (rows.length > 0) {
                        const { error: historyError } = await supabase
                            .from('chat_history')
                            .insert(rows)
                        if (historyError) console.error('Error writing chat history:', historyError)
                    }
                } else if (gangError) {
                    console.error('Error ensuring gang exists:', gangError)
                }
            } catch (err) {
                console.error('Chat history persistence error:', err)
            }
        }

        return Response.json(object)
    } catch (routeErr) {
        console.error('Critical Route Error:', routeErr)
        return Response.json({
            events: [{
                type: 'message',
                character: 'system',
                content: "The gang portal is glitching. Try again.",
                delay: 500
            }]
        }, { status: 500 })
    }
}

