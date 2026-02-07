'use client'

import { useState, useRef, useEffect } from 'react'
import { useChatStore, Message } from '@/stores/chat-store'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import dynamic from 'next/dynamic'
import { toPng } from 'html-to-image'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'
import { ACTIVITY_STATUSES, CHARACTER_GREETINGS, CHARACTER_STATUS_REACTIONS } from '@/constants/character-greetings'

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

export default function ChatPage() {
    const {
        messages,
        activeGang,
        userName,
        userNickname,
        isGuest,
        isHydrated,
        addMessage,
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
    const [isGenerating, setIsGenerating] = useState(false)
    const [showResumeBanner, setShowResumeBanner] = useState(false)
    const [resumeBannerText, setResumeBannerText] = useState('Resumed your last session')
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [isFastMode, setIsFastMode] = useState(false)

    const chatContainerRef = useRef<HTMLDivElement>(null)
    const { theme } = useTheme()
    const router = useRouter()
    const initialGreetingRef = useRef(false)
    const resumeBannerRef = useRef(false)
    const sessionRef = useRef<{ id: string; startedAt: number } | null>(null)
    const firstMessageLoggedRef = useRef(false)

    const isGeneratingRef = useRef(false)
    const pendingUserMessagesRef = useRef(false)
    const pendingBlockedMessageRef = useRef<string | null>(null)
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
    const lastUserMessageIdRef = useRef<string | null>(null)
    const lastUserActivityRef = useRef<number>(Date.now())

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
            router.push('/onboarding')
        }
    }, [activeGang, isHydrated, router])

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
        const markActive = () => {
            lastUserActivityRef.current = Date.now()
            if (idleAutonomousTimerRef.current) {
                clearTimeout(idleAutonomousTimerRef.current)
                idleAutonomousTimerRef.current = null
            }
        }
        const events = ['mousemove', 'keydown', 'scroll', 'touchstart']
        events.forEach((event) => window.addEventListener(event, markActive, { passive: true }))
        document.addEventListener('visibilitychange', markActive)
        return () => {
            events.forEach((event) => window.removeEventListener(event, markActive))
            document.removeEventListener('visibilitychange', markActive)
        }
    }, [])

    const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

    const scheduleGreeting = (fn: () => void, delay: number) => {
        const timer = setTimeout(fn, delay)
        greetingTimersRef.current.push(timer)
    }

    const pickStatusFor = (characterId: string) => {
        const pool = CHARACTER_STATUS_REACTIONS[characterId] || ACTIVITY_STATUSES
        return pickRandom(pool)
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
            if (document.hasFocus && !document.hasFocus()) return false
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false
        return true
    }

    const scheduleIdleAutonomous = (sourceUserMessageId: string | null) => {
        if (!sourceUserMessageId) return
        if (!canRunIdleAutonomous()) return
        if (idleAutoCountRef.current >= 3) return

        clearIdleAutonomousTimer()
        const delay = 15000 + idleAutoCountRef.current * 7000
        idleAutonomousTimerRef.current = setTimeout(() => {
            const stillIdle = Date.now() - lastUserActivityRef.current >= delay
            const currentMessages = useChatStore.getState().messages
            const lastMessage = currentMessages[currentMessages.length - 1]
            const stillSameUserMessage = lastUserMessageIdRef.current === sourceUserMessageId
            if (!stillIdle || !stillSameUserMessage) return
            if (!canRunIdleAutonomous()) return
            if (!lastMessage || lastMessage.speaker === 'user') return
            if (isGeneratingRef.current) return

            idleAutoCountRef.current += 1
            sendToApi({ isIntro: false, isAutonomous: true, autonomousIdle: true })
        }, delay)
    }

    // Initial Greeting Trigger
    useEffect(() => {
        if (activeGang.length > 0 && messages.length === 0 && !initialGreetingRef.current) {
            triggerLocalGreeting()
        }
    }, [activeGang.length, messages.length])

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
                handleSend(pending)
            }
        }
    }, [isGuest, showAuthWall])

    const sendToApi = async ({ isIntro, isAutonomous, autonomousIdle = false, sourceUserMessageId }: { isIntro: boolean; isAutonomous: boolean; autonomousIdle?: boolean; sourceUserMessageId?: string | null }) => {
        // If autonomous call, check the brakes
        if (isAutonomous) {
            if (silentTurnsRef.current >= 30) {
                console.log("Autonomous flow stopped: 30 message limit reached.")
                setIsGenerating(false)
                isGeneratingRef.current = false
                return
            }
            if (burstCountRef.current >= 3) {
                console.log("Autonomous flow stopped: 3-burst limit reached.")
                setIsGenerating(false)
                isGeneratingRef.current = false
                return
            }
        }

        setIsGenerating(true)
        isGeneratingRef.current = true

        if (isAutonomous) {
            triggerActivityPulse()
        }

        try {
            const currentMessages = useChatStore.getState().messages

            const payloadMessages = currentMessages.slice(-40).map((m) => ({
                id: m.id,
                speaker: m.speaker,
                content: m.content,
                created_at: m.created_at,
                reaction: m.reaction
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

            let data: { events: any[], should_continue?: boolean } | null = null
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
                        setCharacterStatus(event.character, event.content || "")
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
            const burstLimit = chatMode === 'entourage' ? 1 : 3
            if (data.should_continue && burstCountRef.current < (burstLimit - 1) && !pendingUserMessagesRef.current) {
                burstCountRef.current++
                await new Promise(r => setTimeout(r, 1000))
                isGeneratingRef.current = false // Prep for next call
                sendToApi({ isIntro: false, isAutonomous: true })
                return
            }

        } catch (err) {
            console.error('Chat API Error:', err)
            setToastMessage('Network hiccup. Try again in a moment.')
        } finally {
            if (pendingUserMessagesRef.current) {
                pendingUserMessagesRef.current = false
                isGeneratingRef.current = false
                sendToApi({ isIntro: false, isAutonomous: false, sourceUserMessageId: pendingUserMessageIdRef.current })
            } else {
                setIsGenerating(false)
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

    const handleSend = async (content: string) => {
        const isIntro = content.trim() === "" && messages.length === 0
        const isAutonomous = content.trim() === "" && messages.length > 0

        // 1. NON-BLOCKING INPUT: Add message to UI immediately
        if (!isIntro && !isAutonomous && content.trim()) {
            // Trigger Auth Wall before writing message to timeline
            if (isGuest && !messages.some(m => m.speaker === 'user')) {
                pendingBlockedMessageRef.current = content
                setShowAuthWall(true)
                if (messages.length === 0 && !initialGreetingRef.current) {
                    triggerLocalGreeting()
                }
                return
            }
            const userMsg: Message = {
                id: Date.now().toString(),
                speaker: 'user',
                content,
                created_at: new Date().toISOString()
            }
            addMessage(userMsg)
            lastUserMessageIdRef.current = userMsg.id
            pendingUserMessageIdRef.current = userMsg.id
            idleAutoCountRef.current = 0
            clearIdleAutonomousTimer()
            lastUserActivityRef.current = Date.now()
            triggerReadingStatuses()
            silentTurnsRef.current = 0 // Reset silence on user input
            burstCountRef.current = 0 // Reset burst on user input
            bumpFastMode()

            const session = sessionRef.current || ensureAnalyticsSession()
            sessionRef.current = { id: session.id, startedAt: session.startedAt }
            trackEvent('message_sent', {
                sessionId: session.id,
                metadata: { length: content.length }
            })
            if (!firstMessageLoggedRef.current) {
                firstMessageLoggedRef.current = true
                const elapsedMs = Date.now() - session.startedAt
                trackEvent('time_to_first_message', {
                    sessionId: session.id,
                    value: Math.max(1, Math.round(elapsedMs / 1000))
                })
            }

            // If already generating, queue it and return
            if (isGeneratingRef.current) {
                pendingUserMessagesRef.current = true
                return
            }

            scheduleDebouncedSend()
            return
        } else if (!isIntro && !isAutonomous && !content.trim()) {
            return
        }

        await sendToApi({ isIntro, isAutonomous })
    }

    const takeScreenshot = async () => {
        if (chatContainerRef.current === null) return
        try {
            const dataUrl = await toPng(chatContainerRef.current, {
                cacheBust: true,
                backgroundColor: theme === 'dark' ? '#050505' : '#F0F4F8'
            })
            const link = document.createElement('a')
            link.download = `mygang-moment-${Date.now()}.png`
            link.href = dataUrl
            link.click()
        } catch (err) {
            console.error('Screenshot failed:', err)
        }
    }

    return (
        <main className="flex flex-col h-dvh bg-background text-foreground overflow-hidden relative">
            <BackgroundBlobs isMuted={typingUsers.length > 0} />
            <div className="chat-wallpaper-layer" data-wallpaper={chatWallpaper} aria-hidden="true" />

            <div className="flex-1 flex flex-col w-full relative min-h-0">
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

                <div className="flex-1 flex flex-col min-h-0 relative" ref={chatContainerRef}>
                    <div className="px-4 md:px-10 lg:px-20">
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
                            />
                        </ErrorBoundary>
                    </div>
                </div>

                <div className="px-4 md:px-10 lg:px-20 pb-4 shrink-0">
                    <ChatInput
                        onSend={handleSend}
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
