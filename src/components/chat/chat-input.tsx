'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowRight, X } from 'lucide-react'

interface ReplyTarget {
    id: string
    speaker: string
    content: string
}

interface ChatInputProps {
    onSend: (message: string, options?: { replyToId?: string }) => void
    disabled?: boolean
    online?: boolean
    replyingTo?: ReplyTarget | null
    onCancelReply?: () => void
}

const DRAFT_STORAGE_KEY = 'mygang-chat-draft'
const MAX_CHARS = 2000

export function ChatInput({ onSend, disabled, online = true, replyingTo = null, onCancelReply }: ChatInputProps) {
    const [input, setInput] = useState(() => {
        if (typeof window === 'undefined') return ''
        const savedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY)
        return savedDraft ? savedDraft.slice(0, MAX_CHARS) : ''
    })
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const limitWarnedRef = useRef(false)

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (input.trim()) {
            window.localStorage.setItem(DRAFT_STORAGE_KEY, input)
        } else {
            window.localStorage.removeItem(DRAFT_STORAGE_KEY)
        }
    }, [input])

    useEffect(() => {
        const textarea = inputRef.current
        if (!textarea) return
        textarea.style.height = '0px'
        const nextHeight = Math.min(textarea.scrollHeight, 160)
        textarea.style.height = `${nextHeight}px`
    }, [input])

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (input.trim() && !disabled) {
            onSend(input, { replyToId: replyingTo?.id })
            setInput('')
            onCancelReply?.()
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(DRAFT_STORAGE_KEY)
            }
        }
    }

    const handleInputChange = (nextValue: string) => {
        if (nextValue.length > MAX_CHARS) {
            const clipped = nextValue.slice(0, MAX_CHARS)
            setInput(clipped)
            if (!limitWarnedRef.current) {
                limitWarnedRef.current = true
                window.alert('Message limit is 2000 characters.')
            }
            return
        }
        limitWarnedRef.current = false
        setInput(nextValue)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className="px-3 sm:px-0 pt-1 sm:pt-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] sm:pb-0 z-20">
            {replyingTo && (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-border/70 bg-card/85 dark:bg-[rgba(15,23,42,0.82)] px-3 py-2">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-foreground/70 dark:text-white/75">Replying to {replyingTo.speaker === 'user' ? 'You' : replyingTo.speaker}</p>
                        <p className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-foreground/85 dark:text-white/90">{replyingTo.content}</p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="shrink-0 rounded-full"
                        onClick={() => onCancelReply?.()}
                        aria-label="Cancel reply"
                    >
                        <X size={14} />
                    </Button>
                </div>
            )}
            <form
                onSubmit={handleSubmit}
                className="relative flex items-end gap-2 border border-border/70 bg-card/95 dark:bg-[rgba(16,24,40,0.86)] p-2 px-3 rounded-2xl shadow-none sm:shadow-sm transition-colors focus-within:border-primary/60"
            >
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    data-testid="chat-input"
                    placeholder={online ? 'Send a message...' : 'You are offline. Reconnect to send.'}
                    className="flex-1 bg-transparent border-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 appearance-none resize-none px-1 py-2.5 text-[16px] md:text-[15px] leading-6 max-h-32 min-h-[44px] scrollbar-hide"
                    rows={1}
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || disabled}
                    data-testid="chat-send"
                    className="shrink-0 self-center rounded-xl w-11 h-11 mb-0 active:scale-95 transition-transform shadow-none"
                >
                    <ArrowRight size={18} />
                </Button>
            </form>
        </div>
    )
}
