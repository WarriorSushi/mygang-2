/**
 * Compact history formatter for LLM prompt.
 * Converts message objects to a compact text format that saves tokens
 * while preserving IDs, speakers, reactions, and reply targets.
 *
 * Format:
 *   [id] speaker: content
 *   [id] speaker reacted: emoji |>reply_to_id
 *   [id] speaker: content |>reply_to_id("quoted snippet")
 */

type HistoryMessage = {
    id: string
    speaker: string
    content: string
    reaction?: boolean | string | null
    replyToId?: string | null
}

const MAX_REPLY_PREVIEW_CHARS = 120

function sanitizeContent(content: string): string {
    return content.replace(/\r?\n/g, ' ').replace(/\|>/g, '|\\>').trim()
}

function buildReplyPreview(content: string): string {
    const sanitized = sanitizeContent(content).replace(/"/g, "'")
    if (sanitized.length <= MAX_REPLY_PREVIEW_CHARS) return sanitized
    return `${sanitized.slice(0, MAX_REPLY_PREVIEW_CHARS - 3).trimEnd()}...`
}

/**
 * Format a single message into compact text.
 * - Reactions use "reacted:" prefix
 * - Reply targets use "|>id" suffix (only when present)
 * - Newlines in content are normalized to spaces
 */
function formatLine(m: HistoryMessage, replyPreviewById: Map<string, string>): string {
    const cleanContent = sanitizeContent(m.content)
    const replyPreview = m.replyToId ? replyPreviewById.get(m.replyToId) : null
    const replyTarget = m.replyToId
        ? (replyPreview ? ` |>${m.replyToId}("${replyPreview}")` : ` |>${m.replyToId}`)
        : ''

    if (m.reaction) {
        return `[${m.id}] ${m.speaker} reacted: ${cleanContent}${replyTarget}`
    }
    return `[${m.id}] ${m.speaker}: ${cleanContent}${replyTarget}`
}

/**
 * Format an array of history messages into compact text for the LLM prompt.
 * Each message becomes one line. Returns the full block with format header.
 */
export function formatHistoryForLLM(
    messages: HistoryMessage[],
    maxContentChars: number
): string {
    const replyPreviewById = new Map(
        messages.map((message) => [message.id, buildReplyPreview(message.content)])
    )
    const lines = messages.map((message) => formatLine({
        ...message,
        content: message.content.slice(0, maxContentChars),
    }, replyPreviewById))
    return lines.join('\n')
}
