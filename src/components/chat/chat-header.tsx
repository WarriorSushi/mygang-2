'use client'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sun, Moon, Brain, Settings2 } from 'lucide-react'
import { Character } from '@/stores/chat-store'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { updateUserSettings } from '@/app/auth/actions'
import Image from 'next/image'

interface ChatHeaderProps {
    activeGang: Character[]
    onOpenVault: () => void
    onOpenSettings: () => void
    typingCount?: number
    memoryActive?: boolean
}

export function ChatHeader({ activeGang, onOpenVault, onOpenSettings, typingCount = 0, memoryActive = false }: ChatHeaderProps) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <header data-testid="chat-header" className="px-4 sm:px-6 pb-3 sm:pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-[calc(env(safe-area-inset-top)+1.5rem)] border-b border-white/10 flex flex-wrap justify-between items-center gap-4 backdrop-blur-md bg-white/5 z-10 w-full">
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex -space-x-2 sm:-space-x-2">
                    {activeGang.map((char) => (
                        <Avatar
                            key={char.id}
                            className="border border-background ring-1 ring-primary/10 w-8 h-8 sm:w-9 sm:h-9"
                            title={char.name}
                        >
                            {char.avatar && (
                                <Image
                                    src={char.avatar}
                                    alt={char.name}
                                    width={36}
                                    height={36}
                                    className="object-cover"
                                    sizes="(max-width: 640px) 32px, 36px"
                                    priority={false}
                                />
                            )}
                            <AvatarFallback className="text-[10px] bg-muted">{char.name[0]}</AvatarFallback>
                        </Avatar>
                    ))}
                </div>
                <div className="flex flex-col">
                    <h1 className="font-bold text-sm sm:text-base leading-none">My Gang</h1>
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        {activeGang.length} Online
                        {typingCount > 0 && <span> - {typingCount} typing</span>}
                        {memoryActive && <span> - Memory Active</span>}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenVault}
                    title="Memory Vault"
                    aria-label="Manage AI memories"
                    className="rounded-full text-muted-foreground hover:text-primary transition-colors size-10 sm:size-11"
                >
                    <Brain size={20} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    title="Gang Settings"
                    aria-label="Open settings"
                    className="rounded-full text-muted-foreground hover:text-primary transition-colors size-10 sm:size-11"
                >
                    <Settings2 size={20} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label={mounted ? (theme === 'dark' ? "Switch to light theme" : "Switch to dark theme") : "Toggle theme"}
                    onClick={() => {
                        const nextTheme = theme === 'dark' ? 'light' : 'dark'
                        setTheme(nextTheme)
                        updateUserSettings({ theme: nextTheme })
                    }}
                >
                    {mounted ? (
                        theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />
                    ) : (
                        <div className="w-5 h-5" />
                    )}
                </Button>
            </div>
        </header>
    )
}


