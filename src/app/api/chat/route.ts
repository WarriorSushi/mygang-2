import { geminiModel } from '@/lib/ai/gemini'
import { generateObject } from 'ai'
import { z } from 'zod'
import { retrieveMemories, storeMemory } from '@/lib/ai/memory'
import { openRouterModel } from '@/lib/ai/openrouter'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

const responseSchema = z.object({
    events: z.array(
        z.object({
            type: z.enum(['message', 'reaction', 'status_update', 'nickname_update', 'typing_ghost']),
            character: z.string().describe('Character ID'),
            content: z.string().optional().describe('Message text, emoji for reaction, status text, or new nickname'),
            target_message_id: z.string().optional().describe('ID of message being reacted to or quoted'),
            delay: z.number().describe('Delay in ms after the *previous* event to create a natural rhythm'),
        })
    ),
    should_continue: z.boolean().optional().describe('True if the conversation flow suggests the characters should keep talking (autonomous continuation).'),
    new_memories: z.array(z.string()).optional().describe('Facts to save to long-term vault'),
})

interface ChatMessage {
    id: string
    speaker: string
    content: string
    created_at: string
    reaction?: string
}

interface ChatCharacter {
    id: string
    name: string
    archetype: string
    voice: string
    sample: string
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { messages, activeGang, userName, userNickname, isFirstMessage, silentTurns = 0, burstCount = 0, chatMode = 'ecosystem' } = body as {
            messages: ChatMessage[]
            activeGang: ChatCharacter[]
            userName: string | null
            userNickname: string | null
            isFirstMessage: boolean
            silentTurns: number
            burstCount: number
            chatMode: 'entourage' | 'ecosystem'
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // 1. Retrieve Memories (based on last real user message or generic context)
        let relevantMemories: { content: string }[] = []
        if (user) {
            const lastUserMsg = messages.filter((m) => m.speaker === 'user').pop()?.content || ''
            try {
                relevantMemories = await retrieveMemories(user.id, lastUserMsg)
            } catch (err) {
                console.error('Error retrieving memories:', err)
            }
        }

        // 2. Contextual Logic
        const lastMsgTime = messages.length > 0 ? new Date(messages[messages.length - 1].created_at).getTime() : Date.now()
        const diffDays = (Date.now() - lastMsgTime) / (1000 * 60 * 60 * 24)
        const isWelcomeBack = diffDays > 3 && !isFirstMessage

        // Build the characters context
        const characterContext = activeGang
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
        const historyForLLM = messages.slice(-20).map(m => ({
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

        // 3. Store New Memories
        if (user && object?.new_memories && object.new_memories.length > 0) {
            await Promise.all(
                object.new_memories.map((content: string) => storeMemory(user.id, content))
            )
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
