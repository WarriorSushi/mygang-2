'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    pendingText?: string
}

export function SubmitButton({ children, className, pendingText, ...props }: SubmitButtonProps) {
    const { pending } = useFormStatus()

    return (
        <button
            {...props}
            type="submit"
            disabled={pending || props.disabled}
            className={cn(
                'relative transition-all active:scale-[0.96] active:brightness-90 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100',
                className
            )}
        >
            {pending ? (
                <span className="flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin shrink-0" />
                    {pendingText ?? children}
                </span>
            ) : children}
        </button>
    )
}
