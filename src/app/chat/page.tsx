'use client'

import { useState, useRef, useEffect } from 'react'
import { useChatStore, Message } from '@/stores/chat-store'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import dynamic from 'next/dynamic'
import { toPng } from 'html-to-image'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { ensureAnalyticsSession, trackEvent } from '@/lib/analytics'

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
        hasSeenChatTips,
        setHasSeenChatTips,
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
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const silentTurnsRef = useRef(0)
    const burstCountRef = useRef(0)
    const typingUsersRef = useRef<Set<string>>(new Set())
    const typingFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const fastModeRef = useRef({ lastAt: 0, streak: 0 })
    const fastModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        }
    }, [])

    // Initial Greeting Trigger
    useEffect(() => {
        if (isHydrated && activeGang.length > 0 && messages.length === 0 && !initialGreetingRef.current && !isGenerating) {
            initialGreetingRef.current = true
            handleSend("") // Empty content triggers the intro logic in API
        }
    }, [activeGang, messages.length, isGenerating, isHydrated])

    useEffect(() => {
        if (isHydrated && messages.length > 0 && !resumeBannerRef.current) {
            resumeBannerRef.current = true
            const lastMessage = messages[messages.length - 1]
            const lastTime = lastMessage ? new Date(lastMessage.created_at).getTime() : 0
            const gapMs = lastTime ? Date.now() - lastTime : 0
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

    const sendToApi = async ({ isIntro, isAutonomous }: { isIntro: boolean; isAutonomous: boolean }) => {
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

        // == IMMEDIATE REACTION (SQUAD ENERGY) ==
        const otherCharacters = activeGang.filter(c => c.id !== 'user')
        const reactionSquad = [...otherCharacters].sort(() => 0.5 - Math.random()).slice(0, Math.min(3, otherCharacters.length))

        const triggerImmediateTyping = async () => {
            for (const char of reactionSquad) {
                if (!isGeneratingRef.current) break
                queueTypingUser(char.id)
                await new Promise(r => setTimeout(r, 400 + Math.random() * 400))
            }
        }
        if (!isAutonomous) triggerImmediateTyping()

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
                    chatMode // Passing the current mode
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
                sendToApi({ isIntro: false, isAutonomous: false })
            } else {
                setIsGenerating(false)
                isGeneratingRef.current = false
                clearTypingUsers()
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
            sendToApi({ isIntro: false, isAutonomous: false })
        }, 600)
    }

    const handleSend = async (content: string) => {
        const isIntro = content.trim() === "" && messages.length === 0
        const isAutonomous = content.trim() === "" && messages.length > 0

        // 1. NON-BLOCKING INPUT: Add message to UI immediately
        if (!isIntro && !isAutonomous && content.trim()) {
            // Trigger Auth Wall before writing message to timeline
            if (isGuest && messages.some(m => m.speaker === 'user')) {
                pendingBlockedMessageRef.current = content
                setShowAuthWall(true)
                return
            }
            const userMsg: Message = {
                id: Date.now().toString(),
                speaker: 'user',
                content,
                created_at: new Date().toISOString()
            }
            addMessage(userMsg)
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
                        setHasSeenChatTips(true)
                    }}
                    onOpenSettings={() => {
                        setIsSettingsOpen(true)
                        setHasSeenChatTips(true)
                    }}
                    typingCount={typingUsers.length}
                    memoryActive={!isGuest}
                />

                <div className="flex-1 flex flex-col min-h-0 relative px-4 md:px-10 lg:px-20" ref={chatContainerRef}>
                    {showResumeBanner && (
                        <div className="mb-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                            {resumeBannerText}
                        </div>
                    )}
                    {!hasSeenChatTips && (
                        <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-muted-foreground flex flex-col gap-2">
                            <div className="font-semibold text-foreground">Quick tip</div>
                            <div>Memory Vault keeps your long-term context. Settings lets you switch modes and squad.</div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    className="text-[10px] uppercase tracking-widest rounded-full border border-white/10 px-3 py-1 hover:bg-white/10"
                                    onClick={() => {
                                        setIsVaultOpen(true)
                                        setHasSeenChatTips(true)
                                    }}
                                >
                                    Open Vault
                                </button>
                                <button
                                    className="text-[10px] uppercase tracking-widest rounded-full border border-white/10 px-3 py-1 hover:bg-white/10"
                                    onClick={() => {
                                        setIsSettingsOpen(true)
                                        setHasSeenChatTips(true)
                                    }}
                                >
                                    Open Settings
                                </button>
                                <button
                                    className="text-[10px] uppercase tracking-widest rounded-full border border-white/10 px-3 py-1 hover:bg-white/10"
                                    onClick={() => setHasSeenChatTips(true)}
                                >
                                    Got it
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="flex-1 min-h-0">
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
