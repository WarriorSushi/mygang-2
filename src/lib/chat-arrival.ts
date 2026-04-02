import { FREE_MEMORY_VAULT_PREVIEW_LIMIT } from '@/lib/billing'

const PENDING_ARRIVAL_KEY = 'mygang-pending-arrival'
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
    userName: string | null
    memoryPreviewLimit: number
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
        && Array.isArray(candidate.squad)
        && typeof candidate.memoryPreviewLimit === 'number'
}

function joinNames(names: string[]) {
    if (names.length <= 1) return names[0] ?? 'your people'
    if (names.length === 2) return `${names[0]} and ${names[1]}`
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
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
}): PendingArrivalContext {
    const customNames = args.customNames ?? {}

    return {
        createdAt: new Date().toISOString(),
        userName: args.userName,
        memoryPreviewLimit: FREE_MEMORY_VAULT_PREVIEW_LIMIT,
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
    window.sessionStorage.setItem(PENDING_ARRIVAL_KEY, JSON.stringify(context))
}

export function readPendingArrivalContext() {
    if (typeof window === 'undefined') return null

    const raw = window.sessionStorage.getItem(PENDING_ARRIVAL_KEY)
    if (!raw) return null

    try {
        const parsed = JSON.parse(raw) as unknown
        if (!isArrivalContext(parsed)) {
            window.sessionStorage.removeItem(PENDING_ARRIVAL_KEY)
            return null
        }

        const createdAtMs = Date.parse(parsed.createdAt)
        if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > PENDING_ARRIVAL_MAX_AGE_MS) {
            window.sessionStorage.removeItem(PENDING_ARRIVAL_KEY)
            return null
        }

        return parsed
    } catch {
        window.sessionStorage.removeItem(PENDING_ARRIVAL_KEY)
        return null
    }
}

export function consumePendingArrivalContext() {
    const context = readPendingArrivalContext()
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(PENDING_ARRIVAL_KEY)
    }
    return context
}

export function buildArrivalLoaderSteps(context: PendingArrivalContext): ArrivalStep[] {
    const displayNames = context.squad.map((character) => character.displayName)
    const firstThreeNames = displayNames.slice(0, 3)
    const leadCharacter = context.squad[0]
    const secondaryCharacter = context.squad[1]
    const leadName = leadCharacter?.displayName ?? 'your crew'
    const leadSetupLine = leadCharacter ? CHARACTER_SETUP_LINES[leadCharacter.id] : 'Your crew is settling in.'
    const secondarySetupLine = secondaryCharacter ? CHARACTER_SETUP_LINES[secondaryCharacter.id] : 'Everybody is finding their footing.'

    return [
        {
            title: 'Opening your private group chat',
            detail: `${joinNames(firstThreeNames)} are being pulled into one room just for you.`,
            caption: `${context.userName || 'You'} are about to land with people who already feel picked on purpose.`,
        },
        {
            title: 'Making the first hello feel right',
            detail: leadSetupLine,
            caption: 'No abrupt drop-in. This should feel like walking into a room that was waiting for you.',
        },
        {
            title: 'Teaching the room your pace',
            detail: secondarySetupLine,
            caption: 'Warm, curious, and human beats loud, generic, and scripted.',
        },
        {
            title: 'Unlocking your first memories',
            detail: `Your first ${context.memoryPreviewLimit} memories are open in Memory Vault from day one.`,
            caption: 'The good stuff can start stacking right away. Anything beyond that becomes a teaser, not a dead end.',
        },
        {
            title: 'Almost there',
            detail: `${leadName} is probably already drafting the opener.`,
            caption: 'Next screen: confetti, your crew, and a chat that should feel lived in from the first minute.',
        },
    ]
}

export function buildArrivalBannerCopy(context: PendingArrivalContext) {
    return {
        title: 'Your private crew chat is live',
        detail: `${joinNames(context.squad.map((character) => character.displayName))} are in. Your first ${context.memoryPreviewLimit} memories are unlocked in Memory Vault.`,
    }
}
