'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/stores/chat-store'

const BASE_TITLE = 'MyGang.ai'

/**
 * Count unseen incoming messages (non-user) that arrived after a cutoff timestamp.
 * Pure helper — exported for testing.
 */
export function countUnseenMessages(
    messages: Message[],
    seenCutoffTimestamp: number,
): number {
    let count = 0
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.speaker === 'user') continue
        const ts = new Date(m.created_at).getTime()
        if (!Number.isFinite(ts) || ts <= seenCutoffTimestamp) break
        count++
    }
    return count
}

/**
 * Build the document title string from an unread count.
 * Pure helper — exported for testing.
 */
export function buildPresenceTitle(unreadCount: number): string {
    if (unreadCount <= 0) return BASE_TITLE
    return `(${unreadCount}) ${BASE_TITLE}`
}

/**
 * Hook: updates document.title with unseen message count while the tab is hidden.
 * Clears the count when the tab regains focus/visibility.
 */
export function useTabPresence(messages: Message[]) {
    // Tracks the timestamp when the user last "saw" the chat (tab visible + focused)
    const seenCutoffRef = useRef(Date.now())
    const isHiddenRef = useRef(false)

    // On focus/visibility return: mark everything as seen
    useEffect(() => {
        const markSeen = () => {
            isHiddenRef.current = false
            seenCutoffRef.current = Date.now()
            document.title = BASE_TITLE
        }

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                markSeen()
            } else {
                isHiddenRef.current = true
                // Snapshot the current "seen" watermark when leaving
                seenCutoffRef.current = Date.now()
            }
        }

        const handleFocus = () => markSeen()

        document.addEventListener('visibilitychange', handleVisibility)
        window.addEventListener('focus', handleFocus)

        // Set initial state
        if (document.visibilityState === 'hidden') {
            isHiddenRef.current = true
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility)
            window.removeEventListener('focus', handleFocus)
            document.title = BASE_TITLE
        }
    }, [])

    // Recalculate title whenever messages change while tab is hidden
    useEffect(() => {
        if (!isHiddenRef.current) return
        const unseen = countUnseenMessages(messages, seenCutoffRef.current)
        document.title = buildPresenceTitle(unseen)
    }, [messages])
}
