'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'

interface ChatInputProps {
    onSend: (message: string) => void
    disabled?: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [input, setInput] = useState('')

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (input.trim() && !disabled) {
            onSend(input)
            setInput('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className="p-4 bg-gradient-to-t from-background via-background/80 to-transparent z-10">
            <form
                onSubmit={handleSubmit}
                className="relative flex items-end gap-2 bg-white/5 backdrop-blur-xl border border-white/10 p-2 px-3 rounded-2xl shadow-2xl transition-all focus-within:border-primary/50"
            >
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    data-testid="chat-input"
                    placeholder="Send a message..."
                    className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-1 text-[15px] max-h-32 min-h-[44px] scrollbar-hide"
                    rows={1}
                />
                <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || disabled} // Changed from 'message' to 'input' and 'isGenerating' to 'disabled' to match existing props
                    data-testid="chat-send"
                    className="shrink-0 rounded-xl w-10 h-10 mb-1 active:scale-95 transition-transform"
                >
                    <Send size={18} />
                </Button>
            </form>
        </div>
    )
}
