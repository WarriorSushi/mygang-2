'use client'

import { memo } from 'react'
import { Character, Message, useChatStore } from '@/stores/chat-store'
import { MessageItem } from './message-item'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CHARACTERS } from '@/constants/characters'
import { useTheme } from 'next-themes'

function ChatSkeleton() {
    return (
        <div className="flex flex-col gap-4 px-4 py-6" role="status" aria-label="Loading messages">
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

// Module-level cache for Lottie assets (persists across mounts)
let cachedAnimationData: object | null = null
let cachedLottieComponent: ComponentType<any> | null = null
let lottieLoadPromise: Promise<void> | null = null
let animationLoadPromise: Promise<void> | null = null

function EmptyStateWelcome() {
    const [animationData, setAnimationData] = useState<object | null>(cachedAnimationData)
    const [LottiePlayer, setLottiePlayer] = useState<ComponentType<any> | null>(cachedLottieComponent)

    useEffect(() => {
        if (cachedAnimationData) {
            setAnimationData(cachedAnimationData)
            return
        }
        if (!animationLoadPromise) {
            animationLoadPromise = fetch('/lottie/confetti.json')
                .then((res) => res.json())
                .then((data) => { cachedAnimationData = data })
                .catch(() => {})
        }
        animationLoadPromise.then(() => {
            if (cachedAnimationData) setAnimationData(cachedAnimationData)
        })
    }, [])

    useEffect(() => {
        if (cachedLottieComponent) {
            setLottiePlayer(() => cachedLottieComponent)
            return
        }
        if (!lottieLoadPromise) {
            lottieLoadPromise = import('lottie-react')
                .then((mod) => { cachedLottieComponent = mod.default })
                .catch(() => {})
        }
        lottieLoadPromise.then(() => {
            if (cachedLottieComponent) setLottiePlayer(() => cachedLottieComponent)
        })
    }, [])

    return (
        <div className="flex flex-col items-center justify-center h-full py-12 sm:py-16 text-center px-4 relative">
            {LottiePlayer && animationData && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <LottiePlayer
                        animationData={animationData}
                        loop={false}
                        autoplay
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '100%',
                            height: '100%',
                            opacity: 0.7,
                        }}
                    />
                </div>
            )}
            <div className="relative z-10">
                <h3 className="text-base sm:text-lg font-bold text-foreground/90 mb-1.5">
                    Welcome to your gang!
                </h3>
                <p className="text-sm text-muted-foreground/70 max-w-[240px] mx-auto leading-relaxed">
                    They&apos;re warming up. Say hi to get things going!
                </p>
            </div>
        </div>
    )
}

interface MessageListProps {
    messages: Message[]
    activeGang: Character[]
    isFastMode?: boolean
    onReplyMessage?: (message: Message) => void
    onLikeMessage?: (message: Message) => void
    onRetryMessage?: (message: Message) => void
    hasMoreHistory?: boolean
    loadingHistory?: boolean
    onLoadOlderHistory?: () => void
    isBootstrappingHistory?: boolean
    typingUsers?: string[]
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
    isBootstrappingHistory = false,
    typingUsers = []
}: MessageListProps) {
    const { theme, resolvedTheme } = useTheme()
    const isDark = (resolvedTheme ?? theme ?? 'dark') === 'dark'
    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollRafRef = useRef<number | null>(null)
    const animationCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const animatedMessageIdsRef = useRef<Set<string>>(new Set())
    const didInitialScrollRef = useRef(false)
    const [isAtBottom, setIsAtBottom] = useState(true)
    const [unreadCount, setUnreadCount] = useState(0)
    const [liveAnnouncement, setLiveAnnouncement] = useState('')
    const prevMessagesLength = useRef(messages.length)
    const prevFirstMessageIdRef = useRef<string | null>(messages[0]?.id ?? null)
    const showPersonaRoles = useChatStore((state) => state.showPersonaRoles)
    const customCharacterNames = useChatStore((state) => state.customCharacterNames)
    const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
    const characterCatalogById = useMemo(
        () => new Map(CHARACTERS.map((character) => [normalizeSpeaker(character.id), character])),
        []
    )
    const characterBySpeaker = useMemo(
        () => new Map(activeGang.map((character) => {
            const normalized = normalizeSpeaker(character.id)
            const catalogCharacter = characterCatalogById.get(normalized)
            const merged = catalogCharacter
                ? { ...catalogCharacter, ...character, avatar: character.avatar || catalogCharacter.avatar, roleLabel: character.roleLabel || catalogCharacter.roleLabel }
                : character
            const customName = customCharacterNames?.[character.id]
            return [
                normalized,
                customName ? { ...merged, name: customName } : merged
            ]
        })),
        [activeGang, characterCatalogById, customCharacterNames]
    )
    const seenByMessageId = useMemo(() => {
        const msgs = messages.length > 20 ? messages.slice(-20) : messages
        const seenMap = new Map<string, string[]>()
        for (let i = 0; i < msgs.length; i++) {
            const current = msgs[i]
            if (current.speaker !== 'user') continue
            const seenNames: string[] = []
            const seenSpeakerIds = new Set<string>()
            for (let j = i + 1; j < msgs.length && seenNames.length < 2; j++) {
                const next = msgs[j]
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

    const scrollToBottom = useCallback(() => {
        if (!scrollRef.current) return
        requestAnimationFrame(() => {
            if (!scrollRef.current) return
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            setIsAtBottom(true)
            setUnreadCount(0)
        })
    }, [])

    // Handle scroll events
    const handleScroll = () => {
        if (scrollRafRef.current !== null) return
        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = null
            if (!scrollRef.current) return
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
            const atBottom = scrollHeight - scrollTop - clientHeight < 48
            setIsAtBottom(atBottom)
            if (atBottom) setUnreadCount(0)
        })
    }

    // Cleanup
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

    // Initial load — scroll to bottom
    useEffect(() => {
        if (didInitialScrollRef.current) return
        if (messages.length === 0) return
        didInitialScrollRef.current = true
        scrollToBottom()
    }, [messages.length, scrollToBottom])

    // New messages — auto-scroll + animate (but NOT for older history prepend)
    useEffect(() => {
        if (!scrollRef.current) return

        const previousLength = prevMessagesLength.current
        const prevFirstId = prevFirstMessageIdRef.current
        const currentFirstId = messages[0]?.id ?? null
        const isNewMessage = messages.length > previousLength

        // Detect prepend: first message ID changed = older messages were added at top
        const isPrepend = isNewMessage && currentFirstId !== prevFirstId && prevFirstId !== null

        if (isPrepend) {
            // Preserve scroll position: offset by the new content height
            const el = scrollRef.current
            const prevScrollHeight = el.scrollHeight
            requestAnimationFrame(() => {
                if (!scrollRef.current) return
                const newScrollHeight = scrollRef.current.scrollHeight
                scrollRef.current.scrollTop += newScrollHeight - prevScrollHeight
            })
        } else if (isNewMessage) {
            const appendedMessages = messages.slice(previousLength)
            const hasUserMessage = appendedMessages.some((m) => m.speaker === 'user')
            appendedMessages.forEach((m) => animatedMessageIdsRef.current.add(m.id))

            // Announce new non-user messages for screen readers
            const newAiMessages = appendedMessages.filter(m => m.speaker !== 'user')
            if (newAiMessages.length > 0) {
                const last = newAiMessages[newAiMessages.length - 1]
                const speakerName = characterBySpeaker.get(normalizeSpeaker(last.speaker))?.name ?? last.speaker
                setLiveAnnouncement(`${speakerName} says: ${last.content.slice(0, 120)}`)
            }
            if (animationCleanupRef.current) {
                clearTimeout(animationCleanupRef.current)
            }
            animationCleanupRef.current = setTimeout(() => {
                animatedMessageIdsRef.current.clear()
                animationCleanupRef.current = null
            }, 1200)

            if (isAtBottom || hasUserMessage) {
                scrollToBottom()
            } else if (newAiMessages.length > 0) {
                setUnreadCount((prev) => prev + newAiMessages.length)
            }
        }

        prevMessagesLength.current = messages.length
        prevFirstMessageIdRef.current = currentFirstId
    }, [messages, isAtBottom, scrollToBottom, characterBySpeaker])

    if (isBootstrappingHistory && messages.length === 0) {
        return (
            <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
                <ChatSkeleton />
            </div>
        )
    }

    return (
        <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Screen reader announcements for new messages */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {liveAnnouncement}
            </div>
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                role="log"
                aria-label="Chat messages"
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4"
                style={{ paddingBottom: 80 }}
                data-testid="chat-scroll"
            >
              <div className="max-w-3xl mx-auto w-full">
                {(hasMoreHistory || loadingHistory) && (
                    <div className="px-4 pb-2">
                        <div className="flex justify-center" aria-live="polite">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="rounded-full text-[10px] uppercase tracking-widest"
                                onClick={onLoadOlderHistory}
                                disabled={loadingHistory || !hasMoreHistory}
                                aria-busy={loadingHistory}
                            >
                                {loadingHistory ? 'Loading earlier messages...' : 'Load earlier messages'}
                            </Button>
                        </div>
                    </div>
                )}
                {messages.length === 0 && (
                    <EmptyStateWelcome />
                )}
                <div className="flex flex-col">
                    {messages.map((message, index) => {
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
                        const isReaction = !!message.reaction

                        // WYWA divider: show before the first message of a contiguous wywa batch
                        const isWywa = message.source === 'wywa'
                        const prevIsWywa = index > 0 && messages[index - 1].source === 'wywa'
                        const showWywaDivider = isWywa && !prevIsWywa

                        return (
                            <div
                                key={message.id}
                                className={cn(
                                    "px-4",
                                    index === 0
                                        ? ""
                                        : samePrevious && !showWywaDivider
                                            ? "pt-[3px]"
                                            : isReaction
                                                ? "pt-3"
                                                : "pt-4",
                                    index < messages.length - 6 && "content-auto"
                                )}
                            >
                                {showWywaDivider && (
                                    <div className="flex items-center gap-3 py-3" role="separator" aria-label="While you were away">
                                        <div className="flex-1 h-px bg-border/50" />
                                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-medium select-none">
                                            While you were away
                                        </span>
                                        <div className="flex-1 h-px bg-border/50" />
                                    </div>
                                )}
                                <div className={shouldAnimate ? "animate-msg-appear" : undefined}>
                                    <MessageItem
                                        message={message}
                                        character={character}
                                        isContinued={samePrevious && !showWywaDivider}
                                        groupPosition={groupPosition}
                                        isFastMode={isFastMode}
                                        quotedMessage={quotedMessage}
                                        quotedSpeaker={quotedSpeaker}
                                        seenBy={seenBy}
                                        showPersonaRoles={showPersonaRoles}
                                        isDark={isDark}
                                        onReply={onReplyMessage}
                                        onLike={onLikeMessage}
                                        onRetry={onRetryMessage}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Inline typing indicator */}
                {typingUsers.length > 0 && (
                    <div className="px-4 pt-2 pb-1" role="status" aria-label="Characters are typing">
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-1.5">
                                {typingUsers.slice(0, 3).map((uid) => {
                                    const char = characterBySpeaker.get(normalizeSpeaker(uid))
                                    return char?.avatar ? (
                                        <Image
                                            key={uid}
                                            src={char.avatar}
                                            alt={char.name}
                                            width={20}
                                            height={20}
                                            className="w-5 h-5 rounded-full border border-background object-cover"
                                        />
                                    ) : null
                                })}
                            </div>
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground/70">
                                <span className="inline-flex gap-[2px]">
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/80 dark:bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/80 dark:bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1 h-1 rounded-full bg-muted-foreground/80 dark:bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </span>
                            </span>
                        </div>
                    </div>
                )}
              </div>
            </div>

            {/* Scroll To Latest */}
            <div className={cn(
                "absolute bottom-[calc(env(safe-area-inset-bottom)+0.6rem)] right-3 sm:right-4 z-50 transition-all duration-200 motion-reduce:transition-none",
                isAtBottom ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
            )}>
                <Button
                    onClick={scrollToBottom}
                    size="icon"
                    data-screenshot-exclude="true"
                    className="relative rounded-full shadow-lg bg-foreground hover:bg-foreground/90 text-background size-9 border border-background/25"
                    aria-label={unreadCount > 0 ? `${unreadCount} new messages — jump to latest` : 'Jump to latest'}
                >
                    <ChevronDown className="w-4 h-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-primary text-[10px] font-bold flex items-center justify-center px-1 text-primary-foreground">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </Button>
            </div>
        </div>
    )
})
