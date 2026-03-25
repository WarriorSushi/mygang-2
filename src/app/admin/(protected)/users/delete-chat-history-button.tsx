'use client'

import { useRef, useState } from 'react'

type DeleteChatHistoryButtonProps = {
    userId: string
    returnTo: string
    action: (formData: FormData) => Promise<void>
}

export function DeleteChatHistoryButton({ userId, returnTo, action }: DeleteChatHistoryButtonProps) {
    const [confirming, setConfirming] = useState(false)
    const formRef = useRef<HTMLFormElement>(null)

    function handleClick() {
        if (!confirming) {
            setConfirming(true)
            return
        }
        // Second click = confirmed, submit the form
        formRef.current?.requestSubmit()
    }

    function handleCancel() {
        setConfirming(false)
    }

    return (
        <form ref={formRef} action={action}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="userId" value={userId} />
            {confirming ? (
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={handleClick}
                        className="flex-1 rounded-xl border border-rose-300/50 bg-rose-500/25 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-100 transition-colors hover:bg-rose-500/35"
                    >
                        Confirm Delete
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300 transition-colors hover:bg-white/10"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={handleClick}
                    className="w-full rounded-xl border border-rose-300/30 bg-rose-500/12 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-100 transition-colors hover:bg-rose-500/20"
                >
                    Delete Chat History
                </button>
            )}
        </form>
    )
}
