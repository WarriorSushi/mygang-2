import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Pick a random element from an array, or undefined if empty. */
export function pickRandom<T>(items: T[]): T | undefined {
    if (items.length === 0) return undefined
    return items[Math.floor(Math.random() * items.length)]
}

/** Normalize source to 'chat' for legacy rows (undefined/missing). */
export function normalizeSource(source?: string): string {
    return source || 'chat'
}

/** Truncate text with ellipsis. */
export function truncateText(value: string, maxChars: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxChars) return normalized
    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}\u2026`
}
