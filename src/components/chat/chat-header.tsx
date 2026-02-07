'use client'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sun, Moon, Brain, Settings2 } from 'lucide-react'
import { Character } from '@/stores/chat-store'
import { useTheme } from 'next-themes'
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
    const { resolvedTheme, setTheme } = useTheme()
    const currentTheme = resolvedTheme === 'light' ? 'light' : 'dark'

    return (
        <header data-testid="chat-header" className="px-4 sm:px-6 pb-3 sm:pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-[calc(env(safe-area-inset-top)+1.5rem)] border-b border-white/10 flex flex-nowrap justify-between items-center gap-3 backdrop-blur-md bg-white/5 z-10 w-full">
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {activeGang.map((char) => (
                                <Avatar
                                    key={char.id}
                                    className="border border-background ring-1 ring-primary/10 w-9 h-9 sm:w-10 sm:h-10"
                                    title={char.name}
                                >
                                    {char.avatar && (
                                        <Image
                                            src={char.avatar}
                                            alt={char.name}
                                            width={40}
                                            height={40}
                                            className="object-cover"
                                            sizes="(max-width: 640px) 36px, 40px"
                                            priority={false}
                                        />
                                    )}
                                    <AvatarFallback className="text-[11px] bg-muted">{char.name[0]}</AvatarFallback>
                                </Avatar>
                            ))}
                        </div>
                        <h1 className="font-bold text-sm sm:text-base leading-none whitespace-nowrap">My Gang</h1>
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        {activeGang.length} Online
                        {typingCount > 0 && <span> - {typingCount} typing</span>}
                        {memoryActive && <span> - Memory Active</span>}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenVault}
                    title="Memory Vault"
                    aria-label="Manage AI memories"
                    className="rounded-full text-muted-foreground hover:text-primary transition-colors size-11 sm:size-12"
                >
                    <Brain size={22} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    title="Gang Settings"
                    aria-label="Open settings"
                    className="rounded-full text-muted-foreground hover:text-primary transition-colors size-11 sm:size-12"
                >
                    <Settings2 size={22} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    aria-label={currentTheme === 'dark' ? "Switch to light theme" : "Switch to dark theme"}
                    onClick={() => {
                        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
                        setTheme(nextTheme)
                        updateUserSettings({ theme: nextTheme })
                    }}
                >
                    {currentTheme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
                </Button>
            </div>
        </header>
    )
}


