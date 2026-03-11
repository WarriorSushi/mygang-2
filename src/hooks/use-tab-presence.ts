'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/stores/chat-store'

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
 * Build the document title string from an unread count and the original page title.
 * Pure helper — exported for testing.
 */
export function buildPresenceTitle(unreadCount: number, baseTitle: string): string {
    if (unreadCount <= 0) return baseTitle
    return `(${unreadCount}) ${baseTitle}`
}

/**
 * Hook: updates document.title with unseen message count while the tab is hidden.
 * Clears the count when the tab regains focus/visibility.
 *
 * Captures the current document.title on mount and restores it when clearing.
 */
export function useTabPresence(messages: Message[]) {
    // Tracks the timestamp when the user last "saw" the chat (tab visible + focused)
    const seenCutoffRef = useRef(Date.now())
    const isHiddenRef = useRef(false)
    // Capture the page title that was set before this hook touched it
    const baseTitleRef = useRef('')

    // On focus/visibility return: mark everything as seen
    useEffect(() => {
        // Snapshot the current title on mount (set by Next metadata)
        baseTitleRef.current = document.title

        const markSeen = () => {
            isHiddenRef.current = false
            seenCutoffRef.current = Date.now()
            document.title = baseTitleRef.current
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
            document.title = baseTitleRef.current
        }
    }, [])

    // Recalculate title whenever messages change while tab is hidden
    useEffect(() => {
        if (!isHiddenRef.current) return
        const unseen = countUnseenMessages(messages, seenCutoffRef.current)
        document.title = buildPresenceTitle(unseen, baseTitleRef.current)
    }, [messages])
}
