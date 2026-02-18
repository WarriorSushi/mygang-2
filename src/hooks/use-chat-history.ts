'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatStore, Message } from '@/stores/chat-store'
import { getChatHistoryPage } from '@/app/auth/actions'

// ── Pure helpers ──

function normalizeMessageContent(content: string) {
    return content.replace(/\s+/g, ' ').trim()
}

function messageSignature(message: Message) {
    return `${message.speaker}::${message.reaction || ''}::${normalizeMessageContent(message.content)}`
}

function messageStrictSignature(message: Message) {
    return `${messageSignature(message)}::${message.replyToId || ''}`
}

function parseMessageCreatedAt(message: Message) {
    const timestamp = new Date(message.created_at).getTime()
    return Number.isFinite(timestamp) ? timestamp : 0
}

function isHistoryFallbackId(messageId: string) {
    return messageId.startsWith('history-')
}

function isSameMessageTail(localMessages: Message[], remoteMessages: Message[]) {
    if (remoteMessages.length === 0) return localMessages.length === 0
    if (localMessages.length < remoteMessages.length) return false
    const localTail = localMessages.slice(-remoteMessages.length)
    return remoteMessages.every((remoteMessage, index) => (
        localTail[index].id === remoteMessage.id
        || messageStrictSignature(localTail[index]) === messageStrictSignature(remoteMessage)
        || messageSignature(localTail[index]) === messageSignature(remoteMessage)
    ))
}

function mergeRemoteMessagesWithLocalMetadata(remoteMessages: Message[], localMessages: Message[]) {
    if (localMessages.length === 0) return remoteMessages

    const localById = new Map(localMessages.map((message) => [message.id, message]))
    const localBySignature = new Map<string, Message[]>()
    for (const localMessage of localMessages) {
        const signature = messageSignature(localMessage)
        const bucket = localBySignature.get(signature)
        if (bucket) {
            bucket.push(localMessage)
        } else {
            localBySignature.set(signature, [localMessage])
        }
    }

    return remoteMessages.map((remoteMessage) => {
        const directMatch = localById.get(remoteMessage.id)
        if (directMatch) {
            return {
                ...remoteMessage,
                reaction: remoteMessage.reaction || directMatch.reaction,
                replyToId: remoteMessage.replyToId || directMatch.replyToId,
                deliveryStatus: directMatch.deliveryStatus,
                deliveryError: directMatch.deliveryError,
            }
        }

        const signature = messageSignature(remoteMessage)
        const bucket = localBySignature.get(signature)
        if (!bucket || bucket.length === 0) return remoteMessage

        const localMatch = bucket.shift()
        if (!localMatch) return remoteMessage

        return {
            ...remoteMessage,
            id: isHistoryFallbackId(remoteMessage.id) ? (localMatch.id || remoteMessage.id) : remoteMessage.id,
            reaction: localMatch.reaction || remoteMessage.reaction,
            replyToId: localMatch.replyToId || remoteMessage.replyToId,
            deliveryStatus: localMatch.deliveryStatus,
            deliveryError: localMatch.deliveryError,
        }
    })
}

function shouldPreserveLocalMessage(localMessage: Message, latestRemoteTimestamp: number) {
    const localTimestamp = parseMessageCreatedAt(localMessage)
    if (!localTimestamp) return true
    if (Date.now() - localTimestamp > 15 * 60 * 1000) return false
    if (!latestRemoteTimestamp) return true
    return localTimestamp >= latestRemoteTimestamp - 5000
}

export function collapseLikelyDuplicateMessages(messages: Message[]) {
    if (messages.length <= 1) return messages

    const uniqueById: Message[] = []
    const seenIds = new Set<string>()
    for (const message of messages) {
        if (seenIds.has(message.id)) continue
        seenIds.add(message.id)
        uniqueById.push(message)
    }

    const collapsed: Message[] = []
    for (const message of uniqueById) {
        const previous = collapsed[collapsed.length - 1]
        if (!previous) {
            collapsed.push(message)
            continue
        }

        const sameSpeaker = previous.speaker === message.speaker
        const sameSignature = messageSignature(previous) === messageSignature(message)
        const previousTimestamp = parseMessageCreatedAt(previous)
        const messageTimestamp = parseMessageCreatedAt(message)
        const closeInTime = !previousTimestamp || !messageTimestamp
            ? true
            : Math.abs(messageTimestamp - previousTimestamp) <= 15_000

        if (!sameSpeaker || !sameSignature || !closeInTime || message.speaker === 'user') {
            collapsed.push(message)
            continue
        }

        const previousHasQuote = Boolean(previous.replyToId)
        const messageHasQuote = Boolean(message.replyToId)
        if (!previousHasQuote && messageHasQuote) {
            collapsed[collapsed.length - 1] = message
        }
    }

    return collapsed
}

function reconcileMessagesFromHistory(remoteMessages: Message[], localMessages: Message[]) {
    const mergedRemote = mergeRemoteMessagesWithLocalMetadata(remoteMessages, localMessages)
    if (localMessages.length === 0) {
        return collapseLikelyDuplicateMessages(mergedRemote)
    }

    const remoteIds = new Set(mergedRemote.map((message) => message.id))
    const remoteSignatureBuckets = new Map<string, number[]>()
    for (const message of mergedRemote) {
        const signature = messageSignature(message)
        const timestamp = parseMessageCreatedAt(message)
        const bucket = remoteSignatureBuckets.get(signature)
        if (bucket) {
            bucket.push(timestamp)
        } else {
            remoteSignatureBuckets.set(signature, [timestamp])
        }
    }

    const latestRemoteTimestamp = mergedRemote.length > 0
        ? parseMessageCreatedAt(mergedRemote[mergedRemote.length - 1])
        : 0
    const preservedLocalTail: Message[] = []

    for (const localMessage of localMessages) {
        if (remoteIds.has(localMessage.id)) continue

        const signature = messageSignature(localMessage)
        const remoteTimestampBucket = remoteSignatureBuckets.get(signature)
        if (remoteTimestampBucket && remoteTimestampBucket.length > 0) {
            const localTimestamp = parseMessageCreatedAt(localMessage)
            const matchingIndex = remoteTimestampBucket.findIndex((remoteTimestamp) => {
                if (!remoteTimestamp || !localTimestamp) return true
                return Math.abs(remoteTimestamp - localTimestamp) <= 15_000
            })
            if (matchingIndex >= 0) {
                remoteTimestampBucket.splice(matchingIndex, 1)
                if (remoteTimestampBucket.length === 0) {
                    remoteSignatureBuckets.delete(signature)
                }
                continue
            }
        }

        if (shouldPreserveLocalMessage(localMessage, latestRemoteTimestamp)) {
            preservedLocalTail.push(localMessage)
        }
    }

    const merged = [...mergedRemote, ...preservedLocalTail]
    return collapseLikelyDuplicateMessages(merged)
}

// ── Hook ──

interface UseChatHistoryArgs {
    userId: string | null
    isHydrated: boolean
    isOnline: boolean
    isGeneratingRef: React.RefObject<boolean>
    pendingUserMessagesRef: React.RefObject<boolean>
    debounceTimerRef: React.RefObject<ReturnType<typeof setTimeout> | null>
}

export function useChatHistory({
    userId,
    isHydrated,
    isOnline,
    isGeneratingRef,
    pendingUserMessagesRef,
    debounceTimerRef,
}: UseChatHistoryArgs) {
    const { messages, setMessages } = useChatStore()

    const [historyCursor, setHistoryCursor] = useState<string | null>(null)
    const [hasMoreHistory, setHasMoreHistory] = useState(false)
    const [isBootstrappingHistory, setIsBootstrappingHistory] = useState(false)
    const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false)
    const [historyBootstrapDone, setHistoryBootstrapDone] = useState(false)
    const [historyStatus, setHistoryStatus] = useState<'unknown' | 'has_history' | 'empty' | 'error'>('unknown')

    const historySyncInFlightRef = useRef(false)
    const lastHistorySyncAtRef = useRef(0)

    // Quick-set status when conditions are known early
    useEffect(() => {
        if (!isHydrated) return
        if (!userId) {
            setHistoryStatus('empty')
            setHistoryBootstrapDone(true)
            setHistoryCursor(null)
            setHasMoreHistory(false)
            return
        }
        if (messages.length > 0) {
            setHistoryStatus('has_history')
            setHistoryBootstrapDone(true)
        }
    }, [isHydrated, messages.length, userId])

    // Bootstrap history on first load
    useEffect(() => {
        if (!isHydrated || !userId) return
        if (historyBootstrapDone) return
        if (messages.length > 0) return

        let cancelled = false
        const bootstrapHistory = async () => {
            setIsBootstrappingHistory(true)
            try {
                const page = await getChatHistoryPage({ limit: 40 })
                if (cancelled) return
                if (page.items.length > 0) {
                    setMessages(collapseLikelyDuplicateMessages(page.items))
                    setHistoryStatus('has_history')
                } else {
                    setHistoryStatus('empty')
                }
                setHistoryCursor(page.nextBefore)
                setHasMoreHistory(page.hasMore)
            } catch (err) {
                console.error('Failed to load initial chat history:', err)
                setHistoryStatus('error')
            } finally {
                if (cancelled) return
                setIsBootstrappingHistory(false)
                setHistoryBootstrapDone(true)
            }
        }

        bootstrapHistory()
        return () => {
            cancelled = true
        }
    }, [historyBootstrapDone, isHydrated, messages.length, setMessages, userId])

    // Periodic sync
    const syncLatestHistory = useCallback(async (force = false) => {
        if (!userId || !historyBootstrapDone) return
        if (historySyncInFlightRef.current) return
        if (isBootstrappingHistory || isLoadingOlderHistory) return
        if (!force) {
            if (!isOnline) return
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
            if (isGeneratingRef.current || pendingUserMessagesRef.current || debounceTimerRef.current) return
            if (Date.now() - lastHistorySyncAtRef.current < 8000) return
        }

        historySyncInFlightRef.current = true
        lastHistorySyncAtRef.current = Date.now()
        try {
            const page = await getChatHistoryPage({ limit: 40 })
            setHistoryCursor(page.nextBefore)
            setHasMoreHistory(page.hasMore)

            const localMessages = useChatStore.getState().messages
            if (page.items.length === 0) {
                setHistoryStatus('empty')
                return
            }

            setHistoryStatus('has_history')
            if (localMessages.length === 0) {
                setMessages(collapseLikelyDuplicateMessages(page.items))
                return
            }

            const reconciledMessages = reconcileMessagesFromHistory(page.items, localMessages)
            if (
                localMessages.length !== reconciledMessages.length
                || !isSameMessageTail(localMessages, reconciledMessages)
            ) {
                setMessages(reconciledMessages)
            }
        } catch (err) {
            console.error('Failed to sync cloud chat history:', err)
        } finally {
            historySyncInFlightRef.current = false
        }
    }, [historyBootstrapDone, isBootstrappingHistory, isLoadingOlderHistory, isOnline, setMessages, userId, isGeneratingRef, pendingUserMessagesRef, debounceTimerRef])

    // Sync interval + focus/visibility
    useEffect(() => {
        if (!isHydrated || !userId || !historyBootstrapDone) return

        const intervalId = window.setInterval(() => {
            void syncLatestHistory(false)
        }, 12000)

        const handleFocus = () => {
            void syncLatestHistory(true)
        }
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                void syncLatestHistory(true)
            }
        }

        window.addEventListener('focus', handleFocus)
        document.addEventListener('visibilitychange', handleVisibility)
        void syncLatestHistory(true)

        return () => {
            window.clearInterval(intervalId)
            window.removeEventListener('focus', handleFocus)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [historyBootstrapDone, isHydrated, syncLatestHistory, userId])

    // Timeline-cleared event
    useEffect(() => {
        const handleTimelineCleared = () => {
            setHistoryCursor(null)
            setHasMoreHistory(false)
            setHistoryStatus('empty')
        }
        window.addEventListener('mygang:timeline-cleared', handleTimelineCleared)
        return () => {
            window.removeEventListener('mygang:timeline-cleared', handleTimelineCleared)
        }
    }, [])

    // Load older history (pagination)
    const loadOlderHistory = useCallback(async () => {
        if (!userId || !historyCursor || isLoadingOlderHistory || !hasMoreHistory || isBootstrappingHistory) return
        setIsLoadingOlderHistory(true)
        try {
            const page = await getChatHistoryPage({ before: historyCursor, limit: 40 })
            const currentMessages = useChatStore.getState().messages
            const seen = new Set(currentMessages.map((m) => m.id))
            const older = page.items.filter((m) => !seen.has(m.id))
            let appendedCount = 0
            if (older.length > 0) {
                appendedCount = older.length
                setMessages(collapseLikelyDuplicateMessages([...older, ...currentMessages]))
            }
            setHistoryCursor(page.nextBefore)
            setHasMoreHistory(page.hasMore && appendedCount > 0)
        } catch (err) {
            console.error('Failed to load older history:', err)
        } finally {
            setIsLoadingOlderHistory(false)
        }
    }, [hasMoreHistory, historyCursor, isBootstrappingHistory, isLoadingOlderHistory, setMessages, userId])

    return {
        historyStatus,
        hasMoreHistory,
        isLoadingOlderHistory,
        isBootstrappingHistory,
        loadOlderHistory,
        syncLatestHistory,
        historyBootstrapDone,
    }
}
