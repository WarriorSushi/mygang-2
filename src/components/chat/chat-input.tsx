'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send, X } from 'lucide-react'

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] bg-background/60 backdrop-blur-md z-20 border-t border-border/60">
            {replyingTo && (
                <div className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Replying to {replyingTo.speaker === 'user' ? 'You' : replyingTo.speaker}</p>
                        <p className="truncate text-xs">{replyingTo.content}</p>
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
                className="relative flex items-end gap-2 bg-card/85 border border-border/70 p-2 px-3 rounded-2xl shadow-sm transition-colors focus-within:border-primary/60"
            >
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    data-testid="chat-input"
                    placeholder={online ? 'Send a message...' : 'You are offline. Reconnect to send.'}
                    maxLength={MAX_CHARS}
                    className="flex-1 bg-transparent border-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 appearance-none resize-none py-3 px-1 text-[14px] sm:text-[15px] max-h-32 min-h-[44px] scrollbar-hide"
                    rows={1}
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || disabled}
                    data-testid="chat-send"
                    className="shrink-0 rounded-xl w-10 h-10 mb-1 active:scale-95 transition-transform shadow-none"
                >
                    <Send size={18} />
                </Button>
            </form>
            <div className="mt-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-widest text-muted-foreground/60">
                <span className="hidden sm:inline">Enter to send - Shift+Enter newline</span>
                <span>{input.length}/{MAX_CHARS}</span>
            </div>
        </div>
    )
}
