'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Character, Message, useChatStore } from '@/stores/chat-store'
import { MessageItem } from './message-item'
import { TypingIndicator } from '@/components/chat/typing-indicator'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVirtualizer } from '@tanstack/react-virtual'

interface MessageListProps {
    messages: Message[]
    activeGang: Character[]
    typingUsers: string[]
    isFastMode?: boolean
}

export function MessageList({ messages, activeGang, typingUsers, isFastMode = false }: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)
    const prevMessagesLength = useRef(messages.length)
    const characterStatuses = useChatStore((state) => state.characterStatuses)
    const hasTyping = typingUsers.length > 0
    const itemCount = messages.length + (hasTyping ? 1 : 0)

    const rowVirtualizer = useVirtualizer({
        count: itemCount,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 120,
        overscan: 8,
        measureElement: (el) => el.getBoundingClientRect().height,
    })

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
            if (isAtBottom) {
                rowVirtualizer.scrollToIndex(Math.max(0, itemCount - 1), { align: 'end' })
            } else {
                setUnreadCount(prev => prev + (messages.length - prevMessagesLength.current))
            }
        }

        prevMessagesLength.current = messages.length
    }, [messages, isAtBottom, itemCount, rowVirtualizer])

    const scrollToBottom = () => {
        if (scrollRef.current) {
            rowVirtualizer.scrollToIndex(Math.max(0, itemCount - 1), { align: 'end' })
            setUnreadCount(0)
            setIsAtBottom(true)
        }
    }

    return (
        <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 scrollbar-hide"
                style={{ paddingBottom: 80 }}
                data-testid="chat-scroll"
            >
                {!isAtBottom && (
                    <div className="sticky top-2 z-10 flex justify-center px-4">
                        <Button
                            onClick={scrollToBottom}
                            variant="ghost"
                            className="rounded-full bg-white/10 border border-white/10 text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground px-3 sm:px-4 py-1.5 sm:py-2"
                        >
                            <span className="sm:hidden">Jump to latest</span>
                            <span className="hidden sm:inline">You are reading older messages - Jump to latest</span>
                        </Button>
                    </div>
                )}
                <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const index = virtualRow.index
                        const isTypingRow = hasTyping && index === messages.length
                        if (isTypingRow) {
                            return (
                                <div
                                    key="typing-row"
                                    ref={rowVirtualizer.measureElement}
                                    data-index={index}
                                    className="px-4"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <TypingIndicator typingUsers={typingUsers} activeGang={activeGang} />
                                </div>
                            )
                        }

                        const message = messages[index]
                        if (!message) return null
                        const character = activeGang.find(c => c.id.toLowerCase().trim() === message.speaker.toLowerCase().trim())
                        const isContinued = index > 0 && messages[index - 1].speaker === message.speaker
                        const status = characterStatuses[message.speaker]

                        return (
                            <div
                                key={message.id}
                                ref={rowVirtualizer.measureElement}
                                data-index={index}
                                className="px-4"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <MessageItem
                                    message={message}
                                    character={character}
                                    isContinued={isContinued}
                                    status={status}
                                    isFastMode={isFastMode}
                                />
                            </div>
                        )
                    })}
                </div>
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
