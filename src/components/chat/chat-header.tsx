'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sun, Moon, Brain, Settings2, Info, RefreshCw } from 'lucide-react'
import { Character } from '@/stores/chat-store'
import { useTheme } from 'next-themes'
import { updateUserSettings } from '@/app/auth/actions'
import Image from 'next/image'

export interface TokenUsage {
    promptChars: number
    responseChars: number
    historyCount: number
    provider: string
}

interface ChatHeaderProps {
    activeGang: Character[]
    onOpenVault: () => void
    onOpenSettings: () => void
    onRefresh?: () => void
    typingUsers?: string[]
    memoryActive?: boolean
    autoLowCostActive?: boolean
    tokenUsage?: TokenUsage | null
}

function formatChars(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
}

function DevTokenIndicator({ usage }: { usage: TokenUsage }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="hidden sm:flex items-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-950/40 dark:bg-cyan-500/8 px-2 py-1 text-[10px] font-mono text-cyan-600 dark:text-cyan-400/90 select-none cursor-pointer hover:bg-cyan-500/15 transition-colors"
            title="Click to expand API usage details"
        >
            {expanded ? (
                <span className="flex items-center gap-1.5 flex-wrap">
                    <span>Prompt: <b>{formatChars(usage.promptChars)}</b> chars</span>
                    <span className="text-cyan-500/30">|</span>
                    <span>Response: <b>{formatChars(usage.responseChars)}</b> chars</span>
                    <span className="text-cyan-500/30">|</span>
                    <span>History: <b>{usage.historyCount}</b> msgs</span>
                    <span className="text-cyan-500/30">|</span>
                    <span className="uppercase">{usage.provider}</span>
                </span>
            ) : (
                <span className="flex items-center gap-1">
                    <span className="text-cyan-500/50">API</span>
                    <span>{formatChars(usage.promptChars)} in</span>
                    <span className="text-cyan-500/30">/</span>
                    <span>{formatChars(usage.responseChars)} out</span>
                    <span className="text-cyan-500/30">|</span>
                    <span className="uppercase">{usage.provider}</span>
                </span>
            )}
        </button>
    )
}

export const ChatHeader = memo(function ChatHeader({ activeGang, onOpenVault, onOpenSettings, onRefresh, typingUsers = [], memoryActive = false, autoLowCostActive = false, tokenUsage }: ChatHeaderProps) {
    const { theme, resolvedTheme, setTheme } = useTheme()
    const effectiveTheme = resolvedTheme ?? theme ?? 'dark'
    const currentTheme = effectiveTheme === 'light' ? 'light' : 'dark'
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
    const [showAutoLowCostInfo, setShowAutoLowCostInfo] = useState(false)
    const showCapacityInfo = autoLowCostActive && showAutoLowCostInfo
    const capacityInfoRef = useRef<HTMLDivElement>(null)

    const [isRefreshing, setIsRefreshing] = useState(false)
    const [devToolsEnabled, setDevToolsEnabled] = useState(false)
    useEffect(() => {
        try {
            setDevToolsEnabled(
                typeof window !== 'undefined' &&
                (window.localStorage.getItem('dev_tools') === 'true' || process.env.NODE_ENV === 'development')
            )
        } catch { /* localStorage blocked */ }
    }, [])

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
                                    <AvatarFallback className="text-[11px] bg-muted">{char.name?.[0] || '?'}</AvatarFallback>
                                </Avatar>
                            ))}
                        </div>
                        <h1 className="font-semibold text-sm sm:text-base leading-none whitespace-nowrap">My Gang</h1>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5 mt-0.5 min-h-[14px]">
                        <span className={`w-1.5 h-1.5 rounded-full ${typingUsers.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                        {typingUsers.length > 0 ? (
                            <span className="text-muted-foreground/80 truncate">
                                {(() => {
                                    const names = typingUsers.map(id => activeGang.find(c => c.id === id)?.name || id)
                                    if (names.length === 1) return `${names[0]} is typing\u2026`
                                    if (names.length === 2) return `${names[0]} and ${names[1]} are typing\u2026`
                                    return `${names[0]} and ${names.length - 1} others are typing\u2026`
                                })()}
                            </span>
                        ) : (
                            <>
                                {activeGang.length} online
                                {memoryActive && <span> &middot; Memory active</span>}
                            </>
                        )}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                {devToolsEnabled && tokenUsage && <DevTokenIndicator usage={tokenUsage} />}
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
                {onRefresh && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (isRefreshing) return
                            setIsRefreshing(true)
                            onRefresh()
                            setTimeout(() => setIsRefreshing(false), 1500)
                        }}
                        title="Refresh chat"
                        aria-label="Refresh chat"
                        className="rounded-full text-muted-foreground/70 hover:text-primary transition-colors size-9 sm:size-10 lg:size-9"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                    </Button>
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
})
