'use client'

import { useState, useRef, useEffect } from 'react'
import { useChatStore, Message } from '@/stores/chat-store'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import dynamic from 'next/dynamic'
import { toPng } from 'html-to-image'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { ACTIVITY_STATUSES, CHARACTER_GREETINGS, normalizeActivityStatus } from '@/constants/character-greetings'
import { getChatHistoryPage } from '@/app/auth/actions'

// New modular components
import { ChatHeader } from '@/components/chat/chat-header'
import { MessageList } from '@/components/chat/message-list'
const AuthWall = dynamic(() => import('@/components/orchestrator/auth-wall').then((m) => m.AuthWall), { ssr: false })
const MemoryVault = dynamic(() => import('@/components/chat/memory-vault').then((m) => m.MemoryVault), { ssr: false })
const ChatSettings = dynamic(() => import('@/components/chat/chat-settings').then((m) => m.ChatSettings), { ssr: false })
import { ChatInput } from '@/components/chat/chat-input'
import { ErrorBoundary } from '@/components/orchestrator/error-boundary'
import { InlineToast } from '@/components/chat/inline-toast'
const SquadReconcile = dynamic(() => import('@/components/orchestrator/squad-reconcile').then((m) => m.SquadReconcile), { ssr: false })

type ChatEvent =
    | { type: 'message'; character: string; content?: string; delay: number; target_message_id?: string }
    | { type: 'reaction'; character: string; content?: string; delay: number; target_message_id?: string }
    | { type: 'status_update'; character: string; content?: string; delay: number }
    | { type: 'nickname_update'; character: string; content?: string; delay: number }
    | { type: 'typing_ghost'; character: string; content?: string; delay: number }

type ChatApiResponse = {
    events: ChatEvent[]
    should_continue?: boolean
}

export default function ChatPage() {
    const {
        messages,
        activeGang,
        userId,
        userName,
        userNickname,
        isGuest,
        isHydrated,
        addMessage,
        setMessages,
        setIsGuest,
        setUserNickname,
        setCharacterStatus,
        chatMode,
        chatWallpaper,
        squadConflict,
        setSquadConflict
    } = useChatStore()
    const [typingUsers, setTypingUsers] = useState<string[]>([])
    const [showAuthWall, setShowAuthWall] = useState(false)
    const [isVaultOpen, setIsVaultOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [showResumeBanner, setShowResumeBanner] = useState(false)
    const [resumeBannerText, setResumeBannerText] = useState('Resumed your last session')
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [isFastMode, setIsFastMode] = useState(false)
    const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
    const [replyingTo, setReplyingTo] = useState<Message | null>(null)
    const [historyCursor, setHistoryCursor] = useState<string | null>(null)
    const [hasMoreHistory, setHasMoreHistory] = useState(false)
    const [isBootstrappingHistory, setIsBootstrappingHistory] = useState(false)
    const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false)
    const [historyBootstrapDone, setHistoryBootstrapDone] = useState(false)
    const [historyStatus, setHistoryStatus] = useState<'unknown' | 'has_history' | 'empty' | 'error'>('unknown')

    const captureRootRef = useRef<HTMLDivElement>(null)
    const { theme } = useTheme()
    const router = useRouter()
    const initialGreetingRef = useRef(false)
    const resumeBannerRef = useRef(false)
    const sessionRef = useRef<{ id: string; startedAt: number } | null>(null)
    const firstMessageLoggedRef = useRef(false)

    const isGeneratingRef = useRef(false)
    const pendingUserMessagesRef = useRef(false)
    const pendingBlockedMessageRef = useRef<{ content: string; replyToId?: string; reaction?: string } | null>(null)
    const pendingUserMessageIdRef = useRef<string | null>(null)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const silentTurnsRef = useRef(0)
    const burstCountRef = useRef(0)
    const typingUsersRef = useRef<Set<string>>(new Set())
    const typingFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const fastModeRef = useRef({ lastAt: 0, streak: 0 })
    const fastModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const greetingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const statusTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
    const idleAutonomousTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const idleAutoCountRef = useRef(0)
    const resumeAutonomousTriggeredRef = useRef(false)
    const lastUserMessageIdRef = useRef<string | null>(null)

    const flushTypingUsers = () => {
        typingFlushRef.current = null
        setTypingUsers(Array.from(typingUsersRef.current))
    }

    const scheduleTypingFlush = () => {
        if (typingFlushRef.current) return
        typingFlushRef.current = setTimeout(flushTypingUsers, 120)
    }

    const queueTypingUser = (id: string) => {
        typingUsersRef.current.add(id)
        scheduleTypingFlush()
    }

    const removeTypingUser = (id: string) => {
        typingUsersRef.current.delete(id)
        scheduleTypingFlush()
    }

    const clearTypingUsers = () => {
        typingUsersRef.current.clear()
        if (typingFlushRef.current) {
            clearTimeout(typingFlushRef.current)
            typingFlushRef.current = null
        }
        setTypingUsers([])
    }

    const bumpFastMode = () => {
        const now = Date.now()
        if (now - fastModeRef.current.lastAt < 1400) {
            fastModeRef.current.streak += 1
        } else {
            fastModeRef.current.streak = 1
        }
        fastModeRef.current.lastAt = now
        if (fastModeRef.current.streak >= 2) {
            setIsFastMode(true)
        }
        if (fastModeTimerRef.current) {
            clearTimeout(fastModeTimerRef.current)
        }
        fastModeTimerRef.current = setTimeout(() => {
            setIsFastMode(false)
            fastModeRef.current.streak = 0
        }, 3000)
    }

    // Guard: Redirect if no squad is selected
    useEffect(() => {
        if (isHydrated && activeGang.length === 0) {
            router.replace(userId ? '/post-auth' : '/onboarding')
        }
    }, [activeGang, isHydrated, router, userId])

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
                    setMessages(page.items)
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

    useEffect(() => {
        if (!isHydrated) return
        const session = ensureAnalyticsSession()
        sessionRef.current = { id: session.id, startedAt: session.startedAt }
        if (session.isNew) {
            trackEvent('session_start', { sessionId: session.id, metadata: { source: 'chat' } })
        }
    }, [isHydrated])

    useEffect(() => {
        return () => {
            if (typingFlushRef.current) clearTimeout(typingFlushRef.current)
            if (fastModeTimerRef.current) clearTimeout(fastModeTimerRef.current)
            greetingTimersRef.current.forEach(clearTimeout)
            Object.values(statusTimersRef.current).forEach((timer) => {
                if (timer) clearTimeout(timer)
            })
            if (idleAutonomousTimerRef.current) clearTimeout(idleAutonomousTimerRef.current)
        }
    }, [])

    useEffect(() => {
        const goOnline = () => setIsOnline(true)
        const goOffline = () => {
            setIsOnline(false)
            setToastMessage('You are offline. Messages will send after reconnecting.')
        }
        window.addEventListener('online', goOnline)
        window.addEventListener('offline', goOffline)
        return () => {
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
        }
    }, [])

    const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

    const hasOpenFloorIntent = (text: string) => {
        const value = text.toLowerCase()
        return (
            /you guys talk|talk among yourselves|keep chatting|continue without me|i'?ll listen|i will listen/.test(value)
            || /just talk|carry on|keep going|go on without me/.test(value)
        )
    }

    const scheduleGreeting = (fn: () => void, delay: number) => {
        const timer = setTimeout(fn, delay)
        greetingTimersRef.current.push(timer)
    }

    const pickStatusFor = (characterId: string) => {
        if (!characterId) return ACTIVITY_STATUSES[0]
        return pickRandom([...ACTIVITY_STATUSES])
    }

    const pulseStatus = (characterId: string, status: string, duration = 2400) => {
        if (!characterId) return
        setCharacterStatus(characterId, status)
        if (statusTimersRef.current[characterId]) {
            clearTimeout(statusTimersRef.current[characterId]!)
        }
        statusTimersRef.current[characterId] = setTimeout(() => {
            setCharacterStatus(characterId, "")
            statusTimersRef.current[characterId] = null
        }, duration)
    }

    const triggerLocalGreeting = () => {
        if (initialGreetingRef.current) return
        if (activeGang.length === 0 || messages.length > 0) return
        initialGreetingRef.current = true

        const nameLabel = userNickname || userName || 'friend'
        const speakers = [...activeGang].sort(() => 0.5 - Math.random()).slice(0, Math.min(3, activeGang.length))
        let delay = 200

        speakers.forEach((char) => {
            scheduleGreeting(() => {
                const hasUserMessage = useChatStore.getState().messages.some((m) => m.speaker === 'user')
                if (hasUserMessage) return
                queueTypingUser(char.id)
                pulseStatus(char.id, pickStatusFor(char.id), 1600)
                const line = pickRandom(CHARACTER_GREETINGS[char.id] || [`Hey ${nameLabel}, what should we talk about?`])
                    .replace('{name}', nameLabel)

                scheduleGreeting(() => {
                    removeTypingUser(char.id)
                    setCharacterStatus(char.id, "")
                    const stillNoUserMessage = useChatStore.getState().messages.every((m) => m.speaker !== 'user')
                    if (!stillNoUserMessage) return
                    addMessage({
                        id: `local-${char.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        speaker: char.id,
                        content: line,
                        created_at: new Date().toISOString(),
                    })
                }, 700 + Math.random() * 600)
            }, delay)
            delay += 900 + Math.random() * 700
        })
    }

    const triggerActivityPulse = () => {
        const available = activeGang.filter(c => c.id !== 'user')
        const picks = [...available].sort(() => 0.5 - Math.random()).slice(0, Math.min(2, available.length))
        picks.forEach((char, idx) => {
            const status = pickStatusFor(char.id)
            pulseStatus(char.id, status, 2200 + idx * 400)
        })
    }

    const triggerReadingStatuses = () => {
        const available = activeGang.filter(c => c.id !== 'user')
        const picks = [...available].sort(() => 0.5 - Math.random()).slice(0, Math.min(3, available.length))
        picks.forEach((char, idx) => {
            const status = pickStatusFor(char.id)
            pulseStatus(char.id, status, 2800 + idx * 500)
        })
    }

    const clearIdleAutonomousTimer = () => {
        if (idleAutonomousTimerRef.current) {
            clearTimeout(idleAutonomousTimerRef.current)
            idleAutonomousTimerRef.current = null
        }
    }

    const canRunIdleAutonomous = () => {
        if (useChatStore.getState().chatMode !== 'ecosystem') return false
        if (typeof document !== 'undefined') {
            if (document.visibilityState !== 'visible') return false
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false
        return true
    }

    const scheduleIdleAutonomous = (sourceUserMessageId: string | null) => {
        if (!sourceUserMessageId) return
        if (!canRunIdleAutonomous()) return
        if (idleAutoCountRef.current >= 2) return

        clearIdleAutonomousTimer()
        const delay = 15000 + idleAutoCountRef.current * 8000
        idleAutonomousTimerRef.current = setTimeout(() => {
            const currentMessages = useChatStore.getState().messages
            const lastMessage = currentMessages[currentMessages.length - 1]
            const stillSameUserMessage = lastUserMessageIdRef.current === sourceUserMessageId
            if (!stillSameUserMessage) return
            if (!canRunIdleAutonomous()) return
            if (!lastMessage || lastMessage.speaker === 'user') return
            if (isGeneratingRef.current || pendingUserMessagesRef.current) return

            idleAutoCountRef.current += 1
            sendToApi({
                isIntro: false,
                isAutonomous: true,
                autonomousIdle: true,
                sourceUserMessageId,
            })
        }, delay)
    }

    // Returning users with prior history get a context-aware re-entry turn, not canned greetings.
    useEffect(() => {
        if (!isHydrated || !userId) return
        if (chatMode !== 'ecosystem') return
        if (historyStatus !== 'has_history') return
        if (resumeAutonomousTriggeredRef.current) return
        if (messages.length === 0) return
        if (!canRunIdleAutonomous()) return

        const lastMessage = messages[messages.length - 1]
        const lastAt = lastMessage?.created_at ? new Date(lastMessage.created_at).getTime() : 0
        const gapMs = lastAt ? Date.now() - lastAt : 0
        if (gapMs < 3 * 60 * 1000) {
            resumeAutonomousTriggeredRef.current = true
            return
        }

        const lastUserMessage = [...messages].reverse().find((m) => m.speaker === 'user')
        resumeAutonomousTriggeredRef.current = true
        const timer = setTimeout(() => {
            if (isGeneratingRef.current || pendingUserMessagesRef.current) return
            sendToApi({
                isIntro: false,
                isAutonomous: true,
                sourceUserMessageId: lastUserMessage?.id ?? null,
            })
        }, 700)
        return () => clearTimeout(timer)
    }, [chatMode, historyStatus, isHydrated, messages, userId])

    // Initial greeting should only run for genuine first-time sessions.
    useEffect(() => {
        const allowGreeting = !userId || historyStatus === 'empty'
        if (activeGang.length > 0 && messages.length === 0 && !initialGreetingRef.current && allowGreeting) {
            triggerLocalGreeting()
        }
    }, [activeGang.length, historyStatus, messages.length, userId])

    useEffect(() => {
        if (isHydrated && messages.length > 0 && !resumeBannerRef.current) {
            const lastMessage = messages[messages.length - 1]
            const lastTime = lastMessage ? new Date(lastMessage.created_at).getTime() : 0
            const sessionStart = sessionRef.current?.startedAt ?? Date.now()
            const gapMs = lastTime ? Date.now() - lastTime : 0
            const hasUserMessages = messages.some((m) => m.speaker === 'user')
            const fromPreviousSession = lastTime > 0 && lastTime < sessionStart - 2 * 60 * 1000

            if (!hasUserMessages && !fromPreviousSession) {
                return
            }

            if (gapMs < 10 * 60 * 1000 && !fromPreviousSession) {
                return
            }

            resumeBannerRef.current = true
            if (gapMs > 6 * 60 * 60 * 1000) {
                const hours = Math.floor(gapMs / (1000 * 60 * 60))
                const days = Math.floor(hours / 24)
                const label = days > 0 ? `${days} day${days === 1 ? '' : 's'}` : `${hours} hour${hours === 1 ? '' : 's'}`
                setResumeBannerText(`Welcome back. It has been ${label}.`)
            } else {
                setResumeBannerText('Resumed your last session')
            }
            setShowResumeBanner(true)
            const timer = setTimeout(() => setShowResumeBanner(false), 4000)
            return () => clearTimeout(timer)
        }
    }, [isHydrated, messages])

    useEffect(() => {
        if (!toastMessage) return
        const timer = setTimeout(() => setToastMessage(null), 4000)
        return () => clearTimeout(timer)
    }, [toastMessage])

    useEffect(() => {
        if (showAuthWall && !isGuest) {
            setShowAuthWall(false)
            trackEvent('auth_wall_conversion', { metadata: { source: 'chat' } })
            const pending = pendingBlockedMessageRef.current
            pendingBlockedMessageRef.current = null
            if (pending) {
                handleSend(pending.content, { replyToId: pending.replyToId, reaction: pending.reaction })
            }
        }
    }, [isGuest, showAuthWall])

    const enqueueUserMessage = (content: string, options?: { replyToId?: string; reaction?: string }) => {
        const trimmed = content.trim()
        if (!trimmed) return false

        if (isGuest && !messages.some(m => m.speaker === 'user')) {
            pendingBlockedMessageRef.current = { content: trimmed, replyToId: options?.replyToId, reaction: options?.reaction }
            setShowAuthWall(true)
            if (messages.length === 0 && !initialGreetingRef.current) {
                triggerLocalGreeting()
            }
            return false
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            speaker: 'user',
            content: trimmed,
            created_at: new Date().toISOString(),
            replyToId: options?.replyToId,
            reaction: options?.reaction
        }
        addMessage(userMsg)
        lastUserMessageIdRef.current = userMsg.id
        pendingUserMessageIdRef.current = userMsg.id
        idleAutoCountRef.current = 0
        clearIdleAutonomousTimer()
        triggerReadingStatuses()
        silentTurnsRef.current = 0 // Reset silence on user input
        burstCountRef.current = 0 // Reset burst on user input
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

    const sendToApi = async ({ isIntro, isAutonomous, autonomousIdle = false, sourceUserMessageId }: { isIntro: boolean; isAutonomous: boolean; autonomousIdle?: boolean; sourceUserMessageId?: string | null }) => {
        // If autonomous call, check the brakes
        if (isAutonomous) {
            if (silentTurnsRef.current >= 30) {
                console.log("Autonomous flow stopped: 30 message limit reached.")
                isGeneratingRef.current = false
                return
            }
            if (burstCountRef.current >= 3) {
                console.log("Autonomous flow stopped: 3-burst limit reached.")
                isGeneratingRef.current = false
                return
            }
        }

        isGeneratingRef.current = true

        if (isAutonomous && chatMode === 'ecosystem') {
            triggerActivityPulse()
        }

        try {
            const currentMessages = useChatStore.getState().messages
            const sourceUserMessage = sourceUserMessageId
                ? currentMessages.find((m) => m.id === sourceUserMessageId && m.speaker === 'user')
                : null
            const openFloorIntent = !!sourceUserMessage?.content && hasOpenFloorIntent(sourceUserMessage.content)

            const payloadMessages = currentMessages.slice(-24).map((m) => ({
                id: m.id,
                speaker: m.speaker,
                content: m.content,
                created_at: m.created_at,
                reaction: m.reaction,
                replyToId: m.replyToId
            }))
            const mockAi = typeof window !== 'undefined' && (window.localStorage.getItem('mock_ai') === 'true' || process.env.NEXT_PUBLIC_MOCK_AI === 'true')
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(mockAi ? { 'x-mock-ai': 'true' } : {})
                },
                body: JSON.stringify({
                    messages: payloadMessages,
                    activeGangIds: activeGang.map(c => c.id),
                    userName,
                    userNickname,
                    isFirstMessage: currentMessages.length === 0 && isIntro,
                    silentTurns: silentTurnsRef.current,
                    burstCount: burstCountRef.current,
                    chatMode, // Passing the current mode
                    autonomousIdle
                })
            })

            let data: ChatApiResponse | null = null
            try {
                data = await res.json()
            } catch (err) {
                console.error('Failed to parse response:', err)
            }

            if (!res.ok) {
                setToastMessage(data?.events?.[0]?.content || "The gang portal is glitching. Try again.")
                if (!data?.events) {
                    addMessage({
                        id: `ai-error-${Date.now()}`,
                        speaker: 'system',
                        content: "The gang portal is glitching. Try again.",
                        created_at: new Date().toISOString()
                    })
                } else {
                    data.events.forEach((event) => {
                        if (event.type === 'message') {
                            addMessage({
                                id: `ai-error-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                speaker: event.character,
                                content: event.content || "The gang portal is glitching. Try again.",
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

            clearTypingUsers()

            // == THE SEQUENCER (SECRET SAUCE 3.0) ==
            for (const event of data.events) {
                // Interruption check: If user sent a new message while we were sequencing, STOP.
                if (pendingUserMessagesRef.current) {
                    console.log("AI Sequencing interrupted by new user message.")
                    break
                }

                await new Promise(r => setTimeout(r, event.delay))

                // Re-check interruption after delay
                if (pendingUserMessagesRef.current) break

                switch (event.type) {
                    case 'message': {
                        setCharacterStatus(event.character, "")
                        queueTypingUser(event.character)
                        const eventContent = event.content || ''
                        const speedFactor = activeGang.find(c => c.id === event.character)?.typingSpeed || 1
                        const typingTime = Math.max(900, eventContent.length * 30 * speedFactor + Math.random() * 500)
                        await new Promise(r => setTimeout(r, typingTime))

                        // Final interruption check before committing message
                        if (pendingUserMessagesRef.current) break

                        addMessage({
                            id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
                            id: `ai-react-${Date.now()}`,
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
            const burstLimit = chatMode === 'entourage' ? 1 : 2
            if (data.should_continue && burstCountRef.current < (burstLimit - 1) && !pendingUserMessagesRef.current) {
                burstCountRef.current++
                await new Promise(r => setTimeout(r, 1000))
                isGeneratingRef.current = false // Prep for next call
                const sourceId = sourceUserMessageId || lastUserMessageIdRef.current
                sendToApi({ isIntro: false, isAutonomous: true, sourceUserMessageId: sourceId })
                return
            }

            if (!data.should_continue && !isAutonomous && chatMode === 'ecosystem' && openFloorIntent && !pendingUserMessagesRef.current && burstCountRef.current < 1) {
                burstCountRef.current += 1
                await new Promise((r) => setTimeout(r, 900))
                isGeneratingRef.current = false
                const sourceId = sourceUserMessageId || lastUserMessageIdRef.current
                sendToApi({ isIntro: false, isAutonomous: true, sourceUserMessageId: sourceId })
                return
            }

        } catch (err) {
            console.error('Chat API Error:', err)
            setToastMessage('Network hiccup. Try again in a moment.')
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
                if (!isIntro && !pendingUserMessagesRef.current) {
                    const sourceId = sourceUserMessageId || lastUserMessageIdRef.current
                    if (sourceId && (autonomousIdle || !isAutonomous)) {
                        scheduleIdleAutonomous(sourceId)
                    }
                }
            }
        }
    }

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

    const handleSend = async (content: string, options?: { replyToId?: string; reaction?: string }) => {
        if (!isOnline) {
            setToastMessage('You are offline. Reconnect and try again.')
            return
        }
        const isIntro = content.trim() === "" && messages.length === 0
        const isAutonomous = content.trim() === "" && messages.length > 0

        // 1. NON-BLOCKING INPUT: Add message to UI immediately
        if (!isIntro && !isAutonomous && content.trim()) {
            const sent = enqueueUserMessage(content, options)
            if (sent) setReplyingTo(null)
            return
        } else if (!isIntro && !isAutonomous && !content.trim()) {
            return
        }

        await sendToApi({ isIntro, isAutonomous })
    }

    const takeScreenshot = async () => {
        if (captureRootRef.current === null) return

        const waitForFrame = () => new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve())
        })

        try {
            setIsSettingsOpen(false)
            setIsVaultOpen(false)
            await waitForFrame()
            await waitForFrame()
            await new Promise((resolve) => setTimeout(resolve, 120))
            if (typeof document !== 'undefined' && 'fonts' in document) {
                await document.fonts.ready
            }

            const dataUrl = await toPng(captureRootRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: theme === 'dark' ? '#0b0f17' : '#eff3f8',
                filter: (node) => {
                    if (!(node instanceof HTMLElement)) return true
                    return node.dataset.screenshotExclude !== 'true'
                },
            })
            const link = document.createElement('a')
            link.download = `mygang-moment-${Date.now()}.png`
            link.href = dataUrl
            link.click()
            setToastMessage('Moment captured.')
        } catch (err) {
            console.error('Screenshot failed:', err)
            setToastMessage('Could not capture this moment. Try again.')
        }
    }

    const handleQuickLike = (target: Message) => {
        if (!isOnline) {
            setToastMessage('You are offline. Reconnect and try again.')
            return
        }
        const sent = enqueueUserMessage('\u2764\uFE0F', { replyToId: target.id, reaction: '\u2764\uFE0F' })
        if (sent) setReplyingTo(null)
    }

    const loadOlderHistory = async () => {
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
                setMessages([...older, ...currentMessages])
            }
            setHistoryCursor(page.nextBefore)
            setHasMoreHistory(page.hasMore && appendedCount > 0)
        } catch (err) {
            console.error('Failed to load older history:', err)
            setToastMessage('Could not load older messages right now.')
        } finally {
            setIsLoadingOlderHistory(false)
        }
    }

    return (
        <main className="flex flex-col h-dvh bg-background text-foreground overflow-hidden relative isolate">
            <BackgroundBlobs isMuted={typingUsers.length > 0} className="absolute inset-0 z-0 overflow-hidden pointer-events-none" />
            <div className="chat-wallpaper-layer" data-wallpaper={chatWallpaper} aria-hidden="true" />

            <div ref={captureRootRef} className="flex-1 flex flex-col w-full relative min-h-0 z-10">
                <ChatHeader
                    activeGang={activeGang}
                    onOpenVault={() => {
                        setIsVaultOpen(true)
                    }}
                    onOpenSettings={() => {
                        setIsSettingsOpen(true)
                    }}
                    typingCount={typingUsers.length}
                    memoryActive={!isGuest}
                />

                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="px-4 md:px-10 lg:px-14">
                        {showResumeBanner && (
                            <div className="mb-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                                {resumeBannerText}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-h-0 flex flex-col">
                        <ErrorBoundary>
                            <MessageList
                                messages={messages}
                                activeGang={activeGang}
                                typingUsers={typingUsers}
                                isFastMode={isFastMode}
                                hasMoreHistory={hasMoreHistory}
                                loadingHistory={isLoadingOlderHistory}
                                onLoadOlderHistory={loadOlderHistory}
                                onReplyMessage={(message) => setReplyingTo(message)}
                                onLikeMessage={handleQuickLike}
                            />
                        </ErrorBoundary>
                    </div>
                </div>

                <div className="shrink-0 border-t border-border/70 bg-card/95 dark:bg-[rgba(14,22,37,0.9)] backdrop-blur-xl px-0 pb-0 sm:border-t sm:bg-card/90 sm:dark:bg-[rgba(14,22,37,0.86)] sm:backdrop-blur-xl sm:px-10 lg:px-14 sm:pb-3">
                    {!isOnline && (
                        <div className="mx-3 sm:mx-0 mb-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[10px] uppercase tracking-widest text-amber-200">
                            Offline mode - reconnect to send messages
                        </div>
                    )}
                    <ChatInput
                        onSend={handleSend}
                        disabled={!isOnline}
                        online={isOnline}
                        replyingTo={replyingTo ? {
                            id: replyingTo.id,
                            speaker: replyingTo.speaker === 'user'
                                ? 'user'
                                : (activeGang.find((c) => c.id === replyingTo.speaker)?.name || replyingTo.speaker),
                            content: replyingTo.content
                        } : null}
                        onCancelReply={() => setReplyingTo(null)}
                    />
                </div>
            </div>

            <InlineToast message={toastMessage} onClose={() => setToastMessage(null)} />

            {/* Overlays (Outside main layout to prevent blocking) */}
            <AuthWall
                isOpen={showAuthWall}
                onClose={() => setShowAuthWall(false)}
                onSuccess={() => {
                    setIsGuest(false)
                    setShowAuthWall(false)
                }}
            />
            <MemoryVault isOpen={isVaultOpen} onClose={() => setIsVaultOpen(false)} />
            <ChatSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onTakeScreenshot={takeScreenshot}
            />
            <SquadReconcile
                conflict={squadConflict}
                onResolve={() => setSquadConflict(null)}
            />
        </main>
    )
}

