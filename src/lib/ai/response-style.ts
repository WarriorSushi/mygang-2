import { hasOpenFloorIntent } from '@/lib/chat-utils'

export type TurnIntent =
    | 'greeting'
    | 'small_talk'
    | 'intro_request'
    | 'self_disclosure'
    | 'practical_question'
    | 'memory_recall'
    | 'confusion_repair'
    | 'correction'
    | 'vulnerable'
    | 'farewell'
    | 'open_floor'

export type TurnPolicy = {
    maxResponders: number
    questionBudget: number
    allowLongReplies: boolean
    preserveSingleBubbleTurn: boolean
    splitChance: number
    shouldContinue: boolean
}

const CORRECTION_TURN_PATTERN = /\b(did you (read|hear|see)|i just (said|told)|pay attention|what i said|are you listening|listen to what i said|no, make it|one concrete (step|action)|single (step|action)|no re-introduction|no intro|no multiple suggestions|just the single best action)\b/i
const CLARIFICATION_TURN_PATTERN = /\b(let me be clear|to be clear|what i mean is|what i'm saying is|read that again|i meant|that's not what i said|you missed the point|you missed what i said|you'?re not getting it|keep it to one step|be more concrete)\b/i
const CONFUSION_TURN_PATTERN = /^(?:\?{1,3}|huh|wdym|what\??|what do you mean|say that simpler|say it again|repeat that|rephrase that|can you rephrase|i don't get it|idk what you mean|what's that mean)$/i
const MEMORY_RECALL_PATTERN = /\b(do you remember|remember when|what do you remember|what do you know about me|what have you learned about me|tell me what you remember|how do you remember me|memory of me|recall about me)\b/i
const INTRO_REQUEST_PATTERN = /\b(introduce yourself|introduce yourselves|tell me about yourself|tell me about yourselves|say something extra about yourself|give me the rundown|who are you)\b/i
const SELF_DISCLOSURE_PATTERN = /\b(what are you like|what do you like|what do you do|what are your hobbies|favorite|do you guys like|do you like|what kind of people are you|how old are you|where are you from|what makes you tick)\b/i
const VULNERABLE_PATTERN = /\b(overwhelmed|overthinking|anxious|anxiety|panic|panicking|stressed|stress|sad|lonely|alone|isolated|down|depressed|grief|breakup|hurt|scared|afraid|nervous|burned out|burnt out|exhausted|spiraling|spiraling|spiral(?:ing)?|crying|worried)\b/i
const PRACTICAL_QUESTION_PATTERN = /\b(should i|should we|which one|which should|recommend|recommendation|best way|help me choose|what do you think i should|what should i do|how should i|can you help me|advice|plan|fix|solve|what would you do|what's the move|what's the best|what is the best)\b/i
const SMALL_TALK_PATTERN = /\b(what are you up to|what are you guys up to|how are you|how's it going|what's up|whats up|pizza|music|movie|movies|food|bored|chilling|vibe|plans|weekend|dinner|lunch|coffee)\b/i
const GREETING_PATTERN = /^(hey|hi|hello|yo|sup|what'?s up|whats up|hii+|heyy+|wassup|howdy|gm|good morning|good evening)\b/i

function isConfusionRepairTurn(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed) return false
    return CONFUSION_TURN_PATTERN.test(trimmed)
}

function isMemoryRecallTurn(text: string): boolean {
    return MEMORY_RECALL_PATTERN.test(text)
}

function isIntroRequestTurn(text: string): boolean {
    return INTRO_REQUEST_PATTERN.test(text)
}

function isSelfDisclosureTurn(text: string): boolean {
    return SELF_DISCLOSURE_PATTERN.test(text)
}

function isVulnerableTurn(text: string): boolean {
    return VULNERABLE_PATTERN.test(text)
}

function isPracticalQuestionTurn(text: string): boolean {
    return PRACTICAL_QUESTION_PATTERN.test(text)
}

function isGreetingTurn(text: string): boolean {
    const value = text.toLowerCase().trim()
    if (!value || value.length > 40) return false
    return GREETING_PATTERN.test(value)
}

function isSmallTalkTurn(text: string): boolean {
    return SMALL_TALK_PATTERN.test(text)
}

const TURN_POLICY: Record<TurnIntent, TurnPolicy> = {
    greeting: {
        maxResponders: 4,
        questionBudget: 1,
        allowLongReplies: false,
        preserveSingleBubbleTurn: false,
        splitChance: 0.12,
        shouldContinue: false,
    },
    small_talk: {
        maxResponders: 4,
        questionBudget: 1,
        allowLongReplies: false,
        preserveSingleBubbleTurn: false,
        splitChance: 0.18,
        shouldContinue: false,
    },
    intro_request: {
        maxResponders: 4,
        questionBudget: 1,
        allowLongReplies: true,
        preserveSingleBubbleTurn: true,
        splitChance: 0.08,
        shouldContinue: false,
    },
    self_disclosure: {
        maxResponders: 4,
        questionBudget: 1,
        allowLongReplies: true,
        preserveSingleBubbleTurn: true,
        splitChance: 0.08,
        shouldContinue: false,
    },
    practical_question: {
        maxResponders: 3,
        questionBudget: 1,
        allowLongReplies: true,
        preserveSingleBubbleTurn: false,
        splitChance: 0.14,
        shouldContinue: false,
    },
    memory_recall: {
        maxResponders: 2,
        questionBudget: 1,
        allowLongReplies: true,
        preserveSingleBubbleTurn: true,
        splitChance: 0.05,
        shouldContinue: false,
    },
    confusion_repair: {
        maxResponders: 1,
        questionBudget: 0,
        allowLongReplies: false,
        preserveSingleBubbleTurn: true,
        splitChance: 0,
        shouldContinue: false,
    },
    correction: {
        maxResponders: 1,
        questionBudget: 0,
        allowLongReplies: false,
        preserveSingleBubbleTurn: true,
        splitChance: 0,
        shouldContinue: false,
    },
    vulnerable: {
        maxResponders: 3,
        questionBudget: 1,
        allowLongReplies: true,
        preserveSingleBubbleTurn: true,
        splitChance: 0,
        shouldContinue: false,
    },
    farewell: {
        maxResponders: 3,
        questionBudget: 0,
        allowLongReplies: false,
        preserveSingleBubbleTurn: true,
        splitChance: 0,
        shouldContinue: false,
    },
    open_floor: {
        maxResponders: 6,
        questionBudget: 1,
        allowLongReplies: false,
        preserveSingleBubbleTurn: false,
        splitChance: 0.28,
        shouldContinue: true,
    },
}

export function classifyTurnIntent(
    text: string,
    options: {
        farewellTurn: boolean
        openFloorRequested: boolean
        softSafetyFlag: boolean
    }
): TurnIntent {
    const trimmed = text.trim()
    if (!trimmed) return options.openFloorRequested ? 'open_floor' : 'small_talk'
    if (options.farewellTurn) return 'farewell'
    if (isConfusionRepairTurn(trimmed)) return 'confusion_repair'
    if (isCorrectionOrClarificationTurn(trimmed)) return 'correction'
    if (options.softSafetyFlag || isVulnerableTurn(trimmed)) return 'vulnerable'
    if (isMemoryRecallTurn(trimmed)) return 'memory_recall'
    if (isIntroRequestTurn(trimmed)) return 'intro_request'
    if (isSelfDisclosureTurn(trimmed)) return 'self_disclosure'
    if (options.openFloorRequested || hasOpenFloorIntent(trimmed)) return 'open_floor'
    if (isGreetingTurn(trimmed)) return 'greeting'
    if (isPracticalQuestionTurn(trimmed)) return 'practical_question'
    if (isSmallTalkTurn(trimmed)) return 'small_talk'
    return 'small_talk'
}

export function getTurnPolicy(intent: TurnIntent): TurnPolicy {
    return TURN_POLICY[intent]
}

export function isCorrectionOrClarificationTurn(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed) return false
    return CORRECTION_TURN_PATTERN.test(trimmed) || CLARIFICATION_TURN_PATTERN.test(trimmed)
}

export function shouldPreserveSingleBubbleTurn(
    text: string,
    options: {
        allowLongReplies: boolean
        farewellTurn: boolean
    }
): boolean {
    if (options.farewellTurn) return true
    if (options.allowLongReplies) return true
    return isCorrectionOrClarificationTurn(text) || isConfusionRepairTurn(text) || isMemoryRecallTurn(text) || isIntroRequestTurn(text) || isSelfDisclosureTurn(text)
}

function messageAsksQuestion(content: string): boolean {
    const trimmed = content.trim()
    if (!trimmed) return false
    if (/[?]+\s*$/.test(trimmed)) return true
    return /^(what|why|how|who|where|when|which|should|could|would|can|do|does|did|is|are|am|was|were|have|has|had)\b/i.test(trimmed)
}

function neutralizeQuestion(content: string): string {
    const normalized = content.replace(/\s+/g, ' ').trim()
    if (!normalized) return normalized
    return normalized
        .replace(/[?]+\s*$/g, '.')
        .replace(/\?\s+/g, '. ')
}

export function countQuestionBearingMessages(events: Array<{ type: string; content?: string | null }>): number {
    return events.filter((event) => event.type === 'message' && messageAsksQuestion(event.content || '')).length
}

export function enforceQuestionBudget<T extends { type: string; content?: string | null }>(
    events: T[],
    questionBudget: number
): T[] {
    if (questionBudget < 0) return events

    let seen = 0
    return events.map((event) => {
        if (event.type !== 'message' || !messageAsksQuestion(event.content || '')) {
            return event
        }

        if (seen < questionBudget) {
            seen += 1
            return event
        }

        const content = neutralizeQuestion(event.content || '')
        return {
            ...event,
            content,
        }
    })
}
