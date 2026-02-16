'use client'

import { memo } from 'react'
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

interface TypingIndicatorProps {
    typingUsers: string[]
    activeGang: Character[]
    activityStatuses?: Record<string, string>
}

export const TypingIndicator = memo(function TypingIndicator({ typingUsers, activeGang, activityStatuses = {} }: TypingIndicatorProps) {
    const { theme, resolvedTheme } = useTheme()
    const isDark = (resolvedTheme ?? theme ?? 'dark') === 'dark'
    const activityEntries = Object.entries(activityStatuses).filter(([id, status]) => status && !typingUsers.includes(id))

    return (
        <div className="flex flex-col gap-1 ml-1">
            <AnimatePresence>
                {activityEntries.map(([userId, status]) => {
                    const character = activeGang.find(c => c.id === userId)
                    if (!character) return null
                    const baseRgb = parseColorToRgb(character.color)
                    const nameColor = isDark ? baseRgb : ensureReadablePersonaNameOnLight(baseRgb)

                    return (
                        <motion.div
                            key={`${userId}-status`}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="inline-flex w-fit max-w-full items-center gap-2 px-2 py-1 text-[11px]"
                        >
                            <div className="flex gap-[3px] shrink-0">
                                <span className="w-[5px] h-[5px] rounded-full opacity-60" style={{ backgroundColor: character.color }} />
                                <span className="w-[5px] h-[5px] rounded-full opacity-60" style={{ backgroundColor: character.color }} />
                            </div>
                            <span className="min-w-0 truncate text-muted-foreground/60">
                                <span className="font-medium" style={{ color: toRgbString(nameColor) }}>{character.name}</span>
                                {' '}{status}
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
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="inline-flex w-fit max-w-full items-center gap-2 px-2 py-1 text-[11px]"
                        >
                            <div className="flex gap-[3px] shrink-0">
                                <span className="w-[5px] h-[5px] rounded-full animate-bounce [animation-delay:-0.3s]" style={{ backgroundColor: character.color }} />
                                <span className="w-[5px] h-[5px] rounded-full animate-bounce [animation-delay:-0.15s]" style={{ backgroundColor: character.color }} />
                                <span className="w-[5px] h-[5px] rounded-full animate-bounce" style={{ backgroundColor: character.color }} />
                            </div>
                            <span className="min-w-0 truncate text-muted-foreground/60">
                                <span className="font-medium" style={{ color: toRgbString(nameColor) }}>{character.name}</span>
                                {' '}is typing\u2026
                            </span>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
})
