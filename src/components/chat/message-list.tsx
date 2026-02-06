'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Character, Message, useChatStore } from '@/stores/chat-store'
import { MessageItem } from './message-item'
import { TypingIndicator } from '@/components/chat/typing-indicator'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MessageListProps {
    messages: Message[]
    activeGang: Character[]
    typingUsers: string[]
}

export function MessageList({ messages, activeGang, typingUsers }: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)
    const prevMessagesLength = useRef(messages.length)
    const characterStatuses = useChatStore((state) => state.characterStatuses)

    // Handle scroll events
    const handleScroll = () => {
        if (!scrollRef.current) return
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
        const atBottom = scrollHeight - scrollTop - clientHeight < 100
        setIsAtBottom(atBottom)
        if (atBottom) {
            setUnreadCount(0)
        }
    }

    // Auto-scroll logic
    useEffect(() => {
        if (!scrollRef.current) return

        const isNewMessage = messages.length > prevMessagesLength.current

        if (isNewMessage) {
            // Haptic Feedback for Mobile
            // Haptic feedback removed for web-only experience

            if (isAtBottom) {
                scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: 'smooth'
                })
            } else {
                setUnreadCount(prev => prev + (messages.length - prevMessagesLength.current))
            }
        }

        prevMessagesLength.current = messages.length
    }, [messages, isAtBottom])

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            })
            setUnreadCount(0)
            setIsAtBottom(true)
        }
    }

    return (
        <div className="relative flex-1 min-h-0 overflow-hidden">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="h-full min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-2 scrollbar-hide"
            >
                {!isAtBottom && (
                    <div className="sticky top-2 z-10 flex justify-center">
                        <Button
                            onClick={scrollToBottom}
                            variant="ghost"
                            className="rounded-full bg-white/10 border border-white/10 text-[10px] uppercase tracking-widest text-muted-foreground px-4 py-2"
                        >
                            You are reading older messages - Jump to latest
                        </Button>
                    </div>
                )}
                <AnimatePresence initial={false}>
                    {messages.map((message, index) => {
                        const character = activeGang.find(c => c.id.toLowerCase().trim() === message.speaker.toLowerCase().trim())
                        const isContinued = index > 0 && messages[index - 1].speaker === message.speaker
                        const status = characterStatuses[message.speaker]

                        return (
                            <MessageItem
                                key={message.id}
                                message={message}
                                character={character}
                                isContinued={isContinued}
                                status={status}
                            />
                        )
                    })}
                </AnimatePresence>

                {typingUsers.length > 0 && (
                    <TypingIndicator typingUsers={typingUsers} activeGang={activeGang} />
                )
                }
                <div className="h-20" /> {/* Spacer for input area */}
            </div>

            {/* New Message Indicator */}
            <AnimatePresence>
                {!isAtBottom && unreadCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute bottom-24 right-6 z-50"
                    >
                        <Button
                            onClick={scrollToBottom}
                            className="rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-white px-4 py-6 flex items-center gap-2 border border-white/20 backdrop-blur-xl"
                        >
                            <span className="bg-white text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold leading-none">
                                {unreadCount}
                            </span>
                            <span className="font-bold text-sm tracking-tight uppercase">New Messages</span>
                            <ChevronDown className="w-5 h-5 animate-bounce-short" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
