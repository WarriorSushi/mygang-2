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

function chooseSpeaker(activeGangIds: string[], theme: TimeoutTheme) {
    const priorities: Record<TimeoutTheme, string[]> = {
        overwhelmed: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
        lonely: ['luna', 'sage', 'atlas', 'vee', 'kael', 'nyx'],
        sleep: ['atlas', 'luna', 'nyx', 'vee', 'kael', 'cleo'],
        work: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
        general: ['vee', 'atlas', 'kael', 'nyx', 'cleo', 'luna'],
    }

    for (const candidate of priorities[theme]) {
        if (activeGangIds.includes(candidate)) return candidate
    }

    return activeGangIds[0] || 'system'
}

function buildBaseAction(theme: TimeoutTheme) {
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
            return 'Set a five-minute timer and do the smallest useful next step in front of you.'
    }
}

function styleActionForSpeaker(speaker: string, baseAction: string) {
    switch (speaker) {
        case 'vee':
            return baseAction
        case 'atlas':
            return baseAction
        case 'kael':
            return baseAction.replace('do the', 'knock out the')
        case 'nyx':
            return baseAction.charAt(0).toLowerCase() + baseAction.slice(1)
        case 'cleo':
            return baseAction
        case 'luna':
            return baseAction
        default:
            return baseAction
    }
}

export function buildTimeoutFallbackTurn(lastUserMessage: string, activeGangIds: string[]): TimeoutFallbackTurn {
    const theme = resolveTheme(lastUserMessage)
    const speaker = chooseSpeaker(activeGangIds, theme)
    const content = styleActionForSpeaker(speaker, buildBaseAction(theme))

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
