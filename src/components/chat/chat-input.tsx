'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AiDisclaimer } from '@/components/chat/ai-disclaimer'
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
    starterChips?: string[]
    cooldownPlaceholder?: string | null
}

const DRAFT_STORAGE_KEY = 'mygang-chat-draft'
const MAX_CHARS = 2000

export const ChatInput = memo(function ChatInput({ onSend, disabled, online = true, replyingTo = null, onCancelReply, starterChips = [], cooldownPlaceholder }: ChatInputProps) {
    const [input, setInput] = useState('')
    const draftLoadedRef = useRef(false)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const limitWarnedRef = useRef(false)
    const [limitNotice, setLimitNotice] = useState(false)
    // P-I4: Debounce ref for localStorage draft saves
    const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const sendThrottleRef = useRef(false)

    // Restore draft from localStorage after mount (avoids hydration mismatch)
    useEffect(() => {
        if (draftLoadedRef.current) return
        draftLoadedRef.current = true
        const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY)
        if (saved) setInput(saved.slice(0, MAX_CHARS))
    }, [])

    // P-I4: Debounce localStorage draft save (500ms)
    useEffect(() => {
        if (!draftLoadedRef.current) return
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
        draftSaveTimerRef.current = setTimeout(() => {
            if (input.trim()) {
                window.localStorage.setItem(DRAFT_STORAGE_KEY, input)
            } else {
                window.localStorage.removeItem(DRAFT_STORAGE_KEY)
            }
        }, 500)
        return () => {
            if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
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
        if (input.trim() && !disabled && !sendThrottleRef.current) {
            sendThrottleRef.current = true
            setTimeout(() => { sendThrottleRef.current = false }, 800)
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
                setLimitNotice(true)
            }
            return
        }
        limitWarnedRef.current = false
        if (limitNotice) setLimitNotice(false)
        setInput(nextValue)
    }

    useEffect(() => {
        if (!limitNotice) return
        const timer = setTimeout(() => setLimitNotice(false), 2600)
        return () => clearTimeout(timer)
    }, [limitNotice])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className="px-3 sm:px-0 pt-1 sm:pt-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] sm:pb-0 z-20 max-w-[960px] mx-auto w-full">
            {replyingTo && (
                <div role="status" aria-live="polite" className="mb-2 flex items-start justify-between gap-2 rounded-xl border border-border/50 bg-card/90 px-3 py-2">
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
            {starterChips.length > 0 && (
                <div className="mb-2 flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                    {starterChips.map((chip, index) => (
                        <button
                            key={chip}
                            type="button"
                            data-testid={`starter-chip-${index}`}
                            onClick={() => {
                                if (sendThrottleRef.current) return
                                sendThrottleRef.current = true
                                setTimeout(() => { sendThrottleRef.current = false }, 800)
                                onSend(chip)
                            }}
                            className="shrink-0 px-3.5 py-2 rounded-full text-xs font-medium border border-border/50 bg-card/80 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            )}
            <form
                onSubmit={handleSubmit}
                className="chat-input-desktop relative flex items-end gap-2 border border-border/40 bg-card/95 p-2 px-3 rounded-[22px] shadow-none sm:shadow-sm transition-colors focus-within:border-primary/40"
            >
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={MAX_CHARS}
                    data-testid="chat-input"
                    aria-label="Message input"
                    aria-required="true"
                    aria-describedby={input.length > 1500 ? 'char-counter' : undefined}
                    enterKeyHint="send"
                    autoComplete="off"
                    placeholder={cooldownPlaceholder || (online ? 'Send a message...' : 'You are offline. Reconnect to send.')}
                    // text-[16px] prevents iOS Safari auto-zoom on focus (inputs <16px trigger zoom)
                    className="flex-1 bg-transparent border-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus:ring-0 appearance-none resize-none px-1 py-2.5 text-[16px] md:text-[15px] leading-6 text-foreground placeholder:text-muted-foreground/80 max-h-32 min-h-[44px] scrollbar-hide"
                    rows={1}
                />
                {input.length > 1500 && (
                    <span id="char-counter" className="absolute bottom-1 right-14 text-xs text-muted-foreground" aria-live="polite">
                        {input.length}/{MAX_CHARS}
                    </span>
                )}
                <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || disabled}
                    data-testid="chat-send"
                    aria-label="Send message"
                    className="shrink-0 self-center rounded-full w-11 h-11 mb-0 active:scale-95 transition-transform shadow-none"
                >
                    <ArrowRight size={18} />
                </Button>
            </form>
            {limitNotice && (
                <p className="mt-1 px-1 text-[10px] text-amber-500/90" aria-live="polite">
                    Message limit is {MAX_CHARS} characters.
                </p>
            )}
            <AiDisclaimer />
        </div>
    )
})
