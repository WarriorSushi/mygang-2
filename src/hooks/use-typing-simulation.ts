'use client'

import { useRef, useState } from 'react'
import { useChatStore, type Character } from '@/stores/chat-store'
import { ACTIVITY_STATUSES } from '@/constants/character-greetings'

function pickRandom<T>(items: T[]): T | undefined {
    if (items.length === 0) return undefined
    return items[Math.floor(Math.random() * items.length)]
}

export function useTypingSimulation() {
    const { setCharacterStatus } = useChatStore()

    const [typingUsers, setTypingUsers] = useState<string[]>([])
    const [isFastMode, setIsFastMode] = useState(false)

    const typingUsersRef = useRef<Set<string>>(new Set())
    const typingFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const fastModeRef = useRef({ lastAt: 0, streak: 0 })
    const fastModeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const statusTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})

    const flushTypingUsers = () => {
        typingFlushRef.current = null
        setTypingUsers(Array.from(typingUsersRef.current))
    }

    const scheduleTypingFlush = () => {
        if (typingFlushRef.current) return
        typingFlushRef.current = setTimeout(flushTypingUsers, 120)
    }

    const queueTypingUser = (id: string) => {
        typingUsersRef.current.add(id)
        scheduleTypingFlush()
    }

    const removeTypingUser = (id: string) => {
        typingUsersRef.current.delete(id)
        scheduleTypingFlush()
    }

    const clearTypingUsers = () => {
        typingUsersRef.current.clear()
        if (typingFlushRef.current) {
            clearTimeout(typingFlushRef.current)
            typingFlushRef.current = null
        }
        setTypingUsers([])
    }

    const bumpFastMode = () => {
        const now = Date.now()
        if (now - fastModeRef.current.lastAt < 1400) {
            fastModeRef.current.streak += 1
        } else {
            fastModeRef.current.streak = 1
        }
        fastModeRef.current.lastAt = now
        if (fastModeRef.current.streak >= 2) {
            setIsFastMode(true)
        }
        if (fastModeTimerRef.current) {
            clearTimeout(fastModeTimerRef.current)
        }
        fastModeTimerRef.current = setTimeout(() => {
            setIsFastMode(false)
            fastModeRef.current.streak = 0
        }, 3000)
    }

    const pickStatusFor = (characterId: string): string => {
        if (!characterId) return ACTIVITY_STATUSES[0]
        return pickRandom([...ACTIVITY_STATUSES]) || ACTIVITY_STATUSES[0]
    }

    const pulseStatus = (characterId: string, status: string, duration = 2400) => {
        if (!characterId) return
        setCharacterStatus(characterId, status)
        if (statusTimersRef.current[characterId]) {
            clearTimeout(statusTimersRef.current[characterId]!)
        }
        statusTimersRef.current[characterId] = setTimeout(() => {
            setCharacterStatus(characterId, "")
            statusTimersRef.current[characterId] = null
        }, duration)
    }

    const triggerActivityPulse = () => {
        const activeGang = useChatStore.getState().activeGang
        const available = activeGang.filter((c: Character) => c.id !== 'user')
        const picks = [...available].sort(() => 0.5 - Math.random()).slice(0, Math.min(2, available.length))
        picks.forEach((char: Character, idx: number) => {
            const status = pickStatusFor(char.id)
            pulseStatus(char.id, status, 2200 + idx * 400)
        })
    }

    const triggerReadingStatuses = () => {
        const activeGang = useChatStore.getState().activeGang
        const available = activeGang.filter((c: Character) => c.id !== 'user')
        const picks = [...available].sort(() => 0.5 - Math.random()).slice(0, Math.min(3, available.length))
        picks.forEach((char: Character, idx: number) => {
            const status = pickStatusFor(char.id)
            pulseStatus(char.id, status, 2800 + idx * 500)
        })
    }

    return {
        typingUsers,
        isFastMode,
        queueTypingUser,
        removeTypingUser,
        clearTypingUsers,
        bumpFastMode,
        pulseStatus,
        pickStatusFor,
        triggerActivityPulse,
        triggerReadingStatuses,
        // Expose refs/timers for cleanup
        typingFlushRef,
        fastModeTimerRef,
        statusTimersRef,
    }
}
