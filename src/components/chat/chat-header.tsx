'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sun, Moon, Brain, Settings2, Info, RefreshCw, Crown, Zap, Globe } from 'lucide-react'
import { Character, useChatStore } from '@/stores/chat-store'
import { useTheme } from 'next-themes'
import { updateUserSettings } from '@/app/auth/actions'
import Image from 'next/image'
import { truncateText } from '@/lib/utils'
import type { TokenUsage } from '@/types/shared'
import type { SubscriptionTier } from '@/lib/billing'
import { AvatarLightbox } from './avatar-lightbox'

interface ChatHeaderProps {
    activeGang: Character[]
    onOpenVault: () => void
    onOpenSettings: () => void
    onRefresh?: () => void | Promise<void>
    typingUsers?: string[]
    memoryActive?: boolean
    autoLowCostActive?: boolean
    tokenUsage?: TokenUsage | null
    subscriptionTier?: SubscriptionTier
    chatMode?: 'gang_focus' | 'ecosystem'
}

function formatChars(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return String(n)
}

function truncatePreviewText(value: string | undefined, maxChars: number) {
    if (!value) return ''
    return truncateText(value, maxChars).replace(/\u2026$/, '...')
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

export const ChatHeader = memo(function ChatHeader({ activeGang, onOpenVault, onOpenSettings, onRefresh, typingUsers = [], memoryActive = false, autoLowCostActive = false, tokenUsage, subscriptionTier = 'free', chatMode = 'gang_focus' }: ChatHeaderProps) {
    const { theme, resolvedTheme, setTheme } = useTheme()
    const effectiveTheme = resolvedTheme ?? theme ?? 'dark'
    const currentTheme = effectiveTheme === 'light' ? 'light' : 'dark'
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
    const [showAutoLowCostInfo, setShowAutoLowCostInfo] = useState(false)
    const [canDesktopAvatarPreview, setCanDesktopAvatarPreview] = useState(false)
    const [hoveredAvatar, setHoveredAvatar] = useState<Character | null>(null)
    const [expandedAvatar, setExpandedAvatar] = useState<Character | null>(null)
    const showCapacityInfo = autoLowCostActive && showAutoLowCostInfo
    const capacityInfoRef = useRef<HTMLDivElement>(null)
    const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const avatarTriggerRef = useRef<HTMLButtonElement | null>(null)

    const newMemoryCount = useChatStore((s) => s.newMemoryCount)
    const totalMemoryCount = useChatStore((s) => s.totalMemoryCount)
    const showUpgradeTour = useChatStore((s) => s.showUpgradeTour)
    const isFreeUser = subscriptionTier === 'free'
    // Free tier: show total (never clears, acts as upgrade nudge)
    // Paid tier: show new unseen (clears on vault open)
    const memoryBadgeCount = isFreeUser ? totalMemoryCount : newMemoryCount
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showRefreshed, setShowRefreshed] = useState(false)
    const devToolsEnabled = process.env.NODE_ENV === 'development'
    const statusText = typingUsers.length > 0
        ? (() => {
            const names = typingUsers.map(id => activeGang.find(c => c.id === id)?.name || id)
            if (names.length === 1) return `${names[0]} is typing…`
            if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
            return `${names[0]} and ${names.length - 1} others are typing…`
        })()
        : `${activeGang.length} online${memoryActive ? ' · Memory active' : ''}`

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

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 640px) and (hover: hover) and (pointer: fine)')
        const updateCanPreview = () => {
            const enabled = mediaQuery.matches
            setCanDesktopAvatarPreview(enabled)
            if (!enabled) {
                setHoveredAvatar(null)
                setExpandedAvatar(null)
            }
        }

        updateCanPreview()
        mediaQuery.addEventListener('change', updateCanPreview)
        return () => mediaQuery.removeEventListener('change', updateCanPreview)
    }, [])

    useEffect(() => {
        return () => {
            if (hoverCloseTimerRef.current) {
                clearTimeout(hoverCloseTimerRef.current)
            }
        }
    }, [])

    const cancelAvatarHoverClose = () => {
        if (hoverCloseTimerRef.current) {
            clearTimeout(hoverCloseTimerRef.current)
            hoverCloseTimerRef.current = null
        }
    }

    const scheduleAvatarHoverClose = () => {
        if (!canDesktopAvatarPreview || expandedAvatar) return
        cancelAvatarHoverClose()
        hoverCloseTimerRef.current = setTimeout(() => {
            setHoveredAvatar(null)
            hoverCloseTimerRef.current = null
        }, 140)
    }

    const handleAvatarHover = (character: Character) => {
        if (!canDesktopAvatarPreview || !character.avatar) return
        cancelAvatarHoverClose()
        setHoveredAvatar(character)
    }

    const handleAvatarClick = (event: React.MouseEvent<HTMLButtonElement>, character: Character) => {
        if (!canDesktopAvatarPreview || !character.avatar) return
        event.preventDefault()
        cancelAvatarHoverClose()
        avatarTriggerRef.current = event.currentTarget
        setHoveredAvatar(character)
        setExpandedAvatar(character)
    }

    const renderPlanBadge = (mobile: boolean) => {
        if (subscriptionTier === 'pro') {
            return (
                <span
                    data-testid={mobile ? 'chat-plan-badge-mobile' : 'chat-plan-badge-desktop'}
                    data-tier="pro"
                    className={mobile
                        ? 'inline-flex sm:hidden items-center gap-1 shrink-0 text-[10px] font-medium text-amber-700/80 dark:text-amber-300/80'
                        : 'hidden sm:inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-600/10 dark:from-amber-500/20 to-yellow-600/10 dark:to-yellow-500/20 border border-amber-600/40 dark:border-amber-500/30 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400'}
                >
                    {mobile ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500/85" aria-hidden="true" /> : <Crown className="w-2.5 h-2.5" />}
                    Pro
                </span>
            )
        }

        if (subscriptionTier === 'basic') {
            return (
                <span
                    data-testid={mobile ? 'chat-plan-badge-mobile' : 'chat-plan-badge-desktop'}
                    data-tier="basic"
                    className={mobile
                        ? 'inline-flex sm:hidden items-center gap-1 shrink-0 text-[10px] font-medium text-blue-700/80 dark:text-blue-300/80'
                        : 'hidden sm:inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-md bg-blue-600/10 dark:bg-blue-500/15 border border-blue-600/35 dark:border-blue-500/25 text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400'}
                >
                    {mobile ? <span className="h-1.5 w-1.5 rounded-full bg-blue-500/85" aria-hidden="true" /> : <Zap className="w-2.5 h-2.5" />}
                    Basic
                </span>
            )
        }

        return null
    }

    const renderModeBadge = (mobile: boolean) => {
        if (chatMode !== 'ecosystem') return null

        return (
            <span
                data-testid={mobile ? 'chat-mode-badge-mobile' : 'chat-mode-badge-desktop'}
                className={mobile
                    ? 'inline-flex sm:hidden items-center gap-1 shrink-0 text-[10px] font-medium text-violet-700/80 dark:text-violet-300/80'
                    : 'hidden sm:inline-flex items-center gap-0.5 shrink-0 px-1.5 py-0.5 rounded-md bg-violet-600/10 dark:bg-violet-500/15 border border-violet-600/30 dark:border-violet-500/25 text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400'}
            >
                {mobile ? <span className="h-1.5 w-1.5 rounded-full bg-violet-500/85" aria-hidden="true" /> : <Globe className="w-2.5 h-2.5" />}
                {mobile ? 'Ecosystem' : 'Ecosystem'}
            </span>
        )
    }

    const mobilePlanBadge = renderPlanBadge(true)
    const desktopPlanBadge = renderPlanBadge(false)
    const mobileModeBadge = renderModeBadge(true)
    const desktopModeBadge = renderModeBadge(false)
    const showMobileBadgeRow = Boolean(mobilePlanBadge || mobileModeBadge)
    const avatarPreview = hoveredAvatar && canDesktopAvatarPreview && !expandedAvatar ? hoveredAvatar : null

    return (
        <header data-testid="chat-header" aria-label="Chat header" className="chat-header-desktop relative px-4 sm:px-6 pb-2.5 sm:pb-3 lg:pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:pt-[calc(env(safe-area-inset-top)+1rem)] lg:pt-2.5 border-b border-border/40 flex flex-nowrap justify-between items-start sm:items-center gap-3 backdrop-blur-xl bg-card/95 z-20 w-full shadow-[0_4px_20px_-12px_rgba(2,6,23,0.4)]">
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <div
                            className="relative hidden sm:block"
                            onPointerEnter={cancelAvatarHoverClose}
                            onPointerLeave={scheduleAvatarHoverClose}
                        >
                            <div className="flex -space-x-2" role="group" aria-label={`${activeGang.length} gang members`}>
                                {activeGang.map((char) => (
                                    <button
                                        key={char.id}
                                        type="button"
                                        aria-label={`Preview ${char.name}`}
                                        className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                        onPointerEnter={() => handleAvatarHover(char)}
                                        onFocus={() => handleAvatarHover(char)}
                                        onClick={(event) => handleAvatarClick(event, char)}
                                    >
                                        <Avatar
                                            className="border-[1.5px] border-background w-8 h-8 sm:w-9 sm:h-9 lg:w-8 lg:h-8 transition-transform duration-150 hover:-translate-y-0.5"
                                            title={char.name}
                                        >
                                            {char.avatar && (
                                                <Image
                                                    src={char.avatar}
                                                    alt={char.name}
                                                    width={40}
                                                    height={40}
                                                    className="object-cover"
                                                    sizes="40px"
                                                    priority={false}
                                                />
                                            )}
                                            <AvatarFallback className="text-[11px] bg-muted">{char.name?.[0] || '?'}</AvatarFallback>
                                        </Avatar>
                                    </button>
                                ))}
                            </div>
                            {avatarPreview && (
                                <div
                                    className="absolute left-0 top-full z-40 mt-3 w-[19rem] rounded-[1.35rem] border border-border/60 bg-background/95 p-3 shadow-[0_24px_70px_-35px_rgba(2,6,23,0.95)] backdrop-blur-xl animate-in fade-in slide-in-from-top-2 zoom-in-95 duration-150"
                                    onPointerEnter={cancelAvatarHoverClose}
                                    onPointerLeave={scheduleAvatarHoverClose}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[1rem] border border-white/10 bg-muted/60"
                                            style={{ boxShadow: `0 0 0 1px ${avatarPreview.color}40` }}
                                        >
                                            {avatarPreview.avatar ? (
                                                <Image
                                                    src={avatarPreview.avatar}
                                                    alt={avatarPreview.name}
                                                    fill
                                                    className="object-cover"
                                                    sizes="96px"
                                                    priority={false}
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-foreground/80">
                                                    {avatarPreview.name[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="truncate text-sm font-semibold text-foreground">{avatarPreview.name}</p>
                                                {(avatarPreview.roleLabel || avatarPreview.archetype) && (
                                                    <span className="truncate rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                                        {avatarPreview.roleLabel || avatarPreview.archetype}
                                                    </span>
                                                )}
                                            </div>
                                            {avatarPreview.vibe && (
                                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground/90">
                                                    {avatarPreview.vibe}
                                                </p>
                                            )}
                                            {avatarPreview.sample && (
                                                <p className="mt-2 text-[11px] leading-relaxed text-foreground/80">
                                                    &ldquo;{truncatePreviewText(avatarPreview.sample, 92)}&rdquo;
                                                </p>
                                            )}
                                            {!!avatarPreview.tags?.length && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {avatarPreview.tags.slice(0, 3).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-primary/85"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex -space-x-2 sm:hidden" role="group" aria-label={`${activeGang.length} gang members`}>
                            {activeGang.map((char) => (
                                <button
                                    key={char.id}
                                    type="button"
                                    aria-label={`Preview ${char.name}`}
                                    className="relative rounded-full min-w-[44px] min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                                    onClick={() => { if (char.avatar) setExpandedAvatar(char) }}
                                >
                                <Avatar
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
                                </button>
                            ))}
                        </div>
                        {desktopPlanBadge}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 min-h-[14px] min-w-0 text-[10px] text-muted-foreground/60 whitespace-nowrap">
                        <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${typingUsers.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className="min-w-0 flex-1 truncate text-muted-foreground/80">
                            {statusText}
                        </span>
                        {desktopModeBadge}
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-end gap-0 shrink-0 self-start sm:self-center">
                <div data-testid="chat-header-controls" className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
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
                                className="rounded-full text-amber-500/90 hover:text-amber-500 hover:bg-amber-500/10 size-9 sm:size-10 lg:size-9 min-w-[44px] min-h-[44px]"
                            >
                                <Info size={13} />
                            </Button>
                            {showCapacityInfo && (
                                <div
                                    id="capacity-mode-info"
                                    role="dialog"
                                    aria-label="Temporary capacity mode info"
                                    className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-amber-600/40 dark:border-amber-400/35 bg-card/98 p-2 text-[10px] leading-relaxed text-amber-800 dark:text-amber-100 shadow-[0_12px_30px_-18px_rgba(245,158,11,0.75)]"
                                >
                                    Temporary low-cost mode is active due to provider capacity. Full mode restores automatically after stable turns.
                                </div>
                            )}
                        </div>
                    )}
                    {onRefresh && (
                        <div className="relative">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                    if (isRefreshing) return
                                    setIsRefreshing(true)
                                    try {
                                        await onRefresh()
                                        setShowRefreshed(true)
                                        setTimeout(() => setShowRefreshed(false), 1500)
                                    } finally {
                                        setIsRefreshing(false)
                                    }
                                }}
                                title="Refresh chat"
                                aria-label="Refresh chat"
                                className="rounded-full text-muted-foreground/70 hover:text-primary transition-colors size-9 sm:size-10 lg:size-9 min-w-[44px] min-h-[44px]"
                            >
                                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                            </Button>
                            {showRefreshed && (
                                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-medium text-emerald-500 whitespace-nowrap animate-in fade-in slide-in-from-top-1 duration-200">
                                    Refreshed
                                </span>
                            )}
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            if (subscriptionTier !== 'free') useChatStore.getState().setNewMemoryCount(0)
                            onOpenVault()
                        }}
                        title="Memory Vault"
                        aria-label="Manage AI memories"
                        className="relative rounded-full text-muted-foreground/70 hover:text-primary transition-colors size-9 sm:size-10 lg:size-9 min-w-[44px] min-h-[44px]"
                    >
                        <Brain size={18} />
                        {memoryBadgeCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold ring-2 ring-background px-1">
                                {memoryBadgeCount > 99 ? '99+' : memoryBadgeCount}
                            </span>
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full text-muted-foreground/70 hover:text-foreground transition-colors size-9 sm:size-10 lg:size-9 min-w-[44px] min-h-[44px]"
                        aria-label="Toggle theme"
                        onClick={() => {
                            setTheme(nextTheme)
                            updateUserSettings({ theme: nextTheme })
                        }}
                    >
                        <Sun size={18} className="hidden dark:block" aria-hidden="true" />
                        <Moon size={18} className="dark:hidden" aria-hidden="true" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onOpenSettings}
                        title="Gang Settings"
                        aria-label="Open settings"
                        className="relative rounded-full text-muted-foreground/70 hover:text-primary transition-colors size-9 sm:size-10 lg:size-9 min-w-[44px] min-h-[44px]"
                    >
                        <Settings2 size={18} />
                        {showUpgradeTour && (
                            <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                        )}
                    </Button>
                </div>

                {showMobileBadgeRow && (
                    <div data-testid="chat-mobile-badge-row" className="-mt-1 flex items-center justify-end gap-2.5 min-h-0 self-end sm:hidden leading-none">
                        {mobileModeBadge}
                        {mobilePlanBadge}
                    </div>
                )}
            </div>

            {expandedAvatar?.avatar && (
                <AvatarLightbox
                    character={expandedAvatar}
                    onClose={() => setExpandedAvatar(null)}
                    triggerRef={avatarTriggerRef}
                />
            )}
        </header>
    )
})
