'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sun, Moon, Brain, Settings2, Info } from 'lucide-react'
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
    autoLowCostActive?: boolean
}

export function ChatHeader({ activeGang, onOpenVault, onOpenSettings, typingCount = 0, memoryActive = false, autoLowCostActive = false }: ChatHeaderProps) {
    const { theme, resolvedTheme, setTheme } = useTheme()
    const effectiveTheme = resolvedTheme ?? theme ?? 'dark'
    const currentTheme = effectiveTheme === 'light' ? 'light' : 'dark'
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
    const [showAutoLowCostInfo, setShowAutoLowCostInfo] = useState(false)
    const showCapacityInfo = autoLowCostActive && showAutoLowCostInfo
    const capacityInfoRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!showCapacityInfo) return
        const onPointerDown = (e: PointerEvent) => {
            const node = capacityInfoRef.current
            if (!node) return
            if (node.contains(e.target as Node)) return
            setShowAutoLowCostInfo(false)
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setShowAutoLowCostInfo(false)
            }
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [showCapacityInfo])

    return (
        <header data-testid="chat-header" className="px-4 sm:px-6 pb-3 sm:pb-4 lg:pb-1.5 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-[calc(env(safe-area-inset-top)+1.5rem)] lg:pt-2.5 border-b border-border/70 dark:border-white/10 flex flex-nowrap justify-between items-center gap-3 backdrop-blur-xl bg-card/92 dark:bg-[rgba(14,22,37,0.9)] z-20 w-full shadow-[0_12px_30px_-24px_rgba(2,6,23,0.8)]">
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {activeGang.map((char) => (
                                <Avatar
                                    key={char.id}
                                    className="border border-background ring-1 ring-primary/10 w-9 h-9 sm:w-10 sm:h-10 lg:w-9 lg:h-9"
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
                        <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            {activeGang.length} Online
                            {memoryActive && <span>- Memory Active</span>}
                        </span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1 mt-1 lg:hidden">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        {activeGang.length} Online
                        {typingCount > 0 && <span> - {typingCount} typing</span>}
                        {memoryActive && <span> - Memory Active</span>}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {autoLowCostActive && (
                    <div className="relative" ref={capacityInfoRef}>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowAutoLowCostInfo((value) => !value)}
                            title="Capacity mode info"
                            aria-label="Capacity mode info"
                            aria-haspopup="dialog"
                            aria-expanded={showCapacityInfo}
                            aria-controls="capacity-mode-info"
                            className="rounded-full text-amber-500/90 hover:text-amber-500 hover:bg-amber-500/10 size-8 sm:size-8"
                        >
                            <Info size={13} />
                        </Button>
                        {showCapacityInfo && (
                            <div
                                id="capacity-mode-info"
                                role="dialog"
                                aria-label="Temporary capacity mode info"
                                className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-amber-400/35 bg-card/95 dark:bg-[rgba(14,22,37,0.95)] p-2 text-[10px] leading-relaxed text-amber-100 shadow-[0_12px_30px_-18px_rgba(245,158,11,0.75)]"
                            >
                                Temporary low-cost mode is active due to provider capacity. Full mode restores automatically after stable turns.
                            </div>
                        )}
                    </div>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenVault}
                    title="Memory Vault"
                    aria-label="Manage AI memories"
                    className="rounded-full text-muted-foreground hover:text-primary transition-colors size-11 sm:size-12 lg:size-10"
                >
                    <Brain size={20} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full size-11 sm:size-12 lg:size-10"
                    aria-label="Toggle theme"
                    onClick={() => {
                        setTheme(nextTheme)
                        updateUserSettings({ theme: nextTheme })
                    }}
                >
                    <Sun size={20} className="hidden dark:block" />
                    <Moon size={20} className="dark:hidden" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    title="Gang Settings"
                    aria-label="Open settings"
                    className="rounded-full text-muted-foreground hover:text-primary transition-colors size-11 sm:size-12 lg:size-10"
                >
                    <Settings2 size={20} />
                </Button>
            </div>
        </header>
    )
}


