'use client'

import { memo, useState, useRef } from 'react'
import { Character, Message } from '@/stores/chat-store'
import { Button } from '@/components/ui/button'
import { cn, truncateText } from '@/lib/utils'
import { Heart, Reply } from 'lucide-react'
import Image from 'next/image'
import { AvatarLightbox } from './avatar-lightbox'

// ── Avatar with fallback ──

function MessageAvatar({ character, speaker }: { character?: Character; speaker: string }) {
    const [imgFailed, setImgFailed] = useState(false)
    const src = character?.avatar
    const initial = (character?.name || speaker)[0]

    if (src && !imgFailed) {
        return (
            <Image
                src={src}
                alt={character?.name || 'Avatar'}
                width={28}
                height={28}
                className="w-full h-full object-cover"
                sizes="28px"
                priority={false}
                onError={() => setImgFailed(true)}
            />
        )
    }

    const bgRgb = parseColorToRgb(character?.color)
    const textRgb = pickReadableTextColor(bgRgb)

    return (
        <span className="text-[11px] font-semibold uppercase" style={{ color: toRgbString(textRgb) }}>
            {initial}
        </span>
    )
}

// ── Color utilities ──

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

function ensureReadablePersonaNameOnLight(color: Rgb) {
    const lightBackdrop: Rgb = { r: 240, g: 245, b: 250 }
    const darkTarget: Rgb = { r: 8, g: 12, b: 18 }
    for (let ratio = 0.72; ratio <= 0.94; ratio += 0.04) {
        const candidate = mixRgb(color, darkTarget, ratio)
        if (contrastRatio(candidate, lightBackdrop) >= 7.0) {
            return candidate
        }
    }
    return mixRgb(color, darkTarget, 0.9)
}

// ── Link rendering ──

function renderMessageContent(content: string) {
    const urlRegex = /(https?:\/\/[^\s<]+)/g
    const parts = content.split(urlRegex)
    return parts.map((part, i) =>
        /^https?:\/\//.test(part)
            ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80 break-all">{part}</a>
            : part
    )
}

// ── Helpers ──

function formatRelativeTime(dateStr: string) {
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    if (!Number.isFinite(then)) return null
    const diffMs = now - then
    if (diffMs < 0) return null
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
}

// ── Component ──

interface MessageItemProps {
    message: Message
    character?: Character
    isContinued?: boolean
    groupPosition?: 'single' | 'first' | 'middle' | 'last'
    isFastMode?: boolean
    quotedMessage?: Message | null
    quotedSpeaker?: Character | null
    seenBy?: string[]
    showPersonaRoles?: boolean
    isDark?: boolean
    onReply?: (message: Message) => void
    onLike?: (message: Message) => void
    onRetry?: (message: Message) => void
}

function MessageItemComponent({
    message,
    character,
    isContinued,
    groupPosition = 'single',
    isFastMode = false,
    quotedMessage = null,
    quotedSpeaker = null,
    seenBy = [],
    showPersonaRoles = true,
    isDark = true,
    onReply,
    onLike,
    onRetry
}: MessageItemProps) {
    const isUser = message.speaker === 'user'
    const isReaction = !!message.reaction
    const [liked, setLiked] = useState(false)
    const [showAvatar, setShowAvatar] = useState(false)
    const avatarTriggerRef = useRef<HTMLElement | null>(null)
    const canShowActions = !isReaction && message.speaker !== 'system'

    const timeLabel = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const relativeTime = message.created_at ? formatRelativeTime(message.created_at) : null

    // ── Bubble shapes (WhatsApp-style grouped corners) ──
    const userShape = {
        single: 'rounded-[20px] rounded-br-[5px]',
        first: 'rounded-[20px] rounded-br-[5px]',
        middle: 'rounded-[20px] rounded-tr-[5px] rounded-br-[5px]',
        last: 'rounded-[20px] rounded-tr-[5px]',
    }[groupPosition]

    const gangShape = {
        single: 'rounded-[20px] rounded-tl-[5px]',
        first: 'rounded-[20px] rounded-bl-[5px]',
        middle: 'rounded-[20px] rounded-tl-[5px] rounded-bl-[5px]',
        last: 'rounded-[20px] rounded-tl-[5px]',
    }[groupPosition]

    // ── Colors ──
    const baseRgb = parseColorToRgb(character?.color)

    // AI bubble: subtle persona tint blended into a neutral base (no garish borders)
    const aiBubbleRgb = isDark
        ? mixRgb(baseRgb, { r: 22, g: 30, b: 46 }, 0.85)
        : mixRgb(baseRgb, { r: 235, g: 240, b: 246 }, 0.82)
    // Light mode gets a subtle neutral border so bubbles don't vanish on the light bg
    const aiBorderLight: Rgb = { r: 210, g: 218, b: 228 }
    const aiTextRgb = pickReadableTextColor(aiBubbleRgb)

    // Persona name: slightly bright in dark, readable in light
    const personaNameRgb = isDark
        ? mixRgb(baseRgb, { r: 255, g: 255, b: 255 }, 0.2)
        : ensureReadablePersonaNameOnLight(baseRgb)

    // Quote block colors (left-border accent style)
    const quoteFromAi = !!quotedMessage && quotedMessage.speaker !== 'user'
    const quoteBubbleBase = parseColorToRgb(quotedSpeaker?.color)
    const quoteAccentRgb = quoteFromAi
        ? quoteBubbleBase
        : (isDark ? { r: 100, g: 190, b: 160 } : { r: 16, g: 120, b: 90 })
    const quoteBgRgb = isDark
        ? { r: 14, g: 20, b: 34 }
        : { r: 230, g: 236, b: 244 }
    const quoteTextRgb = isDark
        ? { r: 170, g: 182, b: 200 }
        : { r: 60, g: 70, b: 85 }
    const quoteLabelRgb = isDark
        ? mixRgb(quoteBubbleBase, { r: 230, g: 238, b: 248 }, 0.25)
        : ensureReadablePersonaNameOnLight(quoteBubbleBase)
    const quotePreviewRaw = quotedMessage
        ? (quotedMessage.reaction ? `[Reaction: ${quotedMessage.content}]` : quotedMessage.content)
        : ''
    const quotePreviewShort = truncateText(quotePreviewRaw, 38)
    const quotePreviewLong = truncateText(quotePreviewRaw, 72)


    return (
        <div
            className={cn(
                "group relative flex flex-col w-auto max-w-[82vw] sm:max-w-[66vw] lg:max-w-[34rem]",
                isUser ? "ml-auto items-end" : "mr-auto items-start",
                isReaction && "opacity-80"
            )}
        >
            {/* Avatar + Name row */}
            {!isUser && !isContinued && (
                <div className="flex items-center gap-2 mb-1 ml-0.5">
                    <button
                        type="button"
                        ref={(el) => { avatarTriggerRef.current = el }}
                        aria-label={`View ${character?.name || message.speaker}'s avatar`}
                        className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center ring-[1.5px] ring-background cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all active:scale-95"
                        style={{ backgroundColor: character?.color || '#555' }}
                        onClick={() => character?.avatar && setShowAvatar(true)}
                    >
                        <MessageAvatar character={character} speaker={message.speaker} />
                    </button>
                    <span
                        className="text-[12px] font-semibold tracking-wide"
                        style={{ color: toRgbString(personaNameRgb) }}
                    >
                        {character?.name || message.speaker}
                    </span>
                    {showPersonaRoles && (character?.roleLabel || character?.archetype) && (
                        <span className="text-[10px] text-muted-foreground/80 dark:text-muted-foreground/65 italic">
                            {character?.roleLabel || character?.archetype}
                        </span>
                    )}
                </div>
            )}

            {/* Message bubble */}
            <div className={cn('min-w-0 max-w-full', isUser ? 'self-end' : 'self-start')}>
                <div
                    className={cn(
                        "relative max-w-full px-3.5 py-2.5 sm:px-4 sm:py-3 transition-colors",
                        isUser
                            ? cn("bg-primary text-primary-foreground shadow-sm", userShape)
                            : isReaction
                                ? "bg-transparent p-1 rounded-full"
                                : gangShape
                    )}
                    style={isReaction
                        ? undefined
                        : isUser
                            ? undefined
                            : {
                                backgroundColor: toRgbString(aiBubbleRgb),
                                ...(isDark ? {} : { border: `1px solid ${toRgbString(aiBorderLight)}` }),
                            }
                    }
                >
                    {isReaction ? (
                        <span className="text-3xl animate-bounce-short inline-block" role="img" aria-label={`${character?.name || message.speaker} reacted with ${message.content}`}>{message.content}</span>
                    ) : (
                        <div className="space-y-1.5 min-w-0">
                            {/* Quoted reply (left-border accent style) */}
                            {quotedMessage && (
                                <div
                                    className="w-full max-w-full overflow-hidden rounded-lg pl-2.5 pr-2 py-1.5 text-[11px] min-w-0 border-l-[3px]"
                                    style={{
                                        backgroundColor: toRgbString(quoteBgRgb),
                                        borderLeftColor: toRgbString(quoteAccentRgb),
                                    }}
                                >
                                    <div
                                        className="mb-0.5 text-[10px] font-semibold"
                                        style={{ color: toRgbString(quoteLabelRgb) }}
                                    >
                                        {quotedSpeaker?.name || (quotedMessage.speaker === 'user' ? 'You' : quotedMessage.speaker)}
                                    </div>
                                    <div
                                        className="w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                                        style={{ color: toRgbString(quoteTextRgb) }}
                                    >
                                        <span className="sm:hidden">{quotePreviewShort}</span>
                                        <span className="hidden sm:inline">{quotePreviewLong}</span>
                                    </div>
                                </div>
                            )}
                            {/* Message content */}
                            <p
                                className={cn(
                                    "select-text break-words leading-relaxed text-[14px] sm:text-[14.5px]",
                                    isUser ? "font-medium" : "font-normal"
                                )}
                                style={!isUser ? { color: toRgbString(aiTextRgb) } : undefined}
                            >
                                {renderMessageContent(message.content)}
                            </p>
                        </div>
                    )}
                </div>

                {/* Inline action icons below bubble */}
                {canShowActions && (
                    <div className={cn(
                        "flex items-center gap-2.5 mt-0.5 px-1",
                        isUser ? "justify-end" : "justify-start"
                    )}>
                        <button
                            type="button"
                            aria-label={liked ? 'Unlike message' : 'Like message'}
                            className="p-2 -m-1.5 transition-colors"
                            onClick={() => setLiked((prev) => !prev)}
                        >
                            <Heart
                                className={cn(
                                    "w-3 h-3 transition-all",
                                    liked
                                        ? "fill-red-500 text-red-500 scale-110"
                                        : "text-muted-foreground/80 dark:text-muted-foreground/65 hover:text-muted-foreground/90 dark:hover:text-muted-foreground/70"
                                )}
                            />
                        </button>
                        <button
                            type="button"
                            aria-label="Reply to message"
                            className="p-2 -m-1.5 text-muted-foreground/80 dark:text-muted-foreground/65 hover:text-muted-foreground/90 dark:hover:text-muted-foreground/70 transition-colors"
                            onClick={() => onReply?.(message)}
                        >
                            <Reply className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>

            {/* Time + metadata */}
            {!isReaction && (
                <div className={cn(
                    "mt-0.5 flex items-center gap-1.5 px-1",
                    isUser ? "self-end" : "self-start"
                )}>
                    <span className="text-[10px] text-muted-foreground/80 dark:text-muted-foreground/65 transition-opacity">
                        {timeLabel}
                    </span>
                    {relativeTime && (
                        <span className="text-[10px] text-muted-foreground/80 dark:text-muted-foreground/65">
                            {relativeTime}
                        </span>
                    )}
                </div>
            )}

            {/* Delivery status + Seen by (stable-height container) */}
            {isUser && !isReaction && (
                <div className="mt-0.5 px-1 min-h-[16px]">
                    {message.deliveryStatus && (
                        <span className={cn(
                            "text-[10px]",
                            message.deliveryStatus === 'failed'
                                ? "text-destructive"
                                : message.deliveryStatus === 'sending'
                                    ? "text-muted-foreground/75"
                                    : "text-emerald-500/60"
                        )}>
                            {message.deliveryStatus === 'sending' && 'Sending\u2026'}
                            {message.deliveryStatus === 'sent' && 'Sent'}
                            {message.deliveryStatus === 'failed' && (message.deliveryError || 'Failed to send')}
                        </span>
                    )}
                    {message.deliveryStatus === 'failed' && onRetry && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRetry(message)}
                            className="ml-1.5 rounded-full text-[10px] border border-destructive/30 text-destructive hover:bg-destructive hover:text-white"
                        >
                            Retry
                        </Button>
                    )}
                    {seenBy.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/60 dark:text-muted-foreground/40 ml-1.5">
                            Seen by {seenBy.join(', ')}
                        </span>
                    )}
                </div>
            )}

            {/* Avatar lightbox */}
            {showAvatar && character?.avatar && (
                <AvatarLightbox
                    character={character}
                    onClose={() => setShowAvatar(false)}
                    triggerRef={avatarTriggerRef}
                />
            )}

        </div>
    )
}

export const MessageItem = memo(MessageItemComponent, (prev, next) => {
    const seenByEqual = prev.seenBy?.length === next.seenBy?.length &&
        (prev.seenBy ?? []).every((v, i) => v === (next.seenBy ?? [])[i])
    return (
        prev.message === next.message &&
        prev.character === next.character &&
        prev.isContinued === next.isContinued &&
        prev.groupPosition === next.groupPosition &&
        prev.isFastMode === next.isFastMode &&
        prev.quotedMessage === next.quotedMessage &&
        prev.quotedSpeaker === next.quotedSpeaker &&
        seenByEqual &&
        prev.showPersonaRoles === next.showPersonaRoles &&
        prev.isDark === next.isDark &&
        prev.onReply === next.onReply &&
        prev.onLike === next.onLike &&
        prev.onRetry === next.onRetry
    )
})
