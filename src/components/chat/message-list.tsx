'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Character, Message, useChatStore } from '@/stores/chat-store'
import { MessageItem } from './message-item'
import { TypingIndicator } from '@/components/chat/typing-indicator'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVirtualizer } from '@tanstack/react-virtual'

interface MessageListProps {
    messages: Message[]
    activeGang: Character[]
    typingUsers: string[]
    isFastMode?: boolean
    onReplyMessage?: (message: Message) => void
    onLikeMessage?: (message: Message) => void
}

function normalizeSpeaker(value: string) {
    return value.toLowerCase().trim()
}

export function MessageList({
    messages,
    activeGang,
    typingUsers,
    isFastMode = false,
    onReplyMessage,
    onLikeMessage
}: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollRafRef = useRef<number | null>(null)
    const didInitialScrollRef = useRef(false)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const prevMessagesLength = useRef(messages.length)
    const characterStatuses = useChatStore((state) => state.characterStatuses)
    const isGuest = useChatStore((state) => state.isGuest)
    const showPersonaRoles = useChatStore((state) => state.showPersonaRoles)
    const hasTyping = typingUsers.length > 0
    const hasActivity = Object.values(characterStatuses).some(Boolean)
    const hasStatusRow = hasTyping || hasActivity
    const itemCount = messages.length + (hasStatusRow ? 1 : 0)
    const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
    const characterBySpeaker = useMemo(
        () => new Map(activeGang.map((character) => [normalizeSpeaker(character.id), character])),
        [activeGang]
    )
    const seenByMessageId = useMemo(() => {
        const seenMap = new Map<string, string[]>()
        for (let i = 0; i < messages.length; i++) {
            const current = messages[i]
            if (current.speaker !== 'user') continue
            const seenNames: string[] = []
            const seenSpeakerIds = new Set<string>()
            for (let j = i + 1; j < messages.length && seenNames.length < 2; j++) {
                const next = messages[j]
                if (next.speaker === 'user') continue
                const normalized = normalizeSpeaker(next.speaker)
                if (seenSpeakerIds.has(normalized)) continue
                seenSpeakerIds.add(normalized)
                const name = characterBySpeaker.get(normalized)?.name
                if (name) seenNames.push(name)
            }
            seenMap.set(current.id, seenNames)
        }
        return seenMap
    }, [messages, characterBySpeaker])

    const rowVirtualizer = useVirtualizer({
        count: itemCount,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 120,
        overscan: 8,
        measureElement: (el) => el.getBoundingClientRect().height,
    })

    const scrollToBottom = useCallback(() => {
        if (!scrollRef.current) return
        rowVirtualizer.scrollToIndex(Math.max(0, itemCount - 1), { align: 'end' })
        setIsAtBottom(true)
    }, [itemCount, rowVirtualizer])

    // Handle scroll events
    const handleScroll = () => {
        if (scrollRafRef.current !== null) return
        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = null
            if (!scrollRef.current) return
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
            const atBottom = scrollHeight - scrollTop - clientHeight < 48
            setIsAtBottom(atBottom)
        })
    }

    // Auto-scroll logic
    useEffect(() => {
        return () => {
            if (scrollRafRef.current !== null) {
                window.cancelAnimationFrame(scrollRafRef.current)
            }
        }
    }, [])

    // Initial load should always show latest message.
    useEffect(() => {
        if (didInitialScrollRef.current) return
        if (itemCount === 0) return
        didInitialScrollRef.current = true
        requestAnimationFrame(() => {
            scrollToBottom()
        })
    }, [itemCount, scrollToBottom])

    useEffect(() => {
        if (!scrollRef.current) return

        const previousLength = prevMessagesLength.current
        const isNewMessage = messages.length > previousLength

        if (isNewMessage) {
            const appendedMessages = messages.slice(previousLength)
            const hasUserMessage = appendedMessages.some((m) => m.speaker === 'user')

            if (isAtBottom || hasUserMessage) {
                scrollToBottom()
            }
        }

        prevMessagesLength.current = messages.length
    }, [messages, isAtBottom, scrollToBottom])

    // If status/typing rows appear while user is already at bottom, keep the viewport pinned.
    useEffect(() => {
        if (!didInitialScrollRef.current) return
        if (!isAtBottom) return
        requestAnimationFrame(() => {
            scrollToBottom()
        })
    }, [hasStatusRow, isAtBottom, scrollToBottom])

    return (
        <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4"
                style={{ paddingBottom: 80 }}
                data-testid="chat-scroll"
            >
                <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const index = virtualRow.index
                        const isTypingRow = hasStatusRow && index === messages.length
                        if (isTypingRow) {
                            return (
                                <div
                                    key="typing-row"
                                    ref={rowVirtualizer.measureElement}
                                    data-index={index}
                                    className="px-4 md:px-10 lg:px-20"
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <TypingIndicator
                                        typingUsers={typingUsers}
                                        activeGang={activeGang}
                                        activityStatuses={characterStatuses}
                                        showPersonaRoles={showPersonaRoles}
                                    />
                                </div>
                            )
                        }

                        const message = messages[index]
                        if (!message) return null
                        const character = characterBySpeaker.get(normalizeSpeaker(message.speaker))
                        const samePrevious = index > 0 && messages[index - 1].speaker === message.speaker
                        const sameNext = index < messages.length - 1 && messages[index + 1].speaker === message.speaker
                        const groupPosition =
                            samePrevious && sameNext ? 'middle'
                                : !samePrevious && sameNext ? 'first'
                                    : samePrevious && !sameNext ? 'last'
                                        : 'single'
                        const status = characterStatuses[message.speaker]
                        const quotedMessage = message.replyToId ? messageById.get(message.replyToId) ?? null : null
                        const quotedSpeaker = quotedMessage
                            ? characterBySpeaker.get(normalizeSpeaker(quotedMessage.speaker)) ?? null
                            : null
                        const seenBy = seenByMessageId.get(message.id) ?? []

                        return (
                            <div
                                key={message.id}
                                ref={rowVirtualizer.measureElement}
                                data-index={index}
                                className="px-4 md:px-10 lg:px-20"
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
                                    isContinued={samePrevious}
                                    groupPosition={groupPosition}
                                    status={status}
                                    isFastMode={isFastMode}
                                    quotedMessage={quotedMessage}
                                    quotedSpeaker={quotedSpeaker}
                                    seenBy={seenBy}
                                    isGuest={isGuest}
                                    showPersonaRoles={showPersonaRoles}
                                    onReply={onReplyMessage}
                                    onLike={onLikeMessage}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Scroll To Latest */}
            <AnimatePresence>
                {!isAtBottom && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute bottom-24 right-4 sm:right-6 z-50"
                    >
                        <Button
                            onClick={scrollToBottom}
                            size="icon"
                            className="relative rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-white size-11 border border-white/20 backdrop-blur-xl"
                            aria-label="Jump to latest"
                        >
                            <ChevronDown className="w-5 h-5" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
