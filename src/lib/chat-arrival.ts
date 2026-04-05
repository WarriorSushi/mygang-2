import { FREE_MEMORY_VAULT_PREVIEW_LIMIT } from '@/lib/billing'

const PENDING_ARRIVAL_KEY = 'mygang-pending-arrival'
const PENDING_ARRIVAL_FALLBACK_KEY = 'mygang-pending-arrival-fallback'
const PENDING_ARRIVAL_MAX_AGE_MS = 10 * 60 * 1000

type CharacterArrivalHint = {
    id: string
    name: string
    displayName: string
    roleLabel?: string
    archetype?: string
    avatar?: string
}

export type PendingArrivalContext = {
    createdAt: string
    arrivalToken: string
    userName: string | null
    memoryPreviewLimit: number
    vibeSummary: string | null
    preferServerIntro: boolean
    squad: CharacterArrivalHint[]
}

type ArrivalStep = {
    title: string
    detail: string
    caption: string
}

const CHARACTER_SETUP_LINES: Record<string, string> = {
    atlas: 'Atlas is straightening the room and making it feel steady.',
    cleo: 'Cleo is already deciding which details deserve a reaction.',
    dash: 'Dash is pretending this is not secretly his favorite launch moment.',
    ezra: 'Ezra is finding the one observation that sounds effortless.',
    jinx: 'Jinx is connecting dots nobody asked for, just in case it becomes relevant.',
    kael: 'Kael is checking the chemistry and calling it immediately.',
    luna: 'Luna is tuning the vibe so the room lands soft instead of awkward.',
    miko: 'Miko is trying not to narrate this like an opening anime scene.',
    nova: 'Nova is keeping the whole thing easy and unforced.',
    nyx: 'Nyx is acting unimpressed while absolutely clocking everything.',
    rico: 'Rico is one impulse away from making the entrance too loud.',
    sage: 'Sage is making sure the energy feels easy to step into.',
    vee: 'Vee is rewriting her first text so it lands warm, not try-hard.',
    zara: 'Zara is checking whether this group can actually hold a real conversation.',
}

function isArrivalContext(value: unknown): value is PendingArrivalContext {
    if (!value || typeof value !== 'object') return false
    const candidate = value as PendingArrivalContext
    return typeof candidate.createdAt === 'string'
        && typeof candidate.arrivalToken === 'string'
        && Array.isArray(candidate.squad)
        && typeof candidate.memoryPreviewLimit === 'number'
        && typeof candidate.preferServerIntro === 'boolean'
}

function joinNames(names: string[]) {
    if (names.length <= 1) return names[0] ?? 'your people'
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function createArrivalToken() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }

    return `arrival_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function buildPendingArrivalContext(args: {
    userName: string | null
    squad: Array<{
        id: string
        name: string
        roleLabel?: string
        archetype?: string
        avatar?: string
    }>
    customNames?: Record<string, string>
    vibeSummary?: string | null
}): PendingArrivalContext {
    const customNames = args.customNames ?? {}

    return {
        createdAt: new Date().toISOString(),
        arrivalToken: createArrivalToken(),
        userName: args.userName,
        memoryPreviewLimit: FREE_MEMORY_VAULT_PREVIEW_LIMIT,
        vibeSummary: args.vibeSummary ?? null,
        preferServerIntro: true,
        squad: args.squad.map((character) => ({
            id: character.id,
            name: character.name,
            displayName: customNames[character.id]?.trim() || character.name,
            roleLabel: character.roleLabel,
            archetype: character.archetype,
            avatar: character.avatar,
        })),
    }
}

export function savePendingArrivalContext(context: PendingArrivalContext) {
    if (typeof window === 'undefined') return
    const payload = JSON.stringify(context)
    let savedToSession = false
    try {
        window.sessionStorage.setItem(PENDING_ARRIVAL_KEY, payload)
        savedToSession = true
    } catch {
        // Ignore storage failures; the chat can still fall back to the URL token path.
    }

    if (savedToSession) {
        try {
            window.localStorage.removeItem(PENDING_ARRIVAL_FALLBACK_KEY)
        } catch {}
        return
    }

    try {
        window.localStorage.setItem(PENDING_ARRIVAL_FALLBACK_KEY, payload)
    } catch {
        // Ignore storage failures; the chat can still arrive without the fallback cache.
    }
}

function readArrivalPayload(raw: string | null) {
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw) as unknown
        if (!isArrivalContext(parsed)) return null

        const createdAtMs = Date.parse(parsed.createdAt)
        if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > PENDING_ARRIVAL_MAX_AGE_MS) {
            return null
        }

        return parsed
    } catch {
        return null
    }
}

export function readPendingArrivalContext(options?: { arrivalToken?: string | null }) {
    if (typeof window === 'undefined') return null

    const token = options?.arrivalToken?.trim() || null
    let sessionRaw: string | null = null
    try {
        sessionRaw = window.sessionStorage.getItem(PENDING_ARRIVAL_KEY)
    } catch {
        sessionRaw = null
    }
    const sessionContext = readArrivalPayload(sessionRaw)
    if (sessionContext && (!token || sessionContext.arrivalToken === token)) {
        return sessionContext
    }

    let fallbackRaw: string | null = null
    try {
        fallbackRaw = window.localStorage.getItem(PENDING_ARRIVAL_FALLBACK_KEY)
    } catch {
        fallbackRaw = null
    }
    const fallbackContext = readArrivalPayload(fallbackRaw)
    if (fallbackContext && (!token || fallbackContext.arrivalToken === token)) {
        try {
            window.sessionStorage.setItem(PENDING_ARRIVAL_KEY, JSON.stringify(fallbackContext))
            window.localStorage.removeItem(PENDING_ARRIVAL_FALLBACK_KEY)
        } catch {}
        return fallbackContext
    }

    if (sessionRaw) {
        window.sessionStorage.removeItem(PENDING_ARRIVAL_KEY)
    }
    if (fallbackRaw) {
        window.localStorage.removeItem(PENDING_ARRIVAL_FALLBACK_KEY)
    }

    return null
}

export function consumePendingArrivalContext(options?: { arrivalToken?: string | null }) {
    const context = readPendingArrivalContext(options)
    if (typeof window !== 'undefined') {
        try {
            window.sessionStorage.removeItem(PENDING_ARRIVAL_KEY)
        } catch {}
        try {
            window.localStorage.removeItem(PENDING_ARRIVAL_FALLBACK_KEY)
        } catch {}
    }
    return context
}

function summarizeVibe(vibeSummary: string | null) {
    if (!vibeSummary) return null
    return vibeSummary.replace(/\s+/g, ' ').trim()
}

export function buildStarterChips(context: PendingArrivalContext | null, fallbackName: string, squadNames: string[]) {
    const vibeSummary = summarizeVibe(context?.vibeSummary ?? null)

    if (vibeSummary?.toLowerCase().includes('honest')) {
        return [
            `what's everyone like here?`,
            `be real with me, no sugarcoating`,
            `who should I talk to first?`,
            `give me the lowdown`,
        ]
    }

    if (vibeSummary?.toLowerCase().includes('chill')) {
        return [
            `hey everyone 👋`,
            `what are we getting into today?`,
            `anyone free to chat?`,
            `just vibing, what's good?`,
        ]
    }

    if (vibeSummary?.toLowerCase().includes('hype')) {
        return [
            `okay I'm here, let's go`,
            `who's the most chaotic one here`,
            `hype me up`,
            `what did I miss?`,
        ]
    }

    return [
        `hey, I just got here`,
        `what's everyone up to?`,
        `introduce yourselves`,
        `who should I talk to first?`,
    ]
}

export function buildArrivalLoaderSteps(context: PendingArrivalContext): ArrivalStep[] {
    const displayNames = context.squad.map((character) => character.displayName)
    const firstThreeNames = displayNames.slice(0, 3)
    const leadCharacter = context.squad[0]
    const secondaryCharacter = context.squad[1]
    const leadName = leadCharacter?.displayName ?? 'your crew'
    const leadSetupLine = leadCharacter ? CHARACTER_SETUP_LINES[leadCharacter.id] : 'Your crew is settling in.'
    const secondarySetupLine = secondaryCharacter ? CHARACTER_SETUP_LINES[secondaryCharacter.id] : 'Everybody is finding their footing.'
    const vibeSummary = summarizeVibe(context.vibeSummary)

    return [
        {
            title: 'Opening your private group chat',
            detail: `${joinNames(firstThreeNames)} are being pulled into one room just for you.`,
            caption: `${context.userName || 'You'} are about to land with people who already feel picked on purpose.`,
        },
        {
            title: 'Making the first hello feel human',
            detail: leadSetupLine,
            caption: 'No abrupt drop-in. This should feel like walking into a room that was waiting for you.',
        },
        {
            title: 'Teaching the room your pace',
            detail: secondarySetupLine,
            caption: vibeSummary
                ? `Your onboarding vibe is ${vibeSummary}. The opener should lean into that without sounding scripted.`
                : 'Warm, curious, and human beats loud, generic, and scripted.',
        },
        {
            title: 'Unlocking your first memories',
            detail: `Your first ${context.memoryPreviewLimit} memories are open in Memory Vault from day one.`,
            caption: 'Free users get preview plus light recall. Anything beyond that becomes a teaser, not a dead end.',
        },
        {
            title: 'Almost there',
            detail: `${leadName} is probably already drafting the opener.`,
            caption: 'Next screen: confetti, your crew, and a chat that should feel lived in from the first minute.',
        },
    ]
}

export function buildArrivalBannerCopy(context: PendingArrivalContext) {
    const squadNames = joinNames(context.squad.map((character) => character.displayName))
    const vibeSummary = summarizeVibe(context.vibeSummary)

    return {
        title: 'Your private crew chat is live',
        detail: `${squadNames} are in and ready to get to know you. Your first ${context.memoryPreviewLimit} memories are visible here from day one, and free gets a small light-recall preview so the room can remember a little with you.${vibeSummary ? ` Your vibe leans ${vibeSummary}.` : ''}`,
        vibe: vibeSummary,
    }
}
