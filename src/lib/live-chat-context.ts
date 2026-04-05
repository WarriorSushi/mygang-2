export const LIVE_CHAT_CONTEXT_RESET_MS = 12 * 60 * 60 * 1000

type LiveChatMessage = {
    source?: string
    created_at: string
}

function parseCreatedAt(createdAt: string) {
    const timestamp = Date.parse(createdAt)
    return Number.isFinite(timestamp) ? timestamp : 0
}

export function isChatSourceMessage(message: { source?: string }) {
    return !message.source || message.source === 'chat'
}

export function selectRecentLiveChatMessages<T extends LiveChatMessage>(
    messages: T[],
    limit: number,
    gapResetMs = LIVE_CHAT_CONTEXT_RESET_MS
) {
    const chatOnlyMessages = messages.filter(isChatSourceMessage)
    if (chatOnlyMessages.length <= 1) {
        return chatOnlyMessages.slice(-limit)
    }

    let segmentStart = chatOnlyMessages.length - 1
    let nextTimestamp = parseCreatedAt(chatOnlyMessages[chatOnlyMessages.length - 1]?.created_at || '')

    for (let index = chatOnlyMessages.length - 2; index >= 0; index -= 1) {
        const currentTimestamp = parseCreatedAt(chatOnlyMessages[index]?.created_at || '')
        if (!nextTimestamp || !currentTimestamp) {
            segmentStart = index
            nextTimestamp = currentTimestamp || nextTimestamp
            continue
        }

        if (nextTimestamp - currentTimestamp > gapResetMs) {
            break
        }

        segmentStart = index
        nextTimestamp = currentTimestamp
    }

    const segment = chatOnlyMessages.slice(segmentStart)
    return segment.slice(-limit)
}
