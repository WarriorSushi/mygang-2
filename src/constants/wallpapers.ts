export const CHAT_WALLPAPERS = [
    {
        id: 'default',
        label: 'Default',
        description: 'Balanced multicolor glow',
    },
    {
        id: 'neon',
        label: 'Neon',
        description: 'High-contrast electric gradients',
    },
    {
        id: 'soft',
        label: 'Soft',
        description: 'Muted pastel atmospheric wash',
    },
    {
        id: 'aurora',
        label: 'Aurora',
        description: 'Cool teal and violet ribbons',
    },
    {
        id: 'sunset',
        label: 'Sunset',
        description: 'Warm amber and coral blend',
    },
    {
        id: 'graphite',
        label: 'Graphite',
        description: 'Minimal monochrome texture',
    },
    {
        id: 'midnight',
        label: 'Midnight',
        description: 'Legacy deep dark background',
    },
] as const

export type ChatWallpaper = (typeof CHAT_WALLPAPERS)[number]['id']
