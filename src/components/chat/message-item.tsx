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

type Rgb = { r: number; g: number; b: number }

const FALLBACK_RGB: Rgb = { r: 99, g: 102, b: 241 }

function clampByte(value: number) {
    return Math.max(0, Math.min(255, Math.round(value)))
}

function parseColorToRgb(color?: string | null): Rgb {
    if (!color) return FALLBACK_RGB
    const value = color.trim()
    if (value.startsWith('#')) {
        const hex = value.slice(1)
        if (hex.length === 3) {
            return {
                r: parseInt(`${hex[0]}${hex[0]}`, 16),
                g: parseInt(`${hex[1]}${hex[1]}`, 16),
                b: parseInt(`${hex[2]}${hex[2]}`, 16),
            }
        }
        if (hex.length === 6) {
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16),
            }
        }
    }
    const rgbMatch = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i)
    if (rgbMatch) {
        return {
            r: clampByte(Number(rgbMatch[1])),
            g: clampByte(Number(rgbMatch[2])),
            b: clampByte(Number(rgbMatch[3])),
        }
    }
    return FALLBACK_RGB
}

function mixRgb(a: Rgb, b: Rgb, ratio: number): Rgb {
    const t = Math.max(0, Math.min(1, ratio))
    return {
        r: clampByte(a.r * (1 - t) + b.r * t),
        g: clampByte(a.g * (1 - t) + b.g * t),
        b: clampByte(a.b * (1 - t) + b.b * t),
    }
}

function toRgbString(color: Rgb) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`
}

function channelToLinear(channel: number) {
    const v = channel / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

function luminance(color: Rgb) {
    const r = channelToLinear(color.r)
    const g = channelToLinear(color.g)
    const b = channelToLinear(color.b)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: Rgb, b: Rgb) {
    const l1 = luminance(a)
    const l2 = luminance(b)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
}

function pickReadableTextColor(background: Rgb) {
    const dark: Rgb = { r: 12, g: 22, b: 36 }
    const light: Rgb = { r: 245, g: 249, b: 255 }
    return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light
}

function truncateText(value: string, maxChars: number) {
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxChars) return normalized
    return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`
}

interface MessageItemProps {
    message: Message
    character?: Character
    isContinued?: boolean
    groupPosition?: 'single' | 'first' | 'middle' | 'last'
    isFastMode?: boolean
    animateOnMount?: boolean
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
    isContinued,
    groupPosition = 'single',
    isFastMode = false,
    animateOnMount = false,
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
    const isDark = theme === 'dark'
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

    const baseRgb = parseColorToRgb(character?.color)
    const aiBubbleRgb = isDark
        ? mixRgb(baseRgb, { r: 10, g: 18, b: 32 }, 0.58)
        : mixRgb(baseRgb, { r: 246, g: 249, b: 252 }, 0.77)
    const aiBorderRgb = isDark
        ? mixRgb(aiBubbleRgb, { r: 148, g: 163, b: 184 }, 0.14)
        : mixRgb(baseRgb, { r: 31, g: 41, b: 55 }, 0.24)
    const aiTextRgb = pickReadableTextColor(aiBubbleRgb)

    const quoteFromAi = !!quotedMessage && quotedMessage.speaker !== 'user'
    const quoteBubbleBase = parseColorToRgb(quotedSpeaker?.color)
    const quoteBgRgb = quoteFromAi
        ? (isDark
            ? mixRgb(quoteBubbleBase, { r: 10, g: 18, b: 32 }, 0.62)
            : mixRgb(quoteBubbleBase, { r: 246, g: 249, b: 252 }, 0.82))
        : (isDark ? { r: 42, g: 54, b: 72 } : { r: 233, g: 239, b: 246 })
    const quoteBorderRgb = quoteFromAi
        ? (isDark
            ? mixRgb(quoteBgRgb, { r: 148, g: 163, b: 184 }, 0.2)
            : mixRgb(quoteBubbleBase, { r: 31, g: 41, b: 55 }, 0.22))
        : (isDark ? { r: 126, g: 144, b: 166 } : { r: 148, g: 163, b: 184 })
    const quoteTextRgb = pickReadableTextColor(quoteBgRgb)
    const quoteBg = toRgbString(quoteBgRgb)
    const quoteBorder = toRgbString(quoteBorderRgb)
    const quoteText = toRgbString(quoteTextRgb)
    const quoteLabelBase = parseColorToRgb(quotedSpeaker?.color)
    const quoteLabelRgb = isDark
        ? mixRgb(quoteLabelBase, { r: 241, g: 245, b: 249 }, 0.2)
        : mixRgb(quoteLabelBase, { r: 15, g: 23, b: 42 }, 0.26)
    const quotePreviewRaw = quotedMessage
        ? (quotedMessage.reaction ? `[Reaction: ${quotedMessage.content}]` : quotedMessage.content)
        : ''
    const quotePreviewShort = truncateText(quotePreviewRaw, 54)
    const quotePreviewLong = truncateText(quotePreviewRaw, 104)

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
            initial={animateOnMount ? { opacity: 0, y: 10, scale: 0.95 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: animateOnMount ? (isFastMode ? 0.12 : 0.22) : 0.01, ease: 'easeOut' }}
            className={cn(
                "group relative flex flex-col w-fit max-w-[min(84vw,30rem)] sm:max-w-[min(72vw,38rem)]",
                isUser ? "ml-auto items-end" : "mr-auto items-start",
                isReaction && "opacity-80 scale-90 origin-left",
                isContinued ? "mt-0.5" : "mt-6", // Tighter chain spacing for consecutive bubbles
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
                    </div>
                </div>
            )}

            <div ref={actionWrapRef} className={cn('relative min-w-0', isUser ? 'self-end' : 'self-start')}>
                <GlassCard
                    variant={isUser ? 'user' : isReaction ? 'default' : 'ai'}
                    className={cn(
                        "p-2.5 px-3 sm:p-3 sm:px-3.5 transition-all duration-200 z-10 border border-[1px] shadow-sm backdrop-blur-none",
                        isUser
                            ? cn("text-primary-foreground", userShape)
                            : isReaction
                                ? "bg-transparent border-none p-1 rounded-full shadow-none"
                                : gangShape
                    )}
                    style={(!isUser && !isReaction)
                        ? {
                            backgroundColor: toRgbString(aiBubbleRgb),
                            borderColor: toRgbString(aiBorderRgb),
                            borderWidth: '1px',
                        }
                        : {}
                    }
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onContextMenu={handleContextMenu}
                >
                    {isReaction ? (
                        <span className="text-3xl animate-bounce-short inline-block">{message.content}</span>
                    ) : (
                        <div className="space-y-1.5 min-w-0">
                            {quotedMessage && (
                                <div
                                    className={cn(
                                        "w-full max-w-full overflow-hidden rounded-lg border px-1.5 py-1 text-[10px] min-w-0",
                                        isUser ? "text-right" : "text-left"
                                    )}
                                    style={{
                                        backgroundColor: quoteBg,
                                        borderColor: quoteBorder,
                                    }}
                                >
                                    <div
                                        className="mb-0.5 text-[8px] font-black uppercase tracking-tight"
                                        style={{ color: toRgbString(quoteLabelRgb) }}
                                    >
                                        {quotedSpeaker?.name || (quotedMessage.speaker === 'user' ? 'You' : quotedMessage.speaker)}
                                    </div>
                                    <div
                                        className="block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap italic font-medium"
                                        style={{ color: quoteText }}
                                    >
                                        <span className="sm:hidden">{quotePreviewShort}</span>
                                        <span className="hidden sm:inline">{quotePreviewLong}</span>
                                    </div>
                                </div>
                            )}
                            <p
                                className={cn(
                                    "select-text break-words leading-[1.38] tracking-normal text-[13px] sm:text-[14px]",
                                    isUser ? "font-semibold text-primary-foreground" : "font-medium"
                                )}
                                style={!isUser ? { color: toRgbString(aiTextRgb) } : undefined}
                            >
                                {message.content}
                            </p>
                        </div>
                    )}
                </GlassCard>
                {showActions && canShowActions && (
                    <div className={cn(
                        "absolute z-50 bottom-full mb-2 flex items-center gap-1 rounded-full border border-border/80 bg-card/96 dark:border-white/20 dark:bg-[rgba(10,18,32,0.96)] p-1 shadow-xl backdrop-blur-xl",
                        isUser ? 'right-0' : 'left-0'
                    )}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="rounded-full border border-transparent text-[10px] uppercase tracking-widest text-foreground/90 dark:text-white/90 hover:bg-primary/10 dark:hover:bg-white/12 hover:border-primary/30 dark:hover:border-white/20"
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
                            className="rounded-full border border-transparent text-[10px] uppercase tracking-widest text-foreground/90 dark:text-white/90 hover:bg-primary/10 dark:hover:bg-white/12 hover:border-primary/30 dark:hover:border-white/20"
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
                    "mt-1 text-[9px] uppercase tracking-widest text-foreground/55 dark:text-white/65 opacity-0 group-hover:opacity-100 transition-opacity",
                    isUser ? "self-end" : "self-start"
                )}>
                    {timeLabel}
                </div>
            )}
            {isUser && seenBy.length > 0 && (
                <div className="mt-1 text-[9px] uppercase tracking-widest text-foreground/60 dark:text-white/70">
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
