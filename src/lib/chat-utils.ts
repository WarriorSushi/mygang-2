export const MAX_MESSAGE_ID_CHARS = 128

export function sanitizeMessageId(value: unknown) {
    if (typeof value !== 'string') return ''
    return value.trim().slice(0, MAX_MESSAGE_ID_CHARS)
}

export function isMissingHistoryMetadataColumnsError(err: unknown) {
    if (!err || typeof err !== 'object') return false
    const maybeError = err as { code?: unknown; message?: unknown }
    const code = typeof maybeError.code === 'string' ? maybeError.code : ''
    const message = typeof maybeError.message === 'string' ? maybeError.message : ''
    if (code === 'PGRST204' || code === '42703') return true
    return /client_message_id|reply_to_client_message_id|reaction/i.test(message)
}
