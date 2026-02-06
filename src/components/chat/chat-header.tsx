'use client'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Camera, Sun, Moon, Brain, Settings2 } from 'lucide-react'
import { Character } from '@/stores/chat-store'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface ChatHeaderProps {
    activeGang: Character[]
    onOpenVault: () => void
    onOpenSettings: () => void
}

export function ChatHeader({ activeGang, onOpenVault, onOpenSettings }: ChatHeaderProps) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <header data-testid="chat-header" className="p-4 border-b border-white/10 flex justify-between items-center backdrop-blur-md bg-white/5 z-10 w-full">
            <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex -space-x-3 sm:-space-x-2">
                    {activeGang.map((char) => (
                        <Avatar
                            key={char.id}
                            className="border border-background ring-1 ring-primary/10 w-6 h-6 sm:w-8 sm:h-8"
                            title={char.name}
                        >
                            <img src={char.avatar} alt={char.name} className="object-cover" />
                            <AvatarFallback className="text-[8px] bg-muted">{char.name[0]}</AvatarFallback>
                        </Avatar>
                    ))}
                </div>
                <div className="flex flex-col">
                    <h1 className="font-bold text-[10px] sm:text-sm leading-none">My Gang</h1>
                    <span className="text-[8px] sm:text-[10px] text-muted-foreground flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        {activeGang.length} Online
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenVault}
                    title="Memory Vault"
                    aria-label="Manage AI memories"
                    className="rounded-full text-muted-foreground hover:text-primary transition-colors"
                >
                    <Brain size={18} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    title="Gang Settings"
                    aria-label="Open settings"
                    className="rounded-full text-muted-foreground hover:text-primary transition-colors"
                >
                    <Settings2 size={18} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label={mounted ? (theme === 'dark' ? "Switch to light theme" : "Switch to dark theme") : "Toggle theme"}
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                    {mounted ? (
                        theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />
                    ) : (
                        <div className="w-5 h-5" />
                    )}
                </Button>
            </div>
        </header>
    )
}
