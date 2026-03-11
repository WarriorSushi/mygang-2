/**
 * Compact history formatter for LLM prompt.
 * Converts message objects to a compact text format that saves tokens
 * while preserving IDs, speakers, reactions, and reply targets.
 *
 * Format:
 *   [id] speaker: content
 *   [id] speaker reacted: emoji |>reply_to_id
 *   [id] speaker: content |>reply_to_id
 */

type HistoryMessage = {
    id: string
    speaker: string
    content: string
    reaction?: boolean | string | null
    replyToId?: string | null
}

/**
 * Format a single message into compact text.
 * - Reactions use "reacted:" prefix
 * - Reply targets use "|>id" suffix (only when present)
 * - Newlines in content are normalized to spaces
 */
function formatLine(m: HistoryMessage): string {
    // Escape reserved reply marker in content to prevent ambiguity with structural |>target_id
    const cleanContent = m.content.replace(/\r?\n/g, ' ').replace(/\|>/g, '|\\>').trim()
    const replyTarget = m.replyToId ? ` |>${m.replyToId}` : ''

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
    const lines = messages.map(m => formatLine({
        ...m,
        content: m.content.slice(0, maxContentChars),
    }))
    return lines.join('\n')
}
