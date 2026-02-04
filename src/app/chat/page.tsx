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

interface ChatResponse {
    responses: {
        character: string
        text: string
        delay: number
    }[]
}

export default function ChatPage() {
    const {
        messages,
        activeGang,
        userName,
        userNickname,
        isGuest,
        addMessage,
        setIsGuest,
        clearChat,
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
    const silentTurnsRef = useRef(0)
    const burstCountRef = useRef(0)

    // Guard: Redirect if no squad is selected
    useEffect(() => {
        if (activeGang.length === 0) {
            router.push('/onboarding')
        }
    }, [activeGang, router])

    // Initial Greeting Trigger
    useEffect(() => {
        if (activeGang.length > 0 && messages.length === 0 && !initialGreetingRef.current && !isGenerating) {
            initialGreetingRef.current = true
            handleSend("") // Empty content triggers the intro logic in API
        }
    }, [activeGang, messages.length, isGenerating])

    const handleSend = async (content: string) => {
        const isIntro = content.trim() === "" && messages.length === 0
        const isAutonomous = content.trim() === "" && messages.length > 0

        // 1. NON-BLOCKING INPUT: Add message to UI immediately
        if (!isIntro && !isAutonomous && content.trim()) {
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

        // Trigger Auth Wall if guest tries to send their first reply
        if (isGuest && messages.some(m => m.speaker === 'user')) {
            setShowAuthWall(true)
            return
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
                    activeGang,
                    userName,
                    userNickname,
                    isFirstMessage: currentMessages.length === 0 && isIntro,
                    silentTurns: silentTurnsRef.current,
                    burstCount: burstCountRef.current,
                    chatMode // Passing the current mode
                })
            })

            if (!res.ok) throw new Error('Failed to fetch')

            const data: { events: any[], should_continue?: boolean } = await res.json()

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
                    case 'message':
                        setTypingUsers(prev => [...prev, event.character])
                        const typingTime = Math.max(1000, event.content.length * 30 + Math.random() * 500)
                        await new Promise(r => setTimeout(r, typingTime))

                        // Final interruption check before committing message
                        if (pendingUserMessagesRef.current) break

                        addMessage({
                            id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            speaker: event.character,
                            content: event.content,
                            created_at: new Date().toISOString(),
                            replyToId: event.target_message_id
                        })
                        if (isAutonomous || isIntro) silentTurnsRef.current++
                        setTypingUsers(prev => prev.filter(u => u !== event.character))
                        break

                    case 'reaction':
                        addMessage({
                            id: `ai-react-${Date.now()}`,
                            speaker: event.character,
                            content: event.content || '👍',
                            created_at: new Date().toISOString(),
                            reaction: event.content || '👍',
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
