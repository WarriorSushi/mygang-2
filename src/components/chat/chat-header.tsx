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
        <header data-testid="chat-header" className="px-4 sm:px-6 pb-2.5 sm:pb-3 lg:pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-[calc(env(safe-area-inset-top)+1rem)] lg:pt-2.5 border-b border-border/50 dark:border-white/8 flex flex-nowrap justify-between items-center gap-3 backdrop-blur-xl bg-card/95 dark:bg-[rgba(14,22,37,0.92)] z-20 w-full shadow-[0_4px_20px_-12px_rgba(2,6,23,0.4)]">
            <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {activeGang.map((char) => (
                                <Avatar
                                    key={char.id}
                                    className="border-[1.5px] border-background w-8 h-8 sm:w-9 sm:h-9 lg:w-8 lg:h-8"
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
                        <h1 className="font-semibold text-sm sm:text-base leading-none whitespace-nowrap">My Gang</h1>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {activeGang.length} online
                        {typingCount > 0 && <span className="lg:hidden"> &middot; {typingCount} typing</span>}
                        {memoryActive && <span> &middot; Memory active</span>}
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
                    className="rounded-full text-muted-foreground/70 hover:text-primary transition-colors size-9 sm:size-10 lg:size-9"
                >
                    <Brain size={18} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full text-muted-foreground/70 hover:text-foreground transition-colors size-9 sm:size-10 lg:size-9"
                    aria-label="Toggle theme"
                    onClick={() => {
                        setTheme(nextTheme)
                        updateUserSettings({ theme: nextTheme })
                    }}
                >
                    <Sun size={18} className="hidden dark:block" />
                    <Moon size={18} className="dark:hidden" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenSettings}
                    title="Gang Settings"
                    aria-label="Open settings"
                    className="rounded-full text-muted-foreground/70 hover:text-primary transition-colors size-9 sm:size-10 lg:size-9"
                >
                    <Settings2 size={18} />
                </Button>
            </div>
        </header>
    )
}


