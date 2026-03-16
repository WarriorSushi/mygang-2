export const MAX_MESSAGE_ID_CHARS = 128

export function sanitizeMessageId(value: unknown) {
    if (typeof value !== 'string') return ''
    const trimmed = value.trim().slice(0, MAX_MESSAGE_ID_CHARS)
    // Only allow alphanumeric, hyphens, underscores, and dots (defense-in-depth)
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return ''
    return trimmed
}

// ── Safety patterns ──

const HARD_BLOCK_PATTERNS = [
    /(?:child|minor)\s*(?:sex|porn|nude)/i,
    /(?:rape|sexual\s+assault)/i
]

const SOFT_BLOCK_PATTERNS = [
    /suicide|self\s*harm|kill\s+myself/i,
    /harm\s+yourself|kill\s+yourself/i
]

function normalizeForSafety(text: string): string {
    return text
        .normalize('NFKD')
        .replace(/[\u200B-\u200F\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
        .replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a')
        .toLowerCase()
}

export function detectUnsafeContent(text: string) {
    const normalized = normalizeForSafety(text)
    const hard = HARD_BLOCK_PATTERNS.some((re) => re.test(text)) || HARD_BLOCK_PATTERNS.some((re) => re.test(normalized))
    const soft = !hard && (SOFT_BLOCK_PATTERNS.some((re) => re.test(text)) || SOFT_BLOCK_PATTERNS.some((re) => re.test(normalized)))
    return { hard, soft }
}

// ── Intent detection ──

export function hasOpenFloorIntent(text: string) {
    const value = text.toLowerCase()
    return (
        /you guys talk|talk among yourselves|keep chatting|continue without me|i'?ll listen|i will listen/.test(value)
        || /just talk|carry on|keep going|go on without me/.test(value)
    )
}

export function isMissingHistoryMetadataColumnsError(err: unknown) {
    if (!err || typeof err !== 'object') return false
    const maybeError = err as { code?: unknown; message?: unknown }
    const code = typeof maybeError.code === 'string' ? maybeError.code : ''
    const message = typeof maybeError.message === 'string' ? maybeError.message : ''
    if (code === 'PGRST204' || code === '42703') return true
    return /client_message_id|reply_to_client_message_id|reaction/i.test(message)
}
