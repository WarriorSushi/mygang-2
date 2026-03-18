'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useChatStore, type Message } from '@/stores/chat-store'
import { normalizeActivityStatus } from '@/constants/character-greetings'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { getContextLimit, getTierFromProfile } from '@/lib/billing'
import { hasOpenFloorIntent } from '@/lib/chat-utils'
import type { TokenUsage } from '@/types/shared'

/** Only live-chat messages (source='chat' or legacy/undefined) enter the payload window. */
export function isLiveChatMessage(m: { source?: string }): boolean {
    return !m.source || m.source === 'chat'
}

export function getPayloadWindowLimit(
    subscriptionTier: string | null | undefined,
    lowCostMode: boolean
): number {
    if (lowCostMode) return 10
    return getContextLimit(getTierFromProfile(subscriptionTier ?? null))
}

type ChatEvent =
    | { type: 'message'; character: string; content?: string; delay: number; message_id?: string; target_message_id?: string }
    | { type: 'reaction'; character: string; content?: string; delay: number; message_id?: string; target_message_id?: string }
    | { type: 'status_update'; character: string; content?: string; delay: number }
    | { type: 'nickname_update'; character: string; content?: string; delay: number }
    | { type: 'typing_ghost'; character: string; content?: string; delay: number }

type ChatApiResponse = {
    events: ChatEvent[]
    should_continue?: boolean
    usage?: TokenUsage
    paywall?: boolean
    cooldown_seconds?: number
    tier?: string
    messages_remaining?: number
    memories_saved_count?: number
    total_memory_count?: number
    turn_id?: string
}

type RenderedChatEventPayload = {
    message_id: string
    speaker: string
    content: string
    displayed_at: string
    reaction?: string | null
    reply_to_message_id?: string
}

export type SendToApiArgs = {
    isIntro: boolean
    isAutonomous: boolean
    autonomousIdle?: boolean
    sourceUserMessageId?: string | null
    purchaseCelebration?: 'basic' | 'pro'
}

export type SendToApiHandler = (args: SendToApiArgs) => Promise<void>
export type HandleSendHandler = (content: string, options?: { replyToId?: string; reaction?: string }) => Promise<void>

const CAPACITY_BACKOFF_MIN_MS = 90_000
const MAX_DELIVERY_ERROR_CHARS = 140
const DEFAULT_CHAT_REQUEST_TIMEOUT_MS = 30_000
let cooldownNotifTimer: ReturnType<typeof setTimeout> | null = null

function withDeliveryError(errorMessage: string) {
    const trimmed = errorMessage.trim()
    if (!trimmed) return 'Failed to send'
    return trimmed.slice(0, MAX_DELIVERY_ERROR_CHARS)
}

function getChatRequestTimeoutMs() {
    if (typeof window === 'undefined') return DEFAULT_CHAT_REQUEST_TIMEOUT_MS

    const override = window.localStorage.getItem('mygang-test-chat-request-timeout-ms')
    const parsed = Number(override)
    if (!Number.isFinite(parsed) || parsed < 500) return DEFAULT_CHAT_REQUEST_TIMEOUT_MS
    return Math.min(parsed, 120_000)
}

function isFarewellLikeMessage(text: string) {
    return /\b(goodnight|good night|gn|bye|goodbye|see ya|see you|ttyl|gotta go|later|nighty)\b/i.test(text)
}

async function persistRenderedEvents(turnId: string, events: RenderedChatEventPayload[]) {
    if (!turnId || events.length === 0) return

    try {
        await fetch('/api/chat/rendered', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                turn_id: turnId,
                events,
            }),
            keepalive: true,
        })
    } catch (err) {
        console.error('Failed to persist rendered events:', err)
    }
}

interface UseChatApiArgs {
    activeGang: { id: string; name: string; typingSpeed?: number }[]
    userName: string | null
    userNickname: string | null
    chatMode: 'gang_focus' | 'ecosystem'
    ecosystemSpeed: 'fast' | 'normal' | 'relaxed'
    lowCostMode: boolean
    isOnline: boolean
    autoLowCostModeRef: React.RefObject<boolean>
    onToast: (message: string) => void
    // Typing simulation
    queueTypingUser: (id: string) => void
    removeTypingUser: (id: string) => void
    clearTypingUsers: () => void
    bumpFastMode: () => void
    triggerActivityPulse: () => void
    triggerReadingStatuses: () => void
    // Capacity
    recordCapacityError: (status: number, isUserInitiated: boolean) => void
    recordSuccessfulUserTurn: () => void
    // UI state setters
    setReplyingTo: (msg: Message | null) => void
    // Paywall callback
    onPaywall?: (cooldownSeconds: number, tier: string) => void
}

export function useChatApi({
    activeGang,
    userName,
    userNickname,
    chatMode,
    ecosystemSpeed,
    lowCostMode,
    isOnline,
    autoLowCostModeRef,
    onToast,
    queueTypingUser,
    removeTypingUser,
    clearTypingUsers,
    bumpFastMode,
    triggerActivityPulse,
    triggerReadingStatuses,
    recordCapacityError,
    recordSuccessfulUserTurn,
    setReplyingTo,
    onPaywall,
}: UseChatApiArgs) {
    const addMessage = useChatStore((s) => s.addMessage)
    const setMessages = useChatStore((s) => s.setMessages)
    const setCharacterStatus = useChatStore((s) => s.setCharacterStatus)
    const setUserNickname = useChatStore((s) => s.setUserNickname)

    const isGeneratingRef = useRef(false)
    const pendingUserMessagesRef = useRef(false)
    const pendingUserMessageIdRef = useRef<string | null>(null)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const silentTurnsRef = useRef(0)
    const burstCountRef = useRef(0)
    const lastApiCallAtRef = useRef(0)
    const lastUserMessageIdRef = useRef<string | null>(null)
    const localMessageCounterRef = useRef(0)
    const sendToApiRef = useRef<SendToApiHandler>(async () => { })
    const handleSendRef = useRef<HandleSendHandler>(async () => { })
    const sessionRef = useRef<{ id: string; startedAt: number } | null>(null)
    const firstMessageLoggedRef = useRef(false)
    const idleAutoCountRef = useRef(0)
    const lastTokenUsageRef = useRef<TokenUsage | null>(null)

    // Refs for autonomous functions (patched externally after useAutonomousFlow initializes)
    const autonomousBackoffUntilRef = useRef(0)
    const clearIdleAutonomousTimerRef = useRef<() => void>(() => { })
    const scheduleIdleAutonomousRef = useRef<(sourceUserMessageId: string | null) => void>(() => { })
    const triggerLocalGreetingRef = useRef<() => void>(() => { })
    const initialGreetingRef = useRef(false)
    const abortControllerRef = useRef<AbortController | null>(null)

    // Cleanup: abort any in-flight fetch and clear timers on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort()
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            if (cooldownNotifTimer) {
                clearTimeout(cooldownNotifTimer)
                cooldownNotifTimer = null
            }
        }
    }, [])

    const updateUserDeliveryStatus = useCallback((
        messageIds: string[],
        status: 'sending' | 'sent' | 'failed',
        errorMessage?: string
    ) => {
        if (messageIds.length === 0) return
        const targetIds = new Set(messageIds)
        const currentMessages = useChatStore.getState().messages
        const updated: Message[] = currentMessages.map((message): Message => {
            if (message.speaker !== 'user') return message
            if (!targetIds.has(message.id)) return message
            if (status === 'failed') {
                return {
                    ...message,
                    deliveryStatus: 'failed',
                    deliveryError: withDeliveryError(errorMessage || 'Failed to send')
                }
            }
            if (status === 'sending') {
                return {
                    ...message,
                    deliveryStatus: 'sending',
                    deliveryError: undefined
                }
            }
            return {
                ...message,
                deliveryStatus: 'sent',
                deliveryError: undefined
            }
        })
        setMessages(updated)
    }, [setMessages])

    const sendToApi: SendToApiHandler = async ({ isIntro, isAutonomous, autonomousIdle = false, sourceUserMessageId, purchaseCelebration }) => {
        // Lock immediately to prevent race conditions — concurrent autonomous calls
        // could slip through the async delay below if this is set after early returns.
        isGeneratingRef.current = true

        const effectiveLowCostModeForCall = lowCostMode || autoLowCostModeRef.current

        if (isAutonomous) {
            if (effectiveLowCostModeForCall && !purchaseCelebration) {
                isGeneratingRef.current = false
                return
            }
            if (silentTurnsRef.current >= 10) {
                if (process.env.NODE_ENV !== 'production') console.log("Autonomous flow stopped: 10 message limit reached.")
                isGeneratingRef.current = false
                return
            }
            if (burstCountRef.current >= 3) {
                if (process.env.NODE_ENV !== 'production') console.log("Autonomous flow stopped: 3-burst limit reached.")
                isGeneratingRef.current = false
                return
            }
            if (Date.now() < autonomousBackoffUntilRef.current) {
                isGeneratingRef.current = false
                return
            }
        }

        if (isAutonomous && chatMode === 'ecosystem') {
            triggerActivityPulse()
        }

        let apiCallSucceeded = false
        let continuationTriggered = false
        let pendingDeliveryIdsForCall: string[] = []
        const renderedEventsForAck: RenderedChatEventPayload[] = []
        let responseTurnId: string | null = null
        let requestTimedOut = false
        try {
            const currentMessages = useChatStore.getState().messages
            const sourceUserMessage = sourceUserMessageId
                ? currentMessages.find((m) => m.id === sourceUserMessageId && m.speaker === 'user')
                : null
            const openFloorIntent = !!sourceUserMessage?.content && hasOpenFloorIntent(sourceUserMessage.content)

            const payloadLimit = getPayloadWindowLimit(
                useChatStore.getState().subscriptionTier,
                effectiveLowCostModeForCall
            )
            const sendableMessages = currentMessages.filter((m) => (
                !(m.speaker === 'user' && m.deliveryStatus === 'failed')
                && isLiveChatMessage(m)
            ))
            const payloadSourceMessages = sendableMessages.slice(-payloadLimit)
            pendingDeliveryIdsForCall = payloadSourceMessages
                .filter((m) => m.speaker === 'user' && m.deliveryStatus === 'sending')
                .map((m) => m.id)
            const payloadMessages = payloadSourceMessages.map((m) => ({
                id: m.id,
                speaker: m.speaker,
                content: m.content,
                created_at: m.created_at,
                reaction: m.reaction,
                replyToId: m.replyToId,
                source: m.source,
            }))
            const mockAi = typeof window !== 'undefined' && (window.localStorage.getItem('mock_ai') === 'true' || process.env.NEXT_PUBLIC_MOCK_AI === 'true')
            const requestBody = {
                messages: payloadMessages,
                activeGangIds: activeGang.map(c => c.id),
                userName,
                userNickname,
                silentTurns: silentTurnsRef.current,
                burstCount: burstCountRef.current,
                chatMode,
                lowCostMode: effectiveLowCostModeForCall,
                source: autonomousIdle ? 'autonomous_idle' : isAutonomous ? 'autonomous' : 'user',
                autonomousIdle,
                ...(purchaseCelebration ? { purchaseCelebration } : {})
            }

            let res: Response | null = null
            let data: ChatApiResponse | null = null

            if (isAutonomous) {
                const minGapMs = 1600
                const elapsed = Date.now() - lastApiCallAtRef.current
                if (elapsed < minGapMs) {
                    await new Promise((resolve) => setTimeout(resolve, minGapMs - elapsed))
                }
            }
            lastApiCallAtRef.current = Date.now()
            const requestTimeoutMs = getChatRequestTimeoutMs()
            abortControllerRef.current?.abort()
            const requestController = new AbortController()
            abortControllerRef.current = requestController
            let requestTimeoutId: number | null = null
            try {
                res = await Promise.race([
                    fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(mockAi ? { 'x-mock-ai': 'true' } : {})
                        },
                        body: JSON.stringify(requestBody),
                        signal: requestController.signal,
                    }),
                    new Promise<never>((_, reject) => {
                        requestTimeoutId = window.setTimeout(() => {
                            requestTimedOut = true
                            requestController.abort()
                            reject(new DOMException('Chat request timed out', 'AbortError'))
                        }, requestTimeoutMs)
                    })
                ])
            } finally {
                if (requestTimeoutId) {
                    window.clearTimeout(requestTimeoutId)
                }
                if (abortControllerRef.current === requestController) {
                    abortControllerRef.current = null
                }
            }
            try {
                data = await res.json()
            } catch (err) {
                console.error('Failed to parse response:', err)
            }
            if (!res) {
                throw new Error('No response from chat API')
            }

            // Paywall detection: API signals the user hit their message limit
            if (data?.paywall === true) {
                updateUserDeliveryStatus(pendingDeliveryIdsForCall, 'failed', 'Cooldown active -- upgrade or wait')
                const cooldownSec = data.cooldown_seconds ?? 300
                if (onPaywall) {
                    onPaywall(cooldownSec, data.tier ?? 'free')
                }
                // Request notification permission and schedule cooldown-end notification
                if (typeof window !== 'undefined' && 'Notification' in window) {
                    if (Notification.permission === 'default') {
                        Notification.requestPermission().catch(() => {})
                    }
                    if (cooldownSec > 0) {
                        // Clear any existing cooldown notification timer
                        if (cooldownNotifTimer) clearTimeout(cooldownNotifTimer)

                        cooldownNotifTimer = setTimeout(() => {
                            cooldownNotifTimer = null
                            if (Notification.permission === 'granted') {
                                new Notification('MyGang', { body: 'Your gang is ready! Come back and chat.' })
                            }
                        }, cooldownSec * 1000)
                    }
                }
                return
            }

            if (!res.ok) {
                // UF-I4: Detect expired session and prompt re-login
                if (res.status === 401) {
                    updateUserDeliveryStatus(pendingDeliveryIdsForCall, 'failed', 'Session expired')
                    onToast('Your session has expired. Please sign in again.')
                    setTimeout(() => {
                        if (typeof window !== 'undefined') window.location.href = '/'
                    }, 2000)
                    return
                }

                trackEvent('chat_api_call', {
                    metadata: {
                        source: autonomousIdle ? 'autonomous_idle' : isAutonomous ? 'autonomous' : 'user',
                        status: res.status,
                        ok: false,
                        lowCostMode: effectiveLowCostModeForCall,
                        payloadMessages: payloadMessages.length
                    }
                })
                const responseHint = data?.events?.[0]?.content || ''
                const retryAfterValue = res.headers.get('Retry-After')
                const retryAfterHeader = Number(retryAfterValue || '')
                const isLikelyCapacityError = res.status === 402
                    || (res.status === 429 && (
                        Boolean(retryAfterValue)
                        || /capacity|quota|credit|resource/i.test(responseHint)
                    ))

                if (isLikelyCapacityError) {
                    const retryAfterMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
                        ? retryAfterHeader * 1000
                        : CAPACITY_BACKOFF_MIN_MS
                    autonomousBackoffUntilRef.current = Date.now() + Math.max(CAPACITY_BACKOFF_MIN_MS, retryAfterMs)
                    recordCapacityError(res.status, !isAutonomous && !isIntro)
                }
                const fallbackErrorMessage = responseHint || 'Quick hiccup on our side. Please try again.'
                onToast(fallbackErrorMessage)
                updateUserDeliveryStatus(pendingDeliveryIdsForCall, 'failed', fallbackErrorMessage)
                if (!data?.events) {
                    addMessage({
                        id: `ai-error-${Date.now()}`,
                        speaker: 'system',
                        content: fallbackErrorMessage,
                        created_at: new Date().toISOString()
                    })
                } else {
                    data.events.forEach((event) => {
                        if (event.type === 'message') {
                            addMessage({
                                id: event.message_id || `ai-error-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                speaker: event.character,
                                content: event.content || fallbackErrorMessage,
                                created_at: new Date().toISOString(),
                                replyToId: event.target_message_id
                            })
                        }
                    })
                }
                return
            }

            trackEvent('chat_api_call', {
                metadata: {
                    source: autonomousIdle ? 'autonomous_idle' : isAutonomous ? 'autonomous' : 'user',
                    status: res.status,
                    ok: true,
                    lowCostMode: effectiveLowCostModeForCall,
                    payloadMessages: payloadMessages.length
                }
            })

            if (!data?.events) {
                throw new Error('Invalid response shape')
            }
            apiCallSucceeded = true
            responseTurnId = data.turn_id ?? null
            if (data.usage) {
                lastTokenUsageRef.current = data.usage
            }
            // Update messages remaining in store for banner display
            if (data.messages_remaining !== undefined) {
                useChatStore.getState().setMessagesRemaining(data.messages_remaining)
            }
            // Accumulate new memory count for notification badge (paid tiers)
            if (data.memories_saved_count && data.memories_saved_count > 0) {
                useChatStore.getState().incrementNewMemoryCount(data.memories_saved_count)
            }
            // Total memory count for free tier badge (never clears)
            if (data.total_memory_count !== undefined) {
                useChatStore.getState().setTotalMemoryCount(data.total_memory_count)
            }
            // Mark ALL user messages still stuck in 'sending' as 'sent', not just the payload window
            const allSendingIds = useChatStore.getState().messages
                .filter((m) => m.speaker === 'user' && m.deliveryStatus === 'sending')
                .map((m) => m.id)
            updateUserDeliveryStatus(allSendingIds, 'sent')
            if (!isAutonomous && !isIntro) {
                recordSuccessfulUserTurn()
            }

            clearTypingUsers()

            // == THE SEQUENCER ==
            for (const event of data.events) {
                if (pendingUserMessagesRef.current) {
                    if (process.env.NODE_ENV !== 'production') console.log("AI Sequencing interrupted by new user message.")
                    break
                }

                await new Promise(r => setTimeout(r, event.delay))

                if (pendingUserMessagesRef.current) break

                switch (event.type) {
                    case 'message': {
                        setCharacterStatus(event.character, "")
                        queueTypingUser(event.character)
                        const eventContent = event.content || ''
                        const speedFactor = activeGang.find(c => c.id === event.character)?.typingSpeed || 1
                        const ecosystemMultiplier = ecosystemSpeed === 'fast' ? 0.5 : ecosystemSpeed === 'relaxed' ? 2 : 1
                        const typingTime = Math.min(3000, Math.max(eventContent.length < 10 ? 400 : 700, eventContent.length * 18 * speedFactor * ecosystemMultiplier + Math.random() * 300))
                        await new Promise(r => setTimeout(r, typingTime))

                        if (pendingUserMessagesRef.current) break

                        const displayedAt = new Date().toISOString()
                        const messageId = event.message_id || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
                        addMessage({
                            id: messageId,
                            speaker: event.character,
                            content: eventContent,
                            created_at: displayedAt,
                            replyToId: event.target_message_id
                        })
                        renderedEventsForAck.push({
                            message_id: messageId,
                            speaker: event.character,
                            content: eventContent,
                            displayed_at: displayedAt,
                            reply_to_message_id: event.target_message_id,
                        })
                        if (isAutonomous || isIntro) silentTurnsRef.current++
                        removeTypingUser(event.character)
                        break
                    }

                    case 'reaction': {
                        const displayedAt = new Date().toISOString()
                        const reactionContent = event.content || '\u{1F44D}'
                        const messageId = event.message_id || `ai-react-${Date.now()}`
                        addMessage({
                            id: messageId,
                            speaker: event.character,
                            content: reactionContent,
                            created_at: displayedAt,
                            reaction: reactionContent,
                            replyToId: event.target_message_id
                        })
                        renderedEventsForAck.push({
                            message_id: messageId,
                            speaker: event.character,
                            content: reactionContent,
                            displayed_at: displayedAt,
                            reaction: reactionContent,
                            reply_to_message_id: event.target_message_id,
                        })
                        if (isAutonomous || isIntro) silentTurnsRef.current++
                        break
                    }

                    case 'status_update':
                        setCharacterStatus(event.character, normalizeActivityStatus(event.content))
                        break

                    case 'nickname_update':
                        if (event.content) setUserNickname(event.content)
                        break

                    case 'typing_ghost':
                        setCharacterStatus(event.character, "")
                        queueTypingUser(event.character)
                        await new Promise(r => setTimeout(r, 2500))
                        removeTypingUser(event.character)
                        break
                }
            }

            // TODO: P-C3 — move AI persistence to server waitUntil
            // Currently skipped: server doesn't know client-generated message_id/displayed_at timestamps.
            // The rendered events are only known after the client sequencer runs (with typing delays).
            if (responseTurnId && renderedEventsForAck.length > 0) {
                void persistRenderedEvents(responseTurnId, renderedEventsForAck)
            }

            // == AUTONOMOUS CONTINUATION CHECK ==
            // Only allow ONE continuation, and only for explicit open-floor requests
            const autonomousAllowed = Date.now() >= autonomousBackoffUntilRef.current
            if (!effectiveLowCostModeForCall && autonomousAllowed && !isAutonomous && chatMode === 'ecosystem' && openFloorIntent && !pendingUserMessagesRef.current && burstCountRef.current < 1) {
                burstCountRef.current += 1
                continuationTriggered = true
                const ecoMultiplier = ecosystemSpeed === 'fast' ? 0.5 : ecosystemSpeed === 'relaxed' ? 2 : 1
                await new Promise((r) => setTimeout(r, 1200 * ecoMultiplier))
                isGeneratingRef.current = false
                const sourceId = sourceUserMessageId || lastUserMessageIdRef.current
                sendToApiRef.current({ isIntro: false, isAutonomous: true, sourceUserMessageId: sourceId }).catch((err) => console.error('Autonomous continuation error:', err))
                return
            }

        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                if (requestTimedOut) {
                    const timeoutMessage = 'Reply took too long. Please retry.'
                    updateUserDeliveryStatus(pendingDeliveryIdsForCall, 'failed', timeoutMessage)
                    onToast(timeoutMessage)
                }
                // Request was superseded by a newer send or aborted during cleanup.
                return
            }
            console.error('Chat API Error:', err)
            updateUserDeliveryStatus(pendingDeliveryIdsForCall, 'failed', 'Network hiccup. Try again in a moment.')
            onToast('Network hiccup. Try again in a moment.')
        } finally {
            if (pendingUserMessagesRef.current) {
                pendingUserMessagesRef.current = false
                clearTypingUsers()
                const sourceId = pendingUserMessageIdRef.current
                pendingUserMessageIdRef.current = null
                isGeneratingRef.current = true
                sendToApiRef.current({ isIntro: false, isAutonomous: false, sourceUserMessageId: sourceId }).catch((err) => console.error('Pending message retry error:', err))
            } else {
                isGeneratingRef.current = false
                clearTypingUsers()
                // Schedule one follow-up banter round 10s after last bubble, only for user-initiated messages
                const currentLowCost = useChatStore.getState().lowCostMode || autoLowCostModeRef.current
                if (!isIntro && !isAutonomous && apiCallSucceeded && !currentLowCost && chatMode === 'ecosystem' && !continuationTriggered) {
                    const sourceId = sourceUserMessageId || lastUserMessageIdRef.current
                    const sourceMessage = sourceId
                        ? useChatStore.getState().messages.find((message) => message.id === sourceId && message.speaker === 'user')
                        : null
                    const skipIdleFollowUp = !!sourceMessage?.content && isFarewellLikeMessage(sourceMessage.content)

                    if (sourceId && !skipIdleFollowUp) {
                        scheduleIdleAutonomousRef.current(sourceId)
                    }
                }
            }
        }
    }
    sendToApiRef.current = sendToApi

    const scheduleDebouncedSend = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null
            if (isGeneratingRef.current) {
                pendingUserMessagesRef.current = true
                return
            }
            const sourceId = pendingUserMessageIdRef.current
            pendingUserMessageIdRef.current = null
            sendToApiRef.current({ isIntro: false, isAutonomous: false, sourceUserMessageId: sourceId })
        }, 600)
    }

    const enqueueUserMessage = (content: string, options?: { replyToId?: string; reaction?: string }) => {
        const trimmed = content.trim()
        if (!trimmed) return false

        localMessageCounterRef.current += 1
        const localId = `user-${Date.now()}-${localMessageCounterRef.current}`

        const userMsg: Message = {
            id: localId,
            speaker: 'user',
            content: trimmed,
            created_at: new Date().toISOString(),
            replyToId: options?.replyToId,
            reaction: options?.reaction,
            deliveryStatus: 'sending',
            deliveryError: undefined
        }
        addMessage(userMsg)
        lastUserMessageIdRef.current = userMsg.id
        pendingUserMessageIdRef.current = userMsg.id
        idleAutoCountRef.current = 0
        clearIdleAutonomousTimerRef.current()
        triggerReadingStatuses()
        silentTurnsRef.current = 0
        burstCountRef.current = 0
        bumpFastMode()

        const session = sessionRef.current || ensureAnalyticsSession()
        sessionRef.current = { id: session.id, startedAt: session.startedAt }
        trackEvent('message_sent', {
            sessionId: session.id,
            metadata: { length: trimmed.length }
        })
        if (!firstMessageLoggedRef.current) {
            firstMessageLoggedRef.current = true
            const elapsedMs = Date.now() - session.startedAt
            trackEvent('time_to_first_message', {
                sessionId: session.id,
                value: Math.max(1, Math.round(elapsedMs / 1000))
            })
        }

        if (isGeneratingRef.current) {
            pendingUserMessagesRef.current = true
            abortControllerRef.current?.abort()
            return true
        }

        scheduleDebouncedSend()
        return true
    }

    const handleSend: HandleSendHandler = async (content: string, options?: { replyToId?: string; reaction?: string }) => {
        if (!isOnline) {
            onToast('You are offline. Reconnect and try again.')
            return
        }
        const currentMessageCount = useChatStore.getState().messages.length
        const isIntro = content.trim() === "" && currentMessageCount === 0
        const isAutonomous = content.trim() === "" && currentMessageCount > 0

        if (!isIntro && !isAutonomous && content.trim()) {
            const sent = enqueueUserMessage(content, options)
            if (sent) setReplyingTo(null)
            return
        } else if (!isIntro && !isAutonomous && !content.trim()) {
            return
        }

        if (isGeneratingRef.current) return
        await sendToApi({ isIntro, isAutonomous })
    }
    handleSendRef.current = handleSend

    const handleQuickLike = (target: Message) => {
        if (!isOnline) {
            onToast('You are offline. Reconnect and try again.')
            return
        }
        const sent = enqueueUserMessage('\u2764\uFE0F', { replyToId: target.id, reaction: '\u2764\uFE0F' })
        if (sent) setReplyingTo(null)
    }

    const handleRetryMessage = (target: Message) => {
        if (target.speaker !== 'user') return
        if (target.deliveryStatus !== 'failed') return
        if (!isOnline) {
            onToast('You are offline. Reconnect and try again.')
            return
        }

        updateUserDeliveryStatus([target.id], 'sending')
        pendingUserMessageIdRef.current = target.id
        lastUserMessageIdRef.current = target.id
        clearIdleAutonomousTimerRef.current()
        // M4 FIX: Reset autonomous counters like enqueueUserMessage does
        silentTurnsRef.current = 0
        burstCountRef.current = 0
        triggerReadingStatuses()
        trackEvent('message_retry', { metadata: { messageId: target.id } })

        if (isGeneratingRef.current) {
            pendingUserMessagesRef.current = true
            return
        }
        scheduleDebouncedSend()
    }

    return {
        handleSend,
        handleQuickLike,
        handleRetryMessage,
        isGeneratingRef,
        pendingUserMessagesRef,
        debounceTimerRef,
        sendToApiRef,
        handleSendRef,
        lastUserMessageIdRef,
        silentTurnsRef,
        burstCountRef,
        idleAutoCountRef,
        sessionRef,
        firstMessageLoggedRef,
        lastTokenUsageRef,
        // Autonomous bridge refs (to be patched by page after useAutonomousFlow)
        autonomousBackoffUntilRef,
        clearIdleAutonomousTimerRef,
        scheduleIdleAutonomousRef,
        triggerLocalGreetingRef,
        initialGreetingRef,
    }
}
