import { geminiModel } from '@/lib/ai/gemini'
import { generateObject } from 'ai'
import { z } from 'zod'
import { retrieveMemories, storeMemory } from '@/lib/ai/memory'
import { openRouterModel } from '@/lib/ai/openrouter'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { CHARACTERS } from '@/constants/characters'

export const maxDuration = 30

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
    ),
    should_continue: z.boolean().optional().describe('True if the conversation flow suggests the characters should keep talking (autonomous continuation).'),
    new_memories: z.array(z.string()).optional().describe('Facts to save to long-term vault'),
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
                    content: "Invalid squad selection. Please pick exactly 4 characters and try again.",
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

        // 1. Retrieve Memories (based on last real user message or generic context)
        let relevantMemories: { content: string }[] = []
        if (user) {
            const lastUserMsg = safeMessages.filter((m) => m.speaker === 'user').pop()?.content || ''
            try {
                relevantMemories = await retrieveMemories(user.id, lastUserMsg)
            } catch (err) {
                console.error('Error retrieving memories:', err)
            }
        }

        // 2. Contextual Logic
        // Build the characters context
        const characterContext = activeGangSafe
            .map((c) => `- ID: "${c.id}", Name: "${c.name}", Archetype: "${c.archetype}", Voice: "${c.voice}", Style: "${c.sample}"`)
            .join('\n')

        const isSilentLimitReached = silentTurns >= 25
        const isBurstHigh = burstCount >= 2 // Almost at the 3-limit

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
    
    == RELEVANT MEMORIES ==
    ${relevantMemories.map(m => `- ${m.content}`).join('\n') || 'No memories yet.'}
    
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
    `

        // Prepare conversation for LLM with IDs
        const historyForLLM = safeMessages.slice(-20).map(m => ({
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
                                    content: event.content || '👍',
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

        // 4. Store New Memories
        if (user && object?.new_memories && object.new_memories.length > 0) {
            try {
                await Promise.all(
                    object.new_memories.map((content: string) => storeMemory(user.id, content))
                )
            } catch (err) {
                console.error('Failed to store memories:', err)
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
