'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useChatStore, type Message } from '@/stores/chat-store'
import { useShallow } from 'zustand/react/shallow'
import { CHARACTER_GREETINGS } from '@/constants/character-greetings'

function pickRandom<T>(items: T[]): T | undefined {
    if (items.length === 0) return undefined
    return items[Math.floor(Math.random() * items.length)]
}

export function hasOpenFloorIntent(text: string) {
    const value = text.toLowerCase()
    return (
        /you guys talk|talk among yourselves|keep chatting|continue without me|i'?ll listen|i will listen/.test(value)
        || /just talk|carry on|keep going|go on without me/.test(value)
    )
}

interface UseAutonomousFlowArgs {
    isGeneratingRef: React.RefObject<boolean>
    pendingUserMessagesRef: React.RefObject<boolean>
    sendToApiRef: React.RefObject<(args: {
        isIntro: boolean
        isAutonomous: boolean
        autonomousIdle?: boolean
        sourceUserMessageId?: string | null
    }) => Promise<void>>
    lastUserMessageIdRef: React.RefObject<string | null>
    autoLowCostModeRef: React.RefObject<boolean>
    autonomousBackoffUntilRef: React.MutableRefObject<number>
    silentTurnsRef: React.RefObject<number>
    burstCountRef: React.RefObject<number>
    idleAutoCountRef: React.MutableRefObject<number>
    queueTypingUser: (id: string) => void
    removeTypingUser: (id: string) => void
    pulseStatus: (characterId: string, status: string, duration?: number) => void
    pickStatusFor: (characterId: string) => string
    initialGreetingRef: React.MutableRefObject<boolean>
}

export function useAutonomousFlow({
    isGeneratingRef,
    pendingUserMessagesRef,
    sendToApiRef,
    lastUserMessageIdRef,
    autoLowCostModeRef,
    autonomousBackoffUntilRef,
    silentTurnsRef,
    burstCountRef,
    idleAutoCountRef,
    queueTypingUser,
    removeTypingUser,
    pulseStatus,
    pickStatusFor,
    initialGreetingRef,
}: UseAutonomousFlowArgs) {
    const {
        activeGang,
        messages,
        userId,
        isHydrated,
        chatMode,
    } = useChatStore(useShallow((s) => ({
        activeGang: s.activeGang,
        messages: s.messages,
        userId: s.userId,
        isHydrated: s.isHydrated,
        chatMode: s.chatMode,
    })))

    const resumeAutonomousTriggeredRef = useRef(false)
    const idleAutonomousTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const greetingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const triggerLocalGreetingRef = useRef<() => void>(() => { })

    const scheduleGreeting = (fn: () => void, delay: number) => {
        const timer = setTimeout(fn, delay)
        greetingTimersRef.current.push(timer)
    }

    const clearIdleAutonomousTimer = useCallback(() => {
        if (idleAutonomousTimerRef.current) {
            clearTimeout(idleAutonomousTimerRef.current)
            idleAutonomousTimerRef.current = null
        }
    }, [])

    const canRunIdleAutonomous = useCallback(() => {
        if (useChatStore.getState().lowCostMode || autoLowCostModeRef.current) return false
        if (useChatStore.getState().chatMode !== 'ecosystem') return false
        if (Date.now() < autonomousBackoffUntilRef.current) return false
        if (typeof document !== 'undefined') {
            if (document.visibilityState !== 'visible') return false
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) return false
        return true
    }, [autoLowCostModeRef, autonomousBackoffUntilRef])

    const scheduleIdleAutonomous = useCallback((sourceUserMessageId: string | null) => {
        if (!sourceUserMessageId) return
        if (!canRunIdleAutonomous()) return
        if (idleAutoCountRef.current >= 1) return

        clearIdleAutonomousTimer()
        const delay = 15000 + idleAutoCountRef.current * 8000
        idleAutonomousTimerRef.current = setTimeout(() => {
            const currentMessages = useChatStore.getState().messages
            const lastMessage = currentMessages[currentMessages.length - 1]
            const stillSameUserMessage = lastUserMessageIdRef.current === sourceUserMessageId
            if (!stillSameUserMessage) return
            if (!canRunIdleAutonomous()) return
            if (!lastMessage || lastMessage.speaker === 'user') return
            if (isGeneratingRef.current || pendingUserMessagesRef.current) return

            idleAutoCountRef.current += 1
            sendToApiRef.current({
                isIntro: false,
                isAutonomous: true,
                autonomousIdle: true,
                sourceUserMessageId,
            }).catch((err) => console.error('Idle autonomous error:', err))
        }, delay)
    }, [canRunIdleAutonomous, clearIdleAutonomousTimer, idleAutoCountRef, isGeneratingRef, lastUserMessageIdRef, pendingUserMessagesRef, sendToApiRef])

    const triggerLocalGreeting = useCallback(() => {
        if (initialGreetingRef.current) return
        const state = useChatStore.getState()
        if (state.activeGang.length === 0 || state.messages.length > 0) return
        initialGreetingRef.current = true

        const nameLabel = state.userNickname || state.userName || 'friend'
        const speakers = [...state.activeGang].sort(() => 0.5 - Math.random()).slice(0, Math.min(3, state.activeGang.length))
        let delay = 200

        speakers.forEach((char) => {
            scheduleGreeting(() => {
                const hasUserMessage = useChatStore.getState().messages.some((m: Message) => m.speaker === 'user')
                if (hasUserMessage) return
                queueTypingUser(char.id)
                pulseStatus(char.id, pickStatusFor(char.id), 1600)
                const line = (pickRandom(CHARACTER_GREETINGS[char.id] || [`Hey ${nameLabel}, what should we talk about?`]) || `Hey ${nameLabel}, what should we talk about?`)
                    .replace('{name}', nameLabel)

                scheduleGreeting(() => {
                    removeTypingUser(char.id)
                    const store = useChatStore.getState()
                    store.setCharacterStatus(char.id, "")
                    const stillNoUserMessage = useChatStore.getState().messages.every((m: Message) => m.speaker !== 'user')
                    if (!stillNoUserMessage) return
                    store.addMessage({
                        id: `local-${char.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        speaker: char.id,
                        content: line,
                        created_at: new Date().toISOString(),
                    })
                }, 700 + Math.random() * 600)
            }, delay)
            delay += 900 + Math.random() * 700
        })
    }, [initialGreetingRef, pickStatusFor, pulseStatus, queueTypingUser, removeTypingUser])

    triggerLocalGreetingRef.current = triggerLocalGreeting

    // Resume autonomous for returning users with open-floor intent
    useEffect(() => {
        if (!isHydrated || !userId) return
        if (chatMode !== 'ecosystem') return
        if (resumeAutonomousTriggeredRef.current) return
        if (messages.length === 0) return
        if (!canRunIdleAutonomous()) return

        const lastMessage = messages[messages.length - 1]
        const lastAt = lastMessage?.created_at ? new Date(lastMessage.created_at).getTime() : 0
        const gapMs = lastAt ? Date.now() - lastAt : 0
        if (gapMs < 3 * 60 * 1000) {
            resumeAutonomousTriggeredRef.current = true
            return
        }

        const lastUserMessage = [...messages].reverse().find((m: Message) => m.speaker === 'user')
        const openFloorRequested = !!lastUserMessage?.content && hasOpenFloorIntent(lastUserMessage.content)
        if (!openFloorRequested) {
            resumeAutonomousTriggeredRef.current = true
            return
        }
        resumeAutonomousTriggeredRef.current = true
        const timer = setTimeout(() => {
            if (isGeneratingRef.current || pendingUserMessagesRef.current) return
            sendToApiRef.current({
                isIntro: false,
                isAutonomous: true,
                sourceUserMessageId: lastUserMessage?.id ?? null,
            })
        }, 700)
        return () => clearTimeout(timer)
    }, [canRunIdleAutonomous, chatMode, isHydrated, messages, userId, isGeneratingRef, pendingUserMessagesRef, sendToApiRef])

    // Initial greeting for first-time sessions
    useEffect(() => {
        const allowGreeting = !userId || useChatStore.getState().messages.length === 0
        if (activeGang.length > 0 && messages.length === 0 && !initialGreetingRef.current && allowGreeting) {
            triggerLocalGreetingRef.current()
        }
    }, [activeGang.length, initialGreetingRef, messages.length, userId])

    return {
        greetingTimersRef,
        idleAutonomousTimerRef,
        clearIdleAutonomousTimer,
        canRunIdleAutonomous,
        scheduleIdleAutonomous,
        triggerLocalGreeting,
        triggerLocalGreetingRef,
    }
}
