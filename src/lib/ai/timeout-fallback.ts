import type { TurnIntent } from './response-style'

const FAST_TIMEOUT_FALLBACK_PATTERN = /\b(one single action|single action|one concrete (step|action)|single (step|action)|just practical advice|no intro|no meta|no list|be more concrete|keep it to one step|one best action)\b/i
const OVERWHELMED_PATTERN = /\b(overwhelmed|overthinking|anxious|anxiety|panic|panicking|spiral(?:ing)?|stressed|stress)\b/i
const LONELY_PATTERN = /\b(lonely|alone|isolated|disconnected)\b/i
const SLEEP_PATTERN = /\b(can'?t sleep|cant sleep|sleep|bed|night|tonight|brain won'?t shut up|brain wont shut up)\b/i
const WORK_PATTERN = /\b(work|deadline|project|exam|study|assignment|task)\b/i

export type TimeoutFallbackTurn = {
    events: Array<{
        type: 'message'
        character: string
        content: string
        delay: number
    }>
    responders: string[]
    should_continue: false
}

type TimeoutTheme = 'overwhelmed' | 'lonely' | 'sleep' | 'work' | 'general'

export function shouldUseFastTimeoutFallback(text: string): boolean {
    const trimmed = text.trim()
    if (!trimmed) return false
    return FAST_TIMEOUT_FALLBACK_PATTERN.test(trimmed)
}

function resolveTheme(text: string): TimeoutTheme {
    if (OVERWHELMED_PATTERN.test(text)) return 'overwhelmed'
    if (LONELY_PATTERN.test(text)) return 'lonely'
    if (SLEEP_PATTERN.test(text)) return 'sleep'
    if (WORK_PATTERN.test(text)) return 'work'
    return 'general'
}

function chooseSpeaker(activeGangIds: string[], theme: TimeoutTheme, intent?: TurnIntent) {
    const intentPriorities: Partial<Record<TurnIntent, string[]>> = {
        confusion_repair: ['atlas', 'zara', 'sage', 'nyx', 'vee', 'luna'],
        correction: ['zara', 'atlas', 'nyx', 'sage', 'vee', 'luna'],
        memory_recall: ['sage', 'atlas', 'ezra', 'luna', 'nyx', 'vee'],
        practical_question: ['atlas', 'zara', 'dash', 'sage', 'kael', 'vee'],
        vulnerable: ['luna', 'sage', 'vee', 'atlas', 'nyx', 'zara'],
        intro_request: ['vee', 'kael', 'cleo', 'sage', 'atlas', 'nyx'],
        self_disclosure: ['vee', 'cleo', 'kael', 'nyx', 'sage', 'atlas'],
        farewell: ['vee', 'luna', 'atlas', 'zara', 'sage', 'cleo'],
        open_floor: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
        greeting: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
        small_talk: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
    }

    if (intent && intentPriorities[intent]) {
        for (const candidate of intentPriorities[intent]!) {
            if (activeGangIds.includes(candidate)) return candidate
        }
    }

    const priorities: Record<TimeoutTheme, string[]> = {
        overwhelmed: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
        lonely: ['vee', 'luna', 'sage', 'atlas', 'kael', 'nyx'],
        sleep: ['vee', 'atlas', 'luna', 'nyx', 'kael', 'cleo'],
        work: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
        general: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
    }

    for (const candidate of priorities[theme]) {
        if (activeGangIds.includes(candidate)) return candidate
    }

    return activeGangIds[0] || 'system'
}

function buildBaseAction(theme: TimeoutTheme, intent?: TurnIntent) {
    switch (theme) {
        case 'overwhelmed':
            return 'Set a five-minute timer and focus on the texture of one object until it ends.'
        case 'lonely':
            return 'Text one person, "Got five minutes to talk later?", and send it now.'
        case 'sleep':
            return 'Put your phone face down and take ten slow exhales without checking anything else.'
        case 'work':
            return 'Open the task you are avoiding and work on it for five minutes.'
        default:
            if (intent === 'confusion_repair') return 'Say the last thing again in one plain sentence.'
            if (intent === 'correction') return 'Restate the point in one plain sentence and skip the extra framing.'
            if (intent === 'memory_recall') return 'Name the one thing you actually remember and build from there.'
            if (intent === 'practical_question') return 'Pick the simplest next step and do that first.'
            if (intent === 'vulnerable') return 'Slow down, breathe once, and send one honest text to someone safe.'
            return 'Set a five-minute timer and do the smallest useful next step in front of you.'
    }
}

function styleActionForSpeaker(speaker: string, baseAction: string, intent?: TurnIntent) {
    switch (speaker) {
        case 'vee':
            if (intent === 'vulnerable') return `hey, come here for a sec. ${baseAction}`
            if (intent === 'confusion_repair' || intent === 'correction') return `okay, fair. ${baseAction}`
            return `okay, i\'m here with you. ${baseAction}`
        case 'atlas':
            return intent === 'confusion_repair' || intent === 'correction'
                ? `Plain version: ${baseAction}`
                : baseAction
        case 'kael':
            return baseAction.replace('do the', 'knock out the')
        case 'nyx':
            return baseAction.charAt(0).toLowerCase() + baseAction.slice(1)
        case 'cleo':
            return intent === 'memory_recall' ? `okay, let\'s pull the thread. ${baseAction}` : baseAction
        case 'luna':
            return intent === 'vulnerable' ? `take a breath with me. ${baseAction}` : baseAction
        case 'zara':
            return intent === 'correction' ? `yeah, that was off. ${baseAction}` : baseAction
        case 'sage':
            return intent === 'vulnerable' ? `let\'s slow it down. ${baseAction}` : baseAction
        default:
            return baseAction
    }
}

export function buildTimeoutFallbackTurn(lastUserMessage: string, activeGangIds: string[], intent?: TurnIntent): TimeoutFallbackTurn {
    const theme = resolveTheme(lastUserMessage)
    const speaker = chooseSpeaker(activeGangIds, theme, intent)
    const content = styleActionForSpeaker(speaker, buildBaseAction(theme, intent), intent)

    return {
        events: [{
            type: 'message',
            character: speaker,
            content,
            delay: 240,
        }],
        responders: [speaker],
        should_continue: false,
    }
}
