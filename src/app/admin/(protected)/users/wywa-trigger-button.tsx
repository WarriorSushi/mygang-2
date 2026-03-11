'use client'

import { useState } from 'react'
import type { WywaResult } from '@/lib/ai/wywa'

type WywaTriggerButtonProps = {
    userId: string
    tier: string
    action: (formData: FormData) => Promise<WywaResult>
}

export function WywaTriggerButton({ userId, tier, action }: WywaTriggerButtonProps) {
    const [state, setState] = useState<'idle' | 'confirming' | 'running' | 'done'>('idle')
    const [result, setResult] = useState<string | null>(null)

    const isPaid = tier === 'basic' || tier === 'pro'

    async function handleConfirm() {
        setState('running')
        setResult(null)
        try {
            const formData = new FormData()
            formData.set('userId', userId)
            const res = await action(formData)
            setResult(res.status === 'generated'
                ? `Generated ${res.messagesWritten} messages`
                : res.status === 'error'
                    ? `Error: ${'message' in res ? res.message : 'unknown'}`
                    : res.status.replace(/_/g, ' ')
            )
        } catch (err) {
            setResult(`Failed: ${err instanceof Error ? err.message : 'unknown'}`)
        } finally {
            setState('done')
            setTimeout(() => {
                setState('idle')
                setResult(null)
            }, 5000)
        }
    }

    if (!isPaid) return null

    if (state === 'running') {
        return (
            <div className="w-full rounded-xl border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100/70">
                Running WYWA...
            </div>
        )
    }

    if (state === 'done' && result) {
        return (
            <div className="w-full rounded-xl border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-center text-[11px] font-semibold tracking-[0.14em] text-violet-100">
                {result}
            </div>
        )
    }

    if (state === 'confirming') {
        return (
            <div className="flex gap-1">
                <button
                    type="button"
                    onClick={handleConfirm}
                    className="flex-1 rounded-xl border border-violet-300/50 bg-violet-500/25 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100 transition-colors hover:bg-violet-500/35"
                >
                    Confirm WYWA
                </button>
                <button
                    type="button"
                    onClick={() => setState('idle')}
                    className="rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:bg-white/10"
                >
                    Cancel
                </button>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={() => setState('confirming')}
            className="w-full rounded-xl border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100 transition-colors hover:bg-violet-400/16"
        >
            Trigger WYWA
        </button>
    )
}
