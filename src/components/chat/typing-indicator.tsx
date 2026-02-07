'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Character } from '@/stores/chat-store'

interface TypingIndicatorProps {
    typingUsers: string[]
    activeGang: Character[]
    activityStatuses?: Record<string, string>
}

export function TypingIndicator({ typingUsers, activeGang, activityStatuses = {} }: TypingIndicatorProps) {
    const activityEntries = Object.entries(activityStatuses).filter(([id, status]) => status && !typingUsers.includes(id))
    return (
        <div className="flex flex-col gap-1.5 ml-2">
            <AnimatePresence>
                {activityEntries.map(([userId, status]) => {
                    const character = activeGang.find(c => c.id === userId)
                    if (!character) return null

                    return (
                        <motion.div
                            key={`${userId}-status`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-border/70 bg-card/90 dark:border-white/15 dark:bg-[rgba(8,14,26,0.82)] px-2.5 py-1 text-[10px]"
                        >
                            <div className="flex gap-1 rounded-full px-2 py-1 border border-white/10 bg-white/5 dark:bg-white/10 shrink-0">
                                <span className="w-1 h-1 rounded-full bg-primary" style={{ backgroundColor: character.color }} />
                                <span className="w-1 h-1 rounded-full bg-primary" style={{ backgroundColor: character.color }} />
                            </div>
                            <span className="min-w-0 truncate font-semibold uppercase tracking-tight text-foreground/80 dark:text-white/85">
                                <span style={{ color: character.color }}>{character.name}</span> {status}
                            </span>
                        </motion.div>
                    )
                })}
                {typingUsers.map((userId) => {
                    const character = activeGang.find(c => c.id === userId)
                    if (!character) return null

                    return (
                        <motion.div
                            key={userId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-border/70 bg-card/90 dark:border-white/15 dark:bg-[rgba(8,14,26,0.82)] px-2.5 py-1 text-[10px]"
                        >
                            <div className="flex gap-1 rounded-full px-2 py-1 border border-white/10 bg-white/5 dark:bg-white/10 shrink-0">
                                <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" style={{ backgroundColor: character.color }} />
                                <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" style={{ backgroundColor: character.color }} />
                                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ backgroundColor: character.color }} />
                            </div>
                            <span className="min-w-0 truncate font-semibold uppercase tracking-tight text-foreground/80 dark:text-white/85">
                                <span style={{ color: character.color }}>{character.name}</span> is typing...
                            </span>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
