'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { Character, Message, useChatStore } from '@/stores/chat-store'
import { GlassCard } from '@/components/holographic/glass-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { saveMemoryManual } from '@/app/auth/actions'
import { Bookmark } from 'lucide-react'

interface MessageItemProps {
    message: Message
    character?: Character
    status?: string
    isContinued?: boolean
}

function MessageItemComponent({ message, character, status, isContinued }: MessageItemProps) {
    const isUser = message.speaker === 'user'
    const isReaction = !!message.reaction
    const { messages, activeGang, isGuest } = useChatStore()
    const { theme } = useTheme()

    // Find quoted message if it exists
    const quotedMessage = message.replyToId ? messages.find((m: Message) => m.id === message.replyToId) : null
    const quotedSpeaker = quotedMessage ? activeGang.find((c: Character) => c.id.toLowerCase().trim() === quotedMessage.speaker.toLowerCase().trim()) : null
    const messageIndex = messages.findIndex((m: Message) => m.id === message.id)
    const seenBy = (() => {
        if (!isUser || messageIndex === -1) return []
        const seen: string[] = []
        for (let i = messageIndex + 1; i < messages.length; i++) {
            const msg = messages[i]
            if (msg.speaker !== 'user' && !seen.includes(msg.speaker)) {
                const char = activeGang.find((c: Character) => c.id.toLowerCase().trim() === msg.speaker.toLowerCase().trim())
                if (char?.name) seen.push(char.name)
            }
            if (seen.length >= 2) break
        }
        return seen
    })()

    const timeLabel = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn(
                "group flex flex-col max-w-[85%]",
                isUser ? "ml-auto items-end" : "mr-auto items-start",
                isReaction && "opacity-80 scale-90 origin-left",
                isContinued ? "mt-1.5" : "mt-6" // Controlled spacing
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
                            <img src={character.avatar} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
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

            <GlassCard
                variant={isUser ? 'user' : isReaction ? 'default' : 'ai'}
                className={cn(
                    "p-3.5 px-4 rounded-2xl transition-all duration-300 z-10 border shadow-sm",
                    isUser
                        ? cn("text-primary-foreground rounded-tr-none hover:brightness-110", isContinued && "rounded-tr-2xl")
                        : isReaction
                            ? "bg-transparent border-none p-1 rounded-full shadow-none"
                            : cn(
                                "rounded-tl-none",
                                isContinued && "rounded-tl-2xl",
                                !isContinued && "border-l-[3px]"
                            )
                )}
                style={(!isUser && !isReaction) ? {
                    backgroundColor: theme === 'dark'
                        ? `${character?.color || '#ffffff'}66` // 40% Vibrant tint in dark
                        : `${character?.color || '#ffffff'}33`, // 20% Vibrant tint in light
                    borderLeftColor: character?.color || 'rgba(255,255,255,0.4)'
                } : {}}
            >
                {isReaction ? (
                    <span className="text-3xl animate-bounce-short inline-block">{message.content}</span>
                ) : (
                    <p className="text-[15px] font-bold leading-relaxed select-text tracking-tight text-foreground dark:text-white">{message.content}</p>
                )}
            </GlassCard>
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
