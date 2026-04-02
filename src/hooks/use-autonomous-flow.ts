'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useChatStore, type Message } from '@/stores/chat-store'
import { useShallow } from 'zustand/react/shallow'
import { getCharacterGreetingOptions, type GreetingBeat } from '../constants/character-greetings'
import { hasOpenFloorIntent } from '@/lib/chat-utils'
import type { HistoryStatus } from '@/hooks/use-chat-history'
import type { PendingArrivalContext } from '@/lib/chat-arrival'
import { pickRandom } from '@/lib/utils'

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
    idleAutoCountRef: React.MutableRefObject<number>
    queueTypingUser: (id: string) => void
    removeTypingUser: (id: string) => void
    pulseStatus: (characterId: string, status: string, duration?: number) => void
    pickStatusFor: (characterId: string) => string
    initialGreetingRef: React.MutableRefObject<boolean>
    historyBootstrapDone: boolean
    historyStatus: HistoryStatus
    arrivalContext: PendingArrivalContext | null
}

export function useAutonomousFlow({
    isGeneratingRef,
    pendingUserMessagesRef,
    sendToApiRef,
    lastUserMessageIdRef,
    autoLowCostModeRef,
    autonomousBackoffUntilRef,
    idleAutoCountRef,
    queueTypingUser,
    removeTypingUser,
    pulseStatus,
    pickStatusFor,
    initialGreetingRef,
    historyBootstrapDone,
    historyStatus,
    arrivalContext,
}: UseAutonomousFlowArgs) {
    const {
        activeGang,
        messageCount,
        userId,
        isHydrated,
        chatMode,
    } = useChatStore(useShallow((s) => ({
        activeGang: s.activeGang,
        messageCount: s.messages.length,
        userId: s.userId,
        isHydrated: s.isHydrated,
        chatMode: s.chatMode,
    })))

    const resumeAutonomousTriggeredRef = useRef(false)
    const idleAutonomousTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const greetingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const triggerLocalGreetingRef = useRef<() => void>(() => { })
    const isMountedRef = useRef(true)
    const totalAutoCallsRef = useRef(0)
    const MAX_SESSION_AUTO_CALLS = 15

    const getGreetingBeatOrder = useCallback((count: number, isFreshArrival: boolean): GreetingBeat[] => {
        if (count <= 1) return ['solo_open']
        return isFreshArrival
            ? ['warm_open', 'riff']
            : ['warm_open', 'useful_question']
    }, [])

    const getGreetingLeadDelay = useCallback((beat: GreetingBeat) => {
        switch (beat) {
            case 'warm_open':
                return 220 + Math.random() * 140
            case 'riff':
                return 480 + Math.random() * 220
            case 'useful_question':
                return 680 + Math.random() * 260
            case 'solo_open':
            default:
                return 260 + Math.random() * 180
        }
    }, [])

    const getGreetingTypingDelay = useCallback((beat: GreetingBeat) => {
        switch (beat) {
            case 'warm_open':
                return 820 + Math.random() * 260
            case 'riff':
                return 560 + Math.random() * 220
            case 'useful_question':
                return 940 + Math.random() * 280
            case 'solo_open':
            default:
                return 900 + Math.random() * 260
        }
    }, [])

    const scheduleGreeting = (fn: () => void, delay: number) => {
        const timer = setTimeout(() => {
            if (!isMountedRef.current) return
            fn()
        }, delay)
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
        const delay = 10_000
        const ecosystemSpeed = useChatStore.getState().ecosystemSpeed || 'normal'
        const speedMultiplier = ecosystemSpeed === 'fast' ? 0.5 : ecosystemSpeed === 'relaxed' ? 2 : 1
        idleAutonomousTimerRef.current = setTimeout(() => {
            const currentMessages = useChatStore.getState().messages
            const lastMessage = currentMessages[currentMessages.length - 1]
            const stillSameUserMessage = lastUserMessageIdRef.current === sourceUserMessageId
            if (!stillSameUserMessage) return
            if (!canRunIdleAutonomous()) return
            if (!lastMessage || lastMessage.speaker === 'user') return
            if (isGeneratingRef.current || pendingUserMessagesRef.current) return

            if (totalAutoCallsRef.current >= MAX_SESSION_AUTO_CALLS) return
            totalAutoCallsRef.current += 1
            idleAutoCountRef.current += 1
            sendToApiRef.current({
                isIntro: false,
                isAutonomous: true,
                autonomousIdle: true,
                sourceUserMessageId,
            }).catch((err) => console.error('Idle autonomous error:', err))
        }, delay * speedMultiplier)
    }, [canRunIdleAutonomous, clearIdleAutonomousTimer, idleAutoCountRef, isGeneratingRef, lastUserMessageIdRef, pendingUserMessagesRef, sendToApiRef])

    const triggerLocalGreeting = useCallback(() => {
        if (!isMountedRef.current) return
        if (initialGreetingRef.current) return
        if (!historyBootstrapDone || historyStatus !== 'empty') return
        const state = useChatStore.getState()
        if (state.activeGang.length === 0 || state.messages.length > 0) return
        initialGreetingRef.current = true

        const nameLabel = arrivalContext?.userName || state.userNickname || state.userName || 'friend'
        const speakers = arrivalContext
            ? state.activeGang.slice(0, Math.min(2, state.activeGang.length))
            : [...state.activeGang].sort(() => 0.5 - Math.random()).slice(0, Math.min(2, state.activeGang.length))
        const beatOrder = getGreetingBeatOrder(speakers.length, Boolean(arrivalContext))
        let delay = arrivalContext ? 760 : 180

        speakers.forEach((char, index) => {
            const beat = beatOrder[Math.min(index, beatOrder.length - 1)] || 'solo_open'
            scheduleGreeting(() => {
                const hasUserMessage = useChatStore.getState().messages.some((m: Message) => m.speaker === 'user')
                if (hasUserMessage) return
                queueTypingUser(char.id)
                pulseStatus(char.id, pickStatusFor(char.id), 1600)
                const customNames = useChatStore.getState().customCharacterNames || {}
                let line = (pickRandom(getCharacterGreetingOptions(char.id, beat)) || `Hey ${nameLabel}, what should we talk about?`)
                    .replace('{name}', nameLabel)
                // Replace original character name with custom name if user renamed the character
                if (customNames[char.id] && char.name && customNames[char.id] !== char.name) {
                    line = line.replace(new RegExp(char.name, 'gi'), customNames[char.id])
                }

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
                }, getGreetingTypingDelay(beat))
            }, delay)
            delay += getGreetingLeadDelay(beat)
        })
    }, [arrivalContext, getGreetingBeatOrder, getGreetingLeadDelay, getGreetingTypingDelay, historyBootstrapDone, historyStatus, initialGreetingRef, pickStatusFor, pulseStatus, queueTypingUser, removeTypingUser])

    useEffect(() => {
        triggerLocalGreetingRef.current = triggerLocalGreeting
    }, [triggerLocalGreetingRef, triggerLocalGreeting])

    // Resume autonomous for returning users with open-floor intent
    useEffect(() => {
        if (!isHydrated || !userId) return
        if (!historyBootstrapDone || historyStatus !== 'has_history') return
        if (chatMode !== 'ecosystem') return
        if (resumeAutonomousTriggeredRef.current) return
        if (messageCount === 0) return
        if (!canRunIdleAutonomous()) return

        const messages = useChatStore.getState().messages
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
            if (totalAutoCallsRef.current >= MAX_SESSION_AUTO_CALLS) return
            totalAutoCallsRef.current += 1
            sendToApiRef.current({
                isIntro: false,
                isAutonomous: true,
                sourceUserMessageId: lastUserMessage?.id ?? null,
            })
        }, 700)
        return () => clearTimeout(timer)
    }, [canRunIdleAutonomous, chatMode, historyBootstrapDone, historyStatus, isHydrated, messageCount, userId, isGeneratingRef, pendingUserMessagesRef, sendToApiRef])

    // Initial greeting for first-time sessions
    useEffect(() => {
        if (!historyBootstrapDone || historyStatus !== 'empty') return
        if (activeGang.length > 0 && messageCount === 0 && !initialGreetingRef.current) {
            triggerLocalGreetingRef.current()
        }
    }, [activeGang.length, historyBootstrapDone, historyStatus, initialGreetingRef, messageCount])

    // Cleanup: cancel all greeting timers on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false
            greetingTimersRef.current.forEach(clearTimeout)
            greetingTimersRef.current = []
            if (idleAutonomousTimerRef.current) {
                clearTimeout(idleAutonomousTimerRef.current)
                idleAutonomousTimerRef.current = null
            }
        }
    }, [])

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
