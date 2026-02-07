'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Character } from '@/stores/chat-store'
import { useTheme } from 'next-themes'

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

function ensureReadablePersonaNameOnLight(color: Rgb) {
    const lightBackdrop: Rgb = { r: 236, g: 242, b: 248 }
    const darkTarget: Rgb = { r: 8, g: 14, b: 28 }
    for (let ratio = 0; ratio <= 0.92; ratio += 0.08) {
        const candidate = mixRgb(color, darkTarget, ratio)
        if (contrastRatio(candidate, lightBackdrop) >= 4.8) {
            return candidate
        }
    }
    return mixRgb(color, darkTarget, 0.78)
}

interface TypingIndicatorProps {
    typingUsers: string[]
    activeGang: Character[]
    activityStatuses?: Record<string, string>
}

export function TypingIndicator({ typingUsers, activeGang, activityStatuses = {} }: TypingIndicatorProps) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'
    const activityEntries = Object.entries(activityStatuses).filter(([id, status]) => status && !typingUsers.includes(id))
    return (
        <div className="flex flex-col gap-1.5 ml-2">
            <AnimatePresence>
                {activityEntries.map(([userId, status]) => {
                    const character = activeGang.find(c => c.id === userId)
                    if (!character) return null
                    const baseRgb = parseColorToRgb(character.color)
                    const nameColor = isDark ? baseRgb : ensureReadablePersonaNameOnLight(baseRgb)

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
                                <span style={{ color: toRgbString(nameColor) }}>{character.name}</span> {status}
                            </span>
                        </motion.div>
                    )
                })}
                {typingUsers.map((userId) => {
                    const character = activeGang.find(c => c.id === userId)
                    if (!character) return null
                    const baseRgb = parseColorToRgb(character.color)
                    const nameColor = isDark ? baseRgb : ensureReadablePersonaNameOnLight(baseRgb)

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
                                <span style={{ color: toRgbString(nameColor) }}>{character.name}</span> is typing...
                            </span>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
