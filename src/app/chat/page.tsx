'use client'

import { useState, useRef, useEffect } from 'react'
import { useChatStore, Message } from '@/stores/chat-store'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { AuthWall } from '@/components/orchestrator/auth-wall'
import { toPng } from 'html-to-image'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'

// New modular components
import { ChatHeader } from '@/components/chat/chat-header'
import { MessageList } from '@/components/chat/message-list'
import { MemoryVault } from '@/components/chat/memory-vault'
import { ChatSettings } from '@/components/chat/chat-settings'
import { ChatInput } from '@/components/chat/chat-input'
import { ErrorBoundary } from '@/components/orchestrator/error-boundary'

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
        chatMode
    } = useChatStore()
    const [typingUsers, setTypingUsers] = useState<string[]>([])
    const [showAuthWall, setShowAuthWall] = useState(false)
    const [isVaultOpen, setIsVaultOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    const chatContainerRef = useRef<HTMLDivElement>(null)
    const { theme } = useTheme()
    const router = useRouter()
    const initialGreetingRef = useRef(false)

    const isGeneratingRef = useRef(false)
    const pendingUserMessagesRef = useRef(false)
    const pendingBlockedMessageRef = useRef<string | null>(null)
    const silentTurnsRef = useRef(0)
    const burstCountRef = useRef(0)

    // Guard: Redirect if no squad is selected
    useEffect(() => {
        if (isHydrated && activeGang.length === 0) {
            router.push('/onboarding')
        }
    }, [activeGang, isHydrated, router])

    // Initial Greeting Trigger
    useEffect(() => {
        if (isHydrated && activeGang.length > 0 && messages.length === 0 && !initialGreetingRef.current && !isGenerating) {
            initialGreetingRef.current = true
            handleSend("") // Empty content triggers the intro logic in API
        }
    }, [activeGang, messages.length, isGenerating, isHydrated])

    useEffect(() => {
        if (showAuthWall && !isGuest) {
            setShowAuthWall(false)
            const pending = pendingBlockedMessageRef.current
            pendingBlockedMessageRef.current = null
            if (pending) {
                handleSend(pending)
            }
        }
    }, [isGuest, showAuthWall])

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

            // If already generating, queue it and return
            if (isGeneratingRef.current) {
                pendingUserMessagesRef.current = true
                return
            }
        } else if (!isIntro && !isAutonomous && !content.trim()) {
            return
        }

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
                setTypingUsers(prev => [...new Set([...prev, char.id])])
                await new Promise(r => setTimeout(r, 400 + Math.random() * 400))
            }
        }
        if (!isAutonomous) triggerImmediateTyping()

        try {
            const currentMessages = useChatStore.getState().messages

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages,
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

            setTypingUsers([])

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
                        setTypingUsers(prev => [...prev, event.character])
                        const eventContent = event.content || ''
                        const typingTime = Math.max(1000, eventContent.length * 30 + Math.random() * 500)
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
                        setTypingUsers(prev => prev.filter(u => u !== event.character))
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
                        setTypingUsers(prev => [...prev, event.character])
                        await new Promise(r => setTimeout(r, 2500))
                        setTypingUsers(prev => prev.filter(u => u !== event.character))
                        break
                }
            }

            // == AUTONOMOUS CONTINUATION CHECK ==
            const burstLimit = chatMode === 'entourage' ? 1 : 3
            if (data.should_continue && burstCountRef.current < (burstLimit - 1) && !pendingUserMessagesRef.current) {
                burstCountRef.current++
                await new Promise(r => setTimeout(r, 1000))
                isGeneratingRef.current = false // Prep for next call
                handleSend("")
                return
            }

        } catch (err) {
            console.error('Chat API Error:', err)
        } finally {
            if (pendingUserMessagesRef.current) {
                pendingUserMessagesRef.current = false
                isGeneratingRef.current = false
                handleSend("")
            } else {
                setIsGenerating(false)
                isGeneratingRef.current = false
                setTypingUsers([])
            }
        }
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
            <BackgroundBlobs />

            <div className="flex-1 flex flex-col w-full relative">
                <ChatHeader
                    activeGang={activeGang}
                    onOpenVault={() => setIsVaultOpen(true)}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />

                <div className="flex-1 flex flex-col min-h-0 relative px-4 md:px-10 lg:px-20" ref={chatContainerRef}>
                    <ErrorBoundary>
                        <MessageList
                            messages={messages}
                            activeGang={activeGang}
                            typingUsers={typingUsers}
                        />
                    </ErrorBoundary>
                </div>

                <div className="px-4 md:px-10 lg:px-20 pb-4">
                    <ChatInput
                        onSend={handleSend}
                    />
                </div>
            </div>

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
        </main>
    )
}
