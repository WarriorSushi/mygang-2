'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Character } from '@/stores/chat-store'

interface TypingIndicatorProps {
    typingUsers: string[]
    activeGang: Character[]
    activityStatuses?: Record<string, string>
    showPersonaRoles?: boolean
}

export function TypingIndicator({ typingUsers, activeGang, activityStatuses = {}, showPersonaRoles = true }: TypingIndicatorProps) {
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
                            className="flex items-center gap-2 text-[10px] text-muted-foreground"
                        >
                            <div className="flex gap-1 bg-white/5 p-1 rounded-full px-2 border border-white/10 shrink-0">
                                <span className="w-1 h-1 rounded-full bg-primary" style={{ backgroundColor: character.color }} />
                                <span className="w-1 h-1 rounded-full bg-primary" style={{ backgroundColor: character.color }} />
                            </div>
                            <span className="font-bold italic uppercase tracking-tighter opacity-80" style={{ color: character.color }}>
                                {character.name}
                                {showPersonaRoles && character.roleLabel ? ` (${character.roleLabel})` : ''} {status}
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
                            className="flex items-center gap-2 text-[10px] text-muted-foreground"
                        >
                            <div className="flex gap-1 bg-white/5 p-1 rounded-full px-2 border border-white/10 shrink-0">
                                <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" style={{ backgroundColor: character.color }} />
                                <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" style={{ backgroundColor: character.color }} />
                                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ backgroundColor: character.color }} />
                            </div>
                            <span className="font-bold italic uppercase tracking-tighter opacity-80" style={{ color: character.color }}>
                                {character.name}
                                {showPersonaRoles && character.roleLabel ? ` (${character.roleLabel})` : ''} is typing...
                            </span>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
