'use client'

import { useCallback, useRef } from 'react'
import { useChatStore, type Message } from '@/stores/chat-store'
import { normalizeActivityStatus } from '@/constants/character-greetings'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { hasOpenFloorIntent } from './use-autonomous-flow'

type ChatEvent =
    | { type: 'message'; character: string; content?: string; delay: number; message_id?: string; target_message_id?: string }
    | { type: 'reaction'; character: string; content?: string; delay: number; message_id?: string; target_message_id?: string }
    | { type: 'status_update'; character: string; content?: string; delay: number }
    | { type: 'nickname_update'; character: string; content?: string; delay: number }
    | { type: 'typing_ghost'; character: string; content?: string; delay: number }

type ChatApiResponse = {
    events: ChatEvent[]
    should_continue?: boolean
}

export type SendToApiArgs = {
    isIntro: boolean
    isAutonomous: boolean
    autonomousIdle?: boolean
    sourceUserMessageId?: string | null
}

export type SendToApiHandler = (args: SendToApiArgs) => Promise<void>
export type HandleSendHandler = (content: string, options?: { replyToId?: string; reaction?: string }) => Promise<void>

const CAPACITY_BACKOFF_MIN_MS = 90_000
const MAX_DELIVERY_ERROR_CHARS = 140

function withDeliveryError(errorMessage: string) {
    const trimmed = errorMessage.trim()
    if (!trimmed) return 'Failed to send'
    return trimmed.slice(0, MAX_DELIVERY_ERROR_CHARS)
}

interface UseChatApiArgs {
    activeGang: { id: string; name: string; typingSpeed?: number }[]
    userId: string | null
    userName: string | null
    userNickname: string | null
    isGuest: boolean
    messages: Message[]
    chatMode: 'entourage' | 'ecosystem'
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
    setShowAuthWall: (show: boolean) => void
    setReplyingTo: (msg: Message | null) => void
}

export function useChatApi({
    activeGang,
    userId,
    userName,
    userNickname,
    isGuest,
    messages,
    chatMode,
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
    setShowAuthWall,
    setReplyingTo,
}: UseChatApiArgs) {
    const { addMessage, setMessages, setCharacterStatus, setUserNickname } = useChatStore()

    const isGeneratingRef = useRef(false)
    const pendingUserMessagesRef = useRef(false)
    const pendingBlockedMessageRef = useRef<{ content: string; replyToId?: string; reaction?: string } | null>(null)
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

    // Refs for autonomous functions (patched externally after useAutonomousFlow initializes)
    const autonomousBackoffUntilRef = useRef(0)
    const clearIdleAutonomousTimerRef = useRef<() => void>(() => { })
    const scheduleIdleAutonomousRef = useRef<(sourceUserMessageId: string | null) => void>(() => { })
    const triggerLocalGreetingRef = useRef<() => void>(() => { })
    const initialGreetingRef = useRef(false)

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

    const sendToApi: SendToApiHandler = async ({ isIntro, isAutonomous, autonomousIdle = false, sourceUserMessageId }) => {
        const effectiveLowCostModeForCall = lowCostMode || autoLowCostModeRef.current

        if (isAutonomous) {
            if (effectiveLowCostModeForCall) {
                isGeneratingRef.current = false
                return
            }
            if (silentTurnsRef.current >= 10) {
                console.log("Autonomous flow stopped: 10 message limit reached.")
                isGeneratingRef.current = false
                return
            }
            if (burstCountRef.current >= 3) {
                console.log("Autonomous flow stopped: 3-burst limit reached.")
                isGeneratingRef.current = false
                return
            }
            if (Date.now() < autonomousBackoffUntilRef.current) {
                isGeneratingRef.current = false
                return
            }
        }

        isGeneratingRef.current = true

        if (isAutonomous && chatMode === 'ecosystem') {
            triggerActivityPulse()
        }

        let apiCallSucceeded = false
        let pendingDeliveryIdsForCall: string[] = []
        try {
            const currentMessages = useChatStore.getState().messages
            const sourceUserMessage = sourceUserMessageId
                ? currentMessages.find((m) => m.id === sourceUserMessageId && m.speaker === 'user')
                : null
            const openFloorIntent = !!sourceUserMessage?.content && hasOpenFloorIntent(sourceUserMessage.content)

            const payloadLimit = effectiveLowCostModeForCall ? 10 : 16
            const sendableMessages = currentMessages.filter((m) => (
                !(m.speaker === 'user' && m.deliveryStatus === 'failed')
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
                replyToId: m.replyToId
            }))
            const mockAi = typeof window !== 'undefined' && (window.localStorage.getItem('mock_ai') === 'true' || process.env.NEXT_PUBLIC_MOCK_AI === 'true')
            const requestBody = {
                messages: payloadMessages,
                activeGangIds: activeGang.map(c => c.id),
                userName,
                userNickname,
                isFirstMessage: currentMessages.length === 0 && isIntro,
                silentTurns: silentTurnsRef.current,
                burstCount: burstCountRef.current,
                chatMode,
                lowCostMode: effectiveLowCostModeForCall,
                source: autonomousIdle ? 'autonomous_idle' : isAutonomous ? 'autonomous' : 'user',
                autonomousIdle
            }

            let res: Response | null = null
            let data: ChatApiResponse | null = null
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    if (isAutonomous && attempt === 0) {
                        const minGapMs = 1600
                        const elapsed = Date.now() - lastApiCallAtRef.current
                        if (elapsed < minGapMs) {
                            await new Promise((resolve) => setTimeout(resolve, minGapMs - elapsed))
                        }
                    }
                    lastApiCallAtRef.current = Date.now()
                    res = await fetch('/api/chat', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(mockAi ? { 'x-mock-ai': 'true' } : {})
                        },
                        body: JSON.stringify(requestBody)
                    })
                    data = null
                    try {
                        data = await res.json()
                    } catch (err) {
                        console.error('Failed to parse response:', err)
                    }
                    trackEvent('chat_api_call', {
                        metadata: {
                            source: autonomousIdle ? 'autonomous_idle' : isAutonomous ? 'autonomous' : 'user',
                            status: res.status,
                            attempt,
                            lowCostMode: effectiveLowCostModeForCall,
                            manualLowCostMode: lowCostMode,
                            autoLowCostMode: autoLowCostModeRef.current,
                            payloadMessages: payloadMessages.length
                        }
                    })
                    if (res.ok || res.status < 500 || attempt === 1) break
                } catch (err) {
                    trackEvent('chat_api_call', {
                        metadata: {
                            source: autonomousIdle ? 'autonomous_idle' : isAutonomous ? 'autonomous' : 'user',
                            status: 'network_error',
                            attempt,
                            lowCostMode: effectiveLowCostModeForCall,
                            manualLowCostMode: lowCostMode,
                            autoLowCostMode: autoLowCostModeRef.current,
                            payloadMessages: payloadMessages.length
                        }
                    })
                    if (attempt === 1) throw err
                }
                await new Promise((resolve) => setTimeout(resolve, 420 + attempt * 240))
            }

            if (!res) {
                throw new Error('No response from chat API')
            }

            if (!res.ok) {
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

            if (!data?.events) {
                throw new Error('Invalid response shape')
            }
            apiCallSucceeded = true
            updateUserDeliveryStatus(pendingDeliveryIdsForCall, 'sent')
            if (!isAutonomous && !isIntro) {
                recordSuccessfulUserTurn()
            }

            clearTypingUsers()

            // == THE SEQUENCER ==
            for (const event of data.events) {
                if (pendingUserMessagesRef.current) {
                    console.log("AI Sequencing interrupted by new user message.")
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
                        const typingTime = Math.max(900, eventContent.length * 30 * speedFactor + Math.random() * 500)
                        await new Promise(r => setTimeout(r, typingTime))

                        if (pendingUserMessagesRef.current) break

                        addMessage({
                            id: event.message_id || `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            speaker: event.character,
                            content: eventContent,
                            created_at: new Date().toISOString(),
                            replyToId: event.target_message_id
                        })
                        if (isAutonomous || isIntro) silentTurnsRef.current++
                        removeTypingUser(event.character)
                        break
                    }

                    case 'reaction':
                        addMessage({
                            id: event.message_id || `ai-react-${Date.now()}`,
                            speaker: event.character,
                            content: event.content || '\u{1F44D}',
                            created_at: new Date().toISOString(),
                            reaction: event.content || '\u{1F44D}',
                            replyToId: event.target_message_id
                        })
                        if (isAutonomous || isIntro) silentTurnsRef.current++
                        break

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

            // == AUTONOMOUS CONTINUATION CHECK ==
            const burstLimit = effectiveLowCostModeForCall ? 1 : (chatMode === 'entourage' ? 1 : 2)
            const autonomousAllowed = Date.now() >= autonomousBackoffUntilRef.current
            const allowAutonomousChain = !isAutonomous
            if (!effectiveLowCostModeForCall && autonomousAllowed && allowAutonomousChain && data.should_continue && burstCountRef.current < (burstLimit - 1) && !pendingUserMessagesRef.current) {
                burstCountRef.current++
                await new Promise(r => setTimeout(r, 1000))
                isGeneratingRef.current = false
                const sourceId = sourceUserMessageId || lastUserMessageIdRef.current
                sendToApi({ isIntro: false, isAutonomous: true, sourceUserMessageId: sourceId })
                return
            }

            if (!effectiveLowCostModeForCall && autonomousAllowed && !data.should_continue && !isAutonomous && chatMode === 'ecosystem' && openFloorIntent && !pendingUserMessagesRef.current && burstCountRef.current < 1) {
                burstCountRef.current += 1
                await new Promise((r) => setTimeout(r, 900))
                isGeneratingRef.current = false
                const sourceId = sourceUserMessageId || lastUserMessageIdRef.current
                sendToApi({ isIntro: false, isAutonomous: true, sourceUserMessageId: sourceId })
                return
            }

        } catch (err) {
            console.error('Chat API Error:', err)
            updateUserDeliveryStatus(pendingDeliveryIdsForCall, 'failed', 'Network hiccup. Try again in a moment.')
            onToast('Network hiccup. Try again in a moment.')
        } finally {
            if (pendingUserMessagesRef.current) {
                pendingUserMessagesRef.current = false
                isGeneratingRef.current = false
                const sourceId = pendingUserMessageIdRef.current
                pendingUserMessageIdRef.current = null
                sendToApi({ isIntro: false, isAutonomous: false, sourceUserMessageId: sourceId })
            } else {
                isGeneratingRef.current = false
                clearTypingUsers()
                if (!isIntro && !pendingUserMessagesRef.current && apiCallSucceeded && !effectiveLowCostModeForCall) {
                    const sourceId = sourceUserMessageId || lastUserMessageIdRef.current
                    if (sourceId && (autonomousIdle || !isAutonomous)) {
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
            sendToApi({ isIntro: false, isAutonomous: false, sourceUserMessageId: sourceId })
        }, 600)
    }

    const enqueueUserMessage = (content: string, options?: { replyToId?: string; reaction?: string }) => {
        const trimmed = content.trim()
        if (!trimmed) return false

        localMessageCounterRef.current += 1
        const localId = `user-${Date.now()}-${localMessageCounterRef.current}`

        if (isGuest && !messages.some(m => m.speaker === 'user')) {
            pendingBlockedMessageRef.current = { content: trimmed, replyToId: options?.replyToId, reaction: options?.reaction }
            setShowAuthWall(true)
            if (messages.length === 0 && !initialGreetingRef.current) {
                triggerLocalGreetingRef.current()
            }
            return false
        }

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
        const isIntro = content.trim() === "" && messages.length === 0
        const isAutonomous = content.trim() === "" && messages.length > 0

        if (!isIntro && !isAutonomous && content.trim()) {
            const sent = enqueueUserMessage(content, options)
            if (sent) setReplyingTo(null)
            return
        } else if (!isIntro && !isAutonomous && !content.trim()) {
            return
        }

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
        pendingBlockedMessageRef,
        lastUserMessageIdRef,
        silentTurnsRef,
        burstCountRef,
        idleAutoCountRef,
        sessionRef,
        firstMessageLoggedRef,
        // Autonomous bridge refs (to be patched by page after useAutonomousFlow)
        autonomousBackoffUntilRef,
        clearIdleAutonomousTimerRef,
        scheduleIdleAutonomousRef,
        triggerLocalGreetingRef,
        initialGreetingRef,
    }
}
