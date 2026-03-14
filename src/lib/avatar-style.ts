import type { Character } from '@/stores/chat-store'

export const AVATAR_STYLES = ['robots', 'human', 'retro'] as const
export type AvatarStyle = (typeof AVATAR_STYLES)[number]

export const DEFAULT_AVATAR_STYLE: AvatarStyle = 'robots'

const AVATAR_STYLE_SEGMENTS: Record<AvatarStyle, string> = {
    robots: '',
    human: '/human',
    retro: '/retro',
}

export function normalizeAvatarStyle(style?: string | null): AvatarStyle {
    return AVATAR_STYLES.includes(style as AvatarStyle)
        ? (style as AvatarStyle)
        : DEFAULT_AVATAR_STYLE
}

export function resolveAvatarUrl(characterId: string, style?: string | null): string {
    const normalizedStyle = normalizeAvatarStyle(style)
    const segment = AVATAR_STYLE_SEGMENTS[normalizedStyle]
    return segment
        ? `/avatars${segment}/${characterId}.webp`
        : `/avatars/${characterId}.webp`
}

export function applyAvatarStyleToCharacter<T extends Pick<Character, 'id'> & Partial<Character>>(
    character: T,
    style?: string | null
): T & { avatar: string } {
    return {
        ...character,
        avatar: resolveAvatarUrl(character.id, style),
    }
}

export function applyAvatarStyleToGang<T extends Pick<Character, 'id'> & Partial<Character>>(
    gang: T[],
    style?: string | null
): Array<T & { avatar: string }> {
    return gang.map((character) => applyAvatarStyleToCharacter(character, style))
}
