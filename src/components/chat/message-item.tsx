'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Character, Message } from '@/stores/chat-store'
import { GlassCard } from '@/components/holographic/glass-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { saveMemoryManual } from '@/app/auth/actions'
import { Bookmark, Heart, Reply } from 'lucide-react'
import Image from 'next/image'

interface MessageItemProps {
    message: Message
    character?: Character
    status?: string
    isContinued?: boolean
    groupPosition?: 'single' | 'first' | 'middle' | 'last'
    isFastMode?: boolean
    quotedMessage?: Message | null
    quotedSpeaker?: Character | null
    seenBy?: string[]
    isGuest?: boolean
    showPersonaRoles?: boolean
    onReply?: (message: Message) => void
    onLike?: (message: Message) => void
}

function MessageItemComponent({
    message,
    character,
    status,
    isContinued,
    groupPosition = 'single',
    isFastMode = false,
    quotedMessage = null,
    quotedSpeaker = null,
    seenBy = [],
    isGuest = true,
    showPersonaRoles = true,
    onReply,
    onLike
}: MessageItemProps) {
    const isUser = message.speaker === 'user'
    const isReaction = !!message.reaction
    const { theme } = useTheme()
    const [showActions, setShowActions] = useState(false)
    const actionWrapRef = useRef<HTMLDivElement>(null)
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const canShowActions = !isReaction && message.speaker !== 'system'

    const timeLabel = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userShape = {
        single: 'rounded-2xl rounded-br-sm',
        first: 'rounded-2xl rounded-br-sm',
        middle: 'rounded-2xl rounded-tr-sm rounded-br-sm',
        last: 'rounded-2xl rounded-tr-sm',
    }[groupPosition]
    const gangShape = {
        single: 'rounded-2xl rounded-tl-sm',
        first: 'rounded-2xl rounded-bl-sm',
        middle: 'rounded-2xl rounded-tl-sm rounded-bl-sm',
        last: 'rounded-2xl rounded-tl-sm',
    }[groupPosition]

    const clearLongPressTimer = () => {
        if (!longPressTimerRef.current) return
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
    }

    const handlePointerDown = () => {
        if (!canShowActions) return
        clearLongPressTimer()
        longPressTimerRef.current = setTimeout(() => {
            setShowActions(true)
        }, 350)
    }

    const handlePointerUp = () => {
        clearLongPressTimer()
    }

    const handleContextMenu = (e: React.MouseEvent) => {
        if (!canShowActions) return
        e.preventDefault()
        setShowActions(true)
    }

    useEffect(() => {
        return () => clearLongPressTimer()
    }, [])

    useEffect(() => {
        if (!showActions) return
        const onDocPointerDown = (e: PointerEvent) => {
            const node = actionWrapRef.current
            if (!node) return
            if (node.contains(e.target as Node)) return
            setShowActions(false)
        }
        document.addEventListener('pointerdown', onDocPointerDown)
        return () => document.removeEventListener('pointerdown', onDocPointerDown)
    }, [showActions])

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: isFastMode ? 0.12 : 0.25, ease: 'easeOut' }}
            className={cn(
                "group relative flex flex-col max-w-[85%]",
                isUser ? "ml-auto items-end" : "mr-auto items-start",
                isReaction && "opacity-80 scale-90 origin-left",
                isContinued ? "mt-1.5" : "mt-6", // Controlled spacing
                showActions ? "z-40" : "z-0"
            )}
        >
            {/* Context Header (Avatar + Name) - Only show if NOT continued and NOT user */}
            {!isUser && !isContinued && (
                <div className="flex items-center gap-2 mb-1 ml-1 overflow-hidden max-w-full">
                    <div
                        className="w-5 h-5 rounded-full overflow-hidden border border-white/10 shrink-0 flex items-center justify-center text-[10px] font-bold"
                        style={{ backgroundColor: character?.color || '#333' }}
                    >
                        {character?.avatar ? (
                            <Image
                                src={character.avatar}
                                alt={character.name || 'Avatar'}
                                width={20}
                                height={20}
                                className="w-full h-full object-cover"
                                sizes="20px"
                                priority={false}
                            />
                        ) : (
                            <span className="text-white uppercase">{(character?.name || message.speaker)[0]}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span
                            className="text-[10px] font-black uppercase tracking-widest opacity-70 shrink-0"
                            style={{ color: character?.color }}
                        >
                            {character?.name || message.speaker}
                        </span>
                        {showPersonaRoles && (character?.roleLabel || character?.archetype) && (
                            <span className="rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-foreground/90 truncate">
                                {character?.roleLabel || character?.archetype}
                            </span>
                        )}
                        {status && (
                            <span className="text-[9px] text-muted-foreground italic truncate animate-pulse">
                                &bull; {status}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {quotedMessage && (
                <div className={cn(
                    "text-[11px] mb-[-12px] z-0 opacity-90 max-w-full px-3 py-2 pb-5 rounded-t-2xl border-l-4 overflow-hidden",
                    isUser ? "mr-2 ml-0 border-r-4 border-l-0 text-right" : "ml-2"
                )}
                    style={{
                        backgroundColor: theme === 'dark'
                            ? `${quotedSpeaker?.color || '#ffffff'}30` // 30% in dark
                            : `${quotedSpeaker?.color || '#000000'}15`, // 15% in light
                        borderColor: quotedSpeaker?.color || 'rgba(0,0,0,0.1)'
                    }}
                >
                    <div className="font-black opacity-80 mb-0.5 text-[9px] uppercase tracking-tighter" style={{ color: quotedSpeaker?.color }}>
                        {quotedSpeaker?.name || (quotedMessage.speaker === 'user' ? 'You' : quotedMessage.speaker)}
                    </div>
                    <div className="truncate italic text-muted-foreground font-medium">
                        {quotedMessage.reaction ? `[Reaction: ${quotedMessage.content}]` : quotedMessage.content}
                    </div>
                </div>
            )}

            <div ref={actionWrapRef} className={cn('relative', isUser ? 'self-end' : 'self-start')}>
                <GlassCard
                    variant={isUser ? 'user' : isReaction ? 'default' : 'ai'}
                    className={cn(
                        "p-3 px-3.5 sm:p-3.5 sm:px-4 transition-all duration-200 z-10 border shadow-sm backdrop-blur-none",
                        isUser
                            ? cn("text-primary-foreground", userShape)
                            : isReaction
                                ? "bg-transparent border-none p-1 rounded-full shadow-none"
                                : gangShape
                    )}
                    style={(!isUser && !isReaction) ? {
                        backgroundColor: theme === 'dark'
                            ? `${character?.color || '#ffffff'}40`
                            : `${character?.color || '#ffffff'}24`
                    } : {}}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onContextMenu={handleContextMenu}
                >
                    {isReaction ? (
                        <span className="text-3xl animate-bounce-short inline-block">{message.content}</span>
                    ) : (
                        <p className={cn(
                            "select-text break-words leading-[1.45] tracking-normal text-[14px] sm:text-[15px]",
                            isUser ? "font-semibold text-primary-foreground" : "font-medium text-foreground dark:text-white"
                        )}>{message.content}</p>
                    )}
                </GlassCard>
                {showActions && canShowActions && (
                    <div className={cn(
                        "absolute z-50 bottom-full mb-2 flex items-center gap-1 rounded-full border border-white/15 bg-background/95 p-1 shadow-xl backdrop-blur-xl",
                        isUser ? 'right-0' : 'left-0'
                    )}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="rounded-full text-[10px] uppercase tracking-widest"
                            onClick={() => {
                                onLike?.(message)
                                setShowActions(false)
                            }}
                        >
                            <Heart className="w-3 h-3" />
                            Like
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="rounded-full text-[10px] uppercase tracking-widest"
                            onClick={() => {
                                onReply?.(message)
                                setShowActions(false)
                            }}
                        >
                            <Reply className="w-3 h-3" />
                            Reply
                        </Button>
                    </div>
                )}
            </div>
            {!isReaction && (
                <div className={cn(
                    "mt-1 text-[9px] uppercase tracking-widest text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity",
                    isUser ? "self-end" : "self-start"
                )}>
                    {timeLabel}
                </div>
            )}
            {isUser && seenBy.length > 0 && (
                <div className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground/70">
                    Seen by {seenBy.join(', ')}
                </div>
            )}
            {isUser && !isReaction && !isGuest && (
                <div className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => saveMemoryManual(message.content)}
                        className="rounded-full text-[10px] uppercase tracking-widest"
                    >
                        <Bookmark className="w-3 h-3" />
                        Save to Memory
                    </Button>
                </div>
            )}
        </motion.div>
    )
}

export const MessageItem = memo(MessageItemComponent)
