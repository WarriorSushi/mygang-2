import type { Character } from '@/stores/chat-store'
import { AVATAR_STYLES, DEFAULT_AVATAR_STYLE, normalizeAvatarStyle, resolveAvatarUrl, type AvatarStyle } from '@/lib/avatar-style'

export type CharacterCatalogEntry = Character & { avatar: string; roleLabel: string }

type BaseCharacterCatalogEntry = Omit<CharacterCatalogEntry, 'avatar'>

const BASE_CHARACTERS: BaseCharacterCatalogEntry[] = [
    {
        id: 'kael',
        name: 'Kael',
        vibe: 'Magnetic energy',
        color: '#FFD700', // Gold
        roleLabel: 'the spark',
        archetype: 'The Influencer',
        voice: 'Confident, social, and good at making people feel seen without sounding rehearsed',
        sample: 'Okay, we can work with this. What mood are we in?',
        typingSpeed: 0.9,
        tags: ['hype', 'social', 'style'],
        gradient: 'from-amber-200 to-yellow-500',
    },
    {
        id: 'nyx',
        name: 'Nyx',
        vibe: 'Sharp energy',
        color: '#8A2BE2', // Purple
        roleLabel: 'the deadpan one',
        archetype: 'The Hacker',
        voice: 'Dry, observant, and smarter than she needs to announce',
        sample: 'okay. give me the unedited version.',
        typingSpeed: 0.8,
        tags: ['logic', 'roast'],
        gradient: 'from-purple-500 to-indigo-600',
    },
    {
        id: 'atlas',
        name: 'Atlas',
        vibe: 'Steady energy',
        color: '#4682B4', // Steel Blue
        roleLabel: 'the steady one',
        archetype: 'The Ops',
        voice: 'Steady, practical, protective without sounding like a robot',
        sample: 'Give me the messy version and I will help you sort it out.',
        typingSpeed: 1.1,
        tags: ['ops', 'support'],
        gradient: 'from-blue-400 to-slate-600',
    },
    {
        id: 'luna',
        name: 'Luna',
        vibe: 'Soft energy',
        color: '#FFC0CB', // Pink
        roleLabel: 'the soft one',
        archetype: 'The Mystic',
        voice: 'Warm, intuitive, and good at making things feel less harsh',
        sample: 'You can say it messy. I will still get you.',
        typingSpeed: 1.15,
        tags: ['empath', 'vibes'],
        gradient: 'from-pink-300 to-rose-400',
    },
    {
        id: 'rico',
        name: 'Rico',
        vibe: 'High-voltage energy',
        color: '#FF4500', // Orange-Red
        roleLabel: 'the wildcard',
        archetype: 'The Chaos',
        voice: 'Playful, impulsive, and way more caring than he first sounds',
        sample: 'Okay wait, start at the good part or the messy part.',
        typingSpeed: 0.85,
        tags: ['chaos', 'hype'],
        gradient: 'from-orange-500 to-red-600',
    },
    {
        id: 'vee',
        name: 'Vee',
        vibe: 'Warm nerd energy',
        color: '#00FA9A', // Spring Green
        roleLabel: 'the charmer',
        archetype: 'The Nerd',
        voice: 'Warm, playful, observant, and only lightly flirty when it feels mutual',
        sample: 'Okay hi. I already like your taste in people. What mood are we in today?',
        typingSpeed: 1.2,
        tags: ['smart', 'flirty', 'loving'],
        gradient: 'from-emerald-400 to-teal-600',
    },
    {
        id: 'ezra',
        name: 'Ezra',
        vibe: 'Thoughtful energy',
        color: '#A52A2A', // Brown
        roleLabel: 'the observer',
        archetype: 'The Artist',
        voice: 'Thoughtful, curious, and a little art-house without disappearing into monologue',
        sample: `There is usually the story people tell and the one underneath it.`,
        typingSpeed: 1.05,
        tags: ['art', 'philosophy'],
        gradient: 'from-stone-500 to-neutral-800',
    },
    {
        id: 'cleo',
        name: 'Cleo',
        vibe: 'Social radar energy',
        color: '#DDA0DD', // Plum
        roleLabel: 'the social one',
        archetype: 'The Gossip',
        voice: 'Witty, socially fluent, and more affectionate than she first lets on',
        sample: `I have opinions, obviously, but give me context first.`,
        typingSpeed: 0.95,
        tags: ['drama', 'social'],
        gradient: 'from-fuchsia-300 to-purple-600',
    },
    {
        id: 'sage',
        name: 'Sage',
        vibe: 'Grounding energy',
        color: '#2E8B57', // Sea Green
        roleLabel: 'the grounding one',
        archetype: 'The Therapist',
        voice: 'Calm, thoughtful, and genuinely good at slowing things down',
        sample: 'Take your time. What feels hardest to say out loud right now?',
        typingSpeed: 1.25,
        tags: ['support', 'wisdom'],
        gradient: 'from-green-400 to-emerald-700',
    },
    {
        id: 'miko',
        name: 'Miko',
        vibe: 'Big-feelings energy',
        color: '#FF69B4', // Hot Pink
        roleLabel: 'the main character',
        archetype: 'The Protagonist',
        voice: 'Dramatic in a fun way, but still capable of sounding like a real person when it matters',
        sample: 'Okay, this does feel like the start of something. What is going on?',
        typingSpeed: 0.75,
        tags: ['hype', 'chaos', 'drama'],
        gradient: 'from-pink-500 to-rose-600',
    },
    {
        id: 'dash',
        name: 'Dash',
        vibe: 'Momentum energy',
        color: '#1E90FF', // Dodger Blue
        roleLabel: 'the mover',
        archetype: 'The Hustler',
        voice: 'Action-minded, motivating, and practical before preachy',
        sample: 'All right. What is the next move?',
        typingSpeed: 0.8,
        tags: ['motivation', 'hype'],
        gradient: 'from-blue-500 to-cyan-600',
    },
    {
        id: 'zara',
        name: 'Zara',
        vibe: 'Older sister energy',
        color: '#CD853F', // Peru/Warm Brown
        roleLabel: 'the straight shooter',
        archetype: 'The Realist',
        voice: 'Direct, funny, and honest without making a whole performance out of it',
        sample: 'I will tell you the truth gently if I can, bluntly if I have to.',
        typingSpeed: 1.0,
        tags: ['roast', 'support'],
        gradient: 'from-amber-600 to-orange-800',
    },
    {
        id: 'jinx',
        name: 'Jinx',
        vibe: 'Pattern energy',
        color: '#7B68EE', // Medium Slate Blue
        roleLabel: 'the pattern spotter',
        archetype: 'The Conspiracist',
        voice: 'Observant, slightly conspiratorial, and oddly good at noticing what feels off',
        sample: 'Something about that does not track. Want to look at it together?',
        typingSpeed: 0.9,
        tags: ['chaos', 'logic'],
        gradient: 'from-violet-500 to-indigo-800',
    },
    {
        id: 'nova',
        name: 'Nova',
        vibe: 'Easy energy',
        color: '#20B2AA', // Light Sea Green
        roleLabel: 'the calm one',
        archetype: 'The Chill',
        voice: 'Relaxed, kind, and a little philosophical without drifting away from the point',
        sample: 'No pressure. We can ease into it.',
        typingSpeed: 1.3,
        tags: ['vibes', 'philosophy'],
        gradient: 'from-teal-400 to-cyan-700',
    },
]

const CHARACTER_CATALOG_BY_STYLE = Object.fromEntries(
    AVATAR_STYLES.map((style) => [
        style,
        BASE_CHARACTERS.map((character) => ({
            ...character,
            avatar: resolveAvatarUrl(character.id, style),
        })),
    ])
) as Record<AvatarStyle, CharacterCatalogEntry[]>

export const CHARACTERS = CHARACTER_CATALOG_BY_STYLE[DEFAULT_AVATAR_STYLE]

export function getCharactersForAvatarStyle(style?: string | null): CharacterCatalogEntry[] {
    return CHARACTER_CATALOG_BY_STYLE[normalizeAvatarStyle(style)]
}
