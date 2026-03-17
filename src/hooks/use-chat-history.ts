'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatStore, Message } from '@/stores/chat-store'
import { getChatHistoryPage } from '@/app/auth/actions'
import { trackOperationalError, trackOperationalEvent } from '@/lib/operational-telemetry'
import { normalizeSource } from '@/lib/utils'

export { normalizeSource }

// ── Pure helpers ──

function normalizeMessageContent(content: string) {
    return content.replace(/\s+/g, ' ').trim()
}

function messageSignature(message: Message) {
    return `${message.speaker}::${normalizeSource(message.source)}::${message.reaction || ''}::${normalizeMessageContent(message.content)}`
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
    // Messages confirmed sent to the server are in the DB — never drop them locally
    // They're just outside the 40-message remote page window
    if (localMessage.deliveryStatus === 'sent') return true
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

    // Global dedup: remove non-consecutive duplicates (same speaker, same content, within 15s)
    // Keeps the first occurrence, drops later duplicates
    const seenSignatures = new Map<string, number>() // signature → timestamp of first occurrence
    const globalDeduped: Message[] = []
    for (const message of uniqueById) {
        if (message.speaker === 'user') {
            globalDeduped.push(message)
            continue
        }
        const sig = messageSignature(message)
        const ts = parseMessageCreatedAt(message)
        const existingTs = seenSignatures.get(sig)
        if (existingTs !== undefined && ts && existingTs && Math.abs(ts - existingTs) <= 15_000) {
            // Duplicate — skip it
            continue
        }
        seenSignatures.set(sig, ts)
        globalDeduped.push(message)
    }

    // Consecutive dedup (original logic for quote-reply preference)
    const collapsed: Message[] = []
    for (const message of globalDeduped) {
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
    // Sort by timestamp to prevent preserved local messages appearing out of order
    merged.sort((a, b) => parseMessageCreatedAt(a) - parseMessageCreatedAt(b))
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

export type HistoryStatus = 'unknown' | 'bootstrapping' | 'has_history' | 'empty' | 'error'

export function useChatHistory({
    userId,
    isHydrated,
    isOnline,
    isGeneratingRef,
    pendingUserMessagesRef,
    debounceTimerRef,
}: UseChatHistoryArgs) {
    const messagesLength = useChatStore((s) => s.messages.length)
    const setMessages = useChatStore((s) => s.setMessages)

    const [historyCursor, setHistoryCursor] = useState<string | null>(null)
    const [hasMoreHistory, setHasMoreHistory] = useState(false)
    const [isBootstrappingHistory, setIsBootstrappingHistory] = useState(false)
    const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false)
    const [historyBootstrapDone, setHistoryBootstrapDone] = useState(false)
    const [historyStatus, setHistoryStatus] = useState<HistoryStatus>('unknown')

    const historySyncInFlightRef = useRef(false)
    const lastHistorySyncAtRef = useRef(0)
    // P-I3: Debounce forced syncs (focus/visibility) with a 3-second dedup window
    const lastForceSyncRef = useRef(0)
    // Track the oldest message timestamp from "load older" so periodic sync preserves them
    const olderHistoryLoadedRef = useRef(false)

    // Reset bootstrap when userId changes (e.g. logout → new login)
    const prevUserIdRef = useRef<string | null>(userId)
    useEffect(() => {
        if (prevUserIdRef.current !== userId) {
            prevUserIdRef.current = userId
            setIsBootstrappingHistory(false)
            setHistoryBootstrapDone(false)
            setHistoryCursor(null)
            setHasMoreHistory(false)
            setHistoryStatus('unknown')
            olderHistoryLoadedRef.current = false
        }
    }, [userId])

    // Quick-set status when conditions are known early
    useEffect(() => {
        if (!isHydrated) return
        if (!userId) {
            setIsBootstrappingHistory(false)
            setHistoryStatus(messagesLength > 0 ? 'has_history' : 'empty')
            setHistoryBootstrapDone(true)
            setHistoryCursor(null)
            setHasMoreHistory(false)
            return
        }
    }, [isHydrated, messagesLength, userId])

    // Bootstrap history on first load
    useEffect(() => {
        if (!isHydrated || !userId) return
        if (historyBootstrapDone) return

        let cancelled = false
        const bootstrapHistory = async () => {
            setIsBootstrappingHistory(true)
            setHistoryStatus('bootstrapping')
            try {
                const page = await getChatHistoryPage({ limit: 100 })
                if (cancelled) return

                const localMessages = useChatStore.getState().messages
                const reconciledMessages = reconcileMessagesFromHistory(page.items, localMessages)

                if (
                    localMessages.length !== reconciledMessages.length
                    || !isSameMessageTail(localMessages, reconciledMessages)
                ) {
                    setMessages(reconciledMessages)
                }

                if (reconciledMessages.length > 0) {
                    setHistoryStatus('has_history')
                } else {
                    setHistoryStatus('empty')
                }
                trackOperationalEvent('history_bootstrap_resolved', {
                    user_id: userId,
                    source_path: 'use-chat-history.bootstrap',
                    outcome: reconciledMessages.length > 0 ? 'has_history' : 'empty',
                    remote_message_count: page.items.length,
                    reconciled_message_count: reconciledMessages.length,
                })
                setHistoryCursor(page.nextBefore)
                setHasMoreHistory(page.hasMore)
            } catch (err) {
                console.error('Failed to load initial chat history:', err)
                setHistoryStatus('error')
                trackOperationalError('history_bootstrap_resolved', {
                    user_id: userId,
                    source_path: 'use-chat-history.bootstrap',
                    remote_message_count: 0,
                    reconciled_message_count: useChatStore.getState().messages.length,
                }, err)
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
    }, [historyBootstrapDone, isHydrated, setMessages, userId])

    // Periodic sync
    const syncLatestHistory = useCallback(async (force = false) => {
        if (!userId || !historyBootstrapDone) return
        if (historySyncInFlightRef.current) return
        if (isBootstrappingHistory || isLoadingOlderHistory) return
        // Always skip sync while AI is generating or user messages are pending
        if (isGeneratingRef.current || pendingUserMessagesRef.current) return
        if (!force) {
            if (!isOnline) return
            if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
            if (debounceTimerRef.current) return
            if (Date.now() - lastHistorySyncAtRef.current < 8000) return
        }

        historySyncInFlightRef.current = true
        lastHistorySyncAtRef.current = Date.now()
        try {
            const page = await getChatHistoryPage({ limit: 40 })
            setHistoryCursor(page.nextBefore)
            setHasMoreHistory(page.hasMore)

            const localMessages = useChatStore.getState().messages
            const reconciledMessages = reconcileMessagesFromHistory(page.items, localMessages)
            setHistoryStatus(reconciledMessages.length > 0 ? 'has_history' : 'empty')

            // If older history was loaded via pagination, preserve those older messages
            // that aren't in the latest 40-message remote page
            if (olderHistoryLoadedRef.current && localMessages.length > 0 && reconciledMessages.length > 0) {
                const reconciledIds = new Set(reconciledMessages.map(m => m.id))
                const reconciledSigs = new Set(reconciledMessages.map(m => messageSignature(m)))
                const oldestReconciledTs = parseMessageCreatedAt(reconciledMessages[0])
                // Keep local messages that are older than the reconciled set and not already in it
                const olderPreserved = localMessages.filter(m => {
                    if (reconciledIds.has(m.id)) return false
                    if (reconciledSigs.has(messageSignature(m))) return false
                    const ts = parseMessageCreatedAt(m)
                    return ts > 0 && ts < oldestReconciledTs
                })
                if (olderPreserved.length > 0) {
                    const merged = collapseLikelyDuplicateMessages([...olderPreserved, ...reconciledMessages])
                    if (
                        localMessages.length !== merged.length
                        || !isSameMessageTail(localMessages, merged)
                    ) {
                        setMessages(merged)
                    }
                    return
                }
            }

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

    // Stable ref to avoid cascading effect re-runs when isLoadingOlderHistory changes
    const syncLatestHistoryRef = useRef(syncLatestHistory)
    syncLatestHistoryRef.current = syncLatestHistory

    // Track last user message time for adaptive polling
    const lastUserMessageAtRef = useRef(0)
    useEffect(() => {
        const msgs = useChatStore.getState().messages
        const lastUserMsg = [...msgs].reverse().find(m => m.speaker === 'user')
        if (lastUserMsg) {
            const ts = new Date(lastUserMsg.created_at).getTime()
            if (ts > lastUserMessageAtRef.current) lastUserMessageAtRef.current = ts
        }
    }, [messagesLength])

    // Sync interval + focus/visibility (adaptive polling)
    useEffect(() => {
        if (!isHydrated || !userId || !historyBootstrapDone) return

        const getPollingInterval = () => {
            if (typeof document !== 'undefined' && document.hidden) return null // stop polling when tab hidden
            const recentActivity = Date.now() - lastUserMessageAtRef.current < 60_000
            return recentActivity ? 12_000 : 30_000
        }

        let intervalId: ReturnType<typeof setTimeout> | null = null

        const scheduleNext = () => {
            const interval = getPollingInterval()
            if (interval === null) {
                intervalId = null
                return
            }
            intervalId = setTimeout(() => {
                void syncLatestHistoryRef.current(false)
                scheduleNext()
            }, interval)
        }

        scheduleNext()

        const handleFocus = () => {
            // P-I3: Skip if a forced sync happened less than 3 seconds ago
            if (Date.now() - lastForceSyncRef.current < 3000) return
            lastForceSyncRef.current = Date.now()
            void syncLatestHistoryRef.current(true)
        }
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                // P-I3: Skip if a forced sync happened less than 3 seconds ago
                if (Date.now() - lastForceSyncRef.current < 3000) return
                lastForceSyncRef.current = Date.now()
                void syncLatestHistoryRef.current(true)
                // Restart adaptive polling when tab becomes visible again
                if (!intervalId) scheduleNext()
            } else {
                // Stop polling when tab is hidden
                if (intervalId) {
                    clearTimeout(intervalId)
                    intervalId = null
                }
            }
        }

        window.addEventListener('focus', handleFocus)
        document.addEventListener('visibilitychange', handleVisibility)
        void syncLatestHistoryRef.current(true)

        return () => {
            if (intervalId) clearTimeout(intervalId)
            window.removeEventListener('focus', handleFocus)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [historyBootstrapDone, isHydrated, userId])

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
                olderHistoryLoadedRef.current = true
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

    const retryBootstrap = useCallback(() => {
        if (historyStatus !== 'error') return
        setHistoryBootstrapDone(false)
        setHistoryStatus('unknown')
    }, [historyStatus])

    return {
        historyStatus,
        hasMoreHistory,
        isLoadingOlderHistory,
        isBootstrappingHistory,
        loadOlderHistory,
        syncLatestHistory,
        historyBootstrapDone,
        retryBootstrap,
    }
}
