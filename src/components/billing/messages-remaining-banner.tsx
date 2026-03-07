'use client'

import { useChatStore } from '@/stores/chat-store'
import { useShallow } from 'zustand/react/shallow'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { getTierCopy } from '@/lib/billing'

export function MessagesRemainingBanner() {
    const { messagesRemaining, subscriptionTier } = useChatStore(useShallow((s) => ({
        messagesRemaining: s.messagesRemaining,
        subscriptionTier: s.subscriptionTier,
    })))

    // Only show for free/basic tiers when messages remaining is low (< 5)
    if (subscriptionTier === 'pro') return null
    if (messagesRemaining === null || messagesRemaining === undefined) return null
    if (messagesRemaining >= 5) return null

    const tierLabel = getTierCopy(subscriptionTier)
    const tierWindow = 'this hour'
    const urgencyColor = messagesRemaining <= 2
        ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'

    return (
        <div className={`mx-3 sm:mx-0 mb-2 rounded-xl border px-3 py-2 flex items-center gap-2 ${urgencyColor}`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] font-medium flex-1">
                {messagesRemaining === 0
                    ? `No messages remaining ${tierWindow} on ${tierLabel.label.toLowerCase()}`
                    : `${messagesRemaining} message${messagesRemaining === 1 ? '' : 's'} remaining ${tierWindow} on ${tierLabel.label.toLowerCase()}`
                }
            </span>
            <Link
                href="/pricing?upgrade=pro"
                className="text-[10px] font-bold uppercase tracking-wider hover:underline shrink-0"
            >
                Upgrade
            </Link>
        </div>
    )
}
