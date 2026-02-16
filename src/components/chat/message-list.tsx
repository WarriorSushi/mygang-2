'use client'

import { memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Character, Message, useChatStore } from '@/stores/chat-store'
import { MessageItem } from './message-item'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CHARACTERS } from '@/constants/characters'

function ChatSkeleton() {
    return (
        <div className="flex flex-col gap-4 px-4 md:px-10 lg:px-14 py-6" aria-label="Loading messages">
            {/* Incoming message skeleton */}
            <div className="flex items-start gap-3 max-w-[75%]">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex flex-col gap-1.5">
                    <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                    <div className="h-12 w-48 sm:w-64 rounded-2xl bg-muted animate-pulse" />
                </div>
            </div>
            {/* Incoming message skeleton */}
            <div className="flex items-start gap-3 max-w-[75%]">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex flex-col gap-1.5">
                    <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                    <div className="h-16 w-56 sm:w-72 rounded-2xl bg-muted animate-pulse" />
                </div>
            </div>
            {/* Outgoing message skeleton (user) */}
            <div className="flex justify-end">
                <div className="h-10 w-40 sm:w-52 rounded-2xl bg-primary/20 animate-pulse" />
            </div>
            {/* Incoming message skeleton */}
            <div className="flex items-start gap-3 max-w-[75%]">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex flex-col gap-1.5">
                    <div className="h-3 w-14 rounded bg-muted animate-pulse" />
                    <div className="h-20 w-52 sm:w-80 rounded-2xl bg-muted animate-pulse" />
                </div>
            </div>
        </div>
    )
}

interface MessageListProps {
    messages: Message[]
    activeGang: Character[]
    typingUsers?: string[]
    isFastMode?: boolean
    onReplyMessage?: (message: Message) => void
    onLikeMessage?: (message: Message) => void
    onRetryMessage?: (message: Message) => void
    hasMoreHistory?: boolean
    loadingHistory?: boolean
    onLoadOlderHistory?: () => void
    isBootstrappingHistory?: boolean
}

function normalizeSpeaker(value: string) {
    return value.toLowerCase().trim()
}

export const MessageList = memo(function MessageList({
    messages,
    activeGang,
    isFastMode = false,
    onReplyMessage,
    onLikeMessage,
    onRetryMessage,
    hasMoreHistory = false,
    loadingHistory = false,
    onLoadOlderHistory,
    isBootstrappingHistory = false
}: MessageListProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollRafRef = useRef<number | null>(null)
    const animationCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const animatedMessageIdsRef = useRef<Set<string>>(new Set())
    const didInitialScrollRef = useRef(false)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const prevMessagesLength = useRef(messages.length)
    const isGuest = useChatStore((state) => state.isGuest)
    const showPersonaRoles = useChatStore((state) => state.showPersonaRoles)
    const itemCount = messages.length
    const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
    const characterCatalogById = useMemo(
        () => new Map(CHARACTERS.map((character) => [normalizeSpeaker(character.id), character])),
        []
    )
    const characterBySpeaker = useMemo(
        () => new Map(activeGang.map((character) => {
            const normalized = normalizeSpeaker(character.id)
            const catalogCharacter = characterCatalogById.get(normalized)
            return [
                normalized,
                catalogCharacter
                    ? { ...catalogCharacter, ...character, roleLabel: character.roleLabel || catalogCharacter.roleLabel }
                    : character
            ]
        })),
        [activeGang, characterCatalogById]
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

    const measuredSizes = useRef<Map<number, number>>(new Map())

    const rowVirtualizer = useVirtualizer({
        count: itemCount,
        getScrollElement: () => scrollRef.current,
        estimateSize: (index) => measuredSizes.current.get(index) ?? 85,
        overscan: 8,
        measureElement: (el) => {
            const h = el.getBoundingClientRect().height
            const idx = Number((el as HTMLElement).dataset.index)
            if (!Number.isNaN(idx)) measuredSizes.current.set(idx, h)
            return h
        },
    })

    const scrollToBottom = useCallback(() => {
        if (!scrollRef.current) return
        rowVirtualizer.scrollToIndex(Math.max(0, itemCount - 1), { align: 'end' })
        // Double-RAF ensures the virtualizer has committed layout before we affirm position
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!scrollRef.current) return
                const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
                if (scrollHeight - scrollTop - clientHeight > 4) {
                    scrollRef.current.scrollTop = scrollHeight - clientHeight
                }
                setIsAtBottom(true)
            })
        })
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
            if (animationCleanupRef.current) {
                clearTimeout(animationCleanupRef.current)
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
            appendedMessages.forEach((m) => animatedMessageIdsRef.current.add(m.id))
            if (animationCleanupRef.current) {
                clearTimeout(animationCleanupRef.current)
            }
            animationCleanupRef.current = setTimeout(() => {
                animatedMessageIdsRef.current.clear()
                animationCleanupRef.current = null
            }, 1200)

            if (isAtBottom || hasUserMessage) {
                scrollToBottom()
            }
        }

        prevMessagesLength.current = messages.length
    }, [messages, isAtBottom, scrollToBottom])

    if (isBootstrappingHistory && messages.length === 0) {
        return (
            <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
                <ChatSkeleton />
            </div>
        )
    }

    return (
        <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4"
                style={{ paddingBottom: 80 }}
                data-testid="chat-scroll"
            >
                {(hasMoreHistory || loadingHistory) && (
                    <div className="px-4 md:px-10 lg:px-14 pb-2">
                        <div className="flex justify-center">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full text-[10px] uppercase tracking-widest"
                                onClick={onLoadOlderHistory}
                                disabled={loadingHistory || !hasMoreHistory}
                            >
                                {loadingHistory ? 'Loading earlier messages...' : 'Load earlier messages'}
                            </Button>
                        </div>
                    </div>
                )}
                <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const index = virtualRow.index
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
                        const quotedMessage = message.replyToId ? messageById.get(message.replyToId) ?? null : null
                        const quotedSpeaker = quotedMessage
                            ? characterBySpeaker.get(normalizeSpeaker(quotedMessage.speaker)) ?? null
                            : null
                        const seenBy = seenByMessageId.get(message.id) ?? []

                        const shouldAnimate = animatedMessageIdsRef.current.has(message.id)

                        return (
                            <div
                                key={message.id}
                                ref={rowVirtualizer.measureElement}
                                data-index={index}
                                className={cn(
                                    "px-4 md:px-10 lg:px-14",
                                    shouldAnimate && "animate-msg-appear"
                                )}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    transform: `translateY(${virtualRow.start}px)`,
                                    willChange: 'transform',
                                }}
                            >
                                <MessageItem
                                    message={message}
                                    character={character}
                                    isContinued={samePrevious}
                                    groupPosition={groupPosition}
                                    isFastMode={isFastMode}
                                    quotedMessage={quotedMessage}
                                    quotedSpeaker={quotedSpeaker}
                                    seenBy={seenBy}
                                    isGuest={isGuest}
                                    showPersonaRoles={showPersonaRoles}
                                    onReply={onReplyMessage}
                                    onLike={onLikeMessage}
                                    onRetry={onRetryMessage}
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
                        className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.6rem)] right-3 sm:right-4 z-50"
                    >
                        <Button
                            onClick={scrollToBottom}
                            size="icon"
                            data-screenshot-exclude="true"
                            className="relative rounded-full shadow-lg bg-black hover:bg-black/90 text-white size-9 border border-white/25"
                            aria-label="Jump to latest"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
})
