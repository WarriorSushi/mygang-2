'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import { useChatStore } from '@/stores/chat-store'
import { useShallow } from 'zustand/react/shallow'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import {
    Trash2,
    Camera,
    ChevronRight,
    ArrowLeft,
    Paintbrush,
    LogOut,
    ShieldAlert,
    PenLine,
    Crown,
    ArrowRight,
    Check,
    ChevronDown,
    Sparkles,
    ExternalLink,
    Zap,
    X,
    Lock,
    Settings2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteAccount, deleteAllMessages, signOut, updateUserSettings } from '@/app/auth/actions'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { CHAT_WALLPAPERS, type ChatWallpaper } from '@/constants/wallpapers'
import { createClient } from '@/lib/supabase/client'
import { m, AnimatePresence } from 'framer-motion'

type SettingsPanel = 'root' | 'wallpaper' | 'rename'

interface ChatSettingsProps {
    isOpen: boolean
    onClose: () => void
    onTakeScreenshot: () => Promise<void> | void
    initialPanel?: SettingsPanel
}

function wallpaperPreviewClass(id: ChatWallpaper) {
    if (id === 'neon') return 'bg-[radial-gradient(circle_at_20%_25%,rgba(14,165,233,0.9),rgba(14,165,233,0.1)_45%),radial-gradient(circle_at_80%_25%,rgba(236,72,153,0.85),rgba(236,72,153,0.05)_45%),radial-gradient(circle_at_50%_90%,rgba(34,197,94,0.8),rgba(34,197,94,0.06)_40%)]'
    if (id === 'soft') return 'bg-[radial-gradient(circle_at_20%_25%,rgba(244,114,182,0.45),rgba(244,114,182,0.05)_45%),radial-gradient(circle_at_80%_25%,rgba(59,130,246,0.4),rgba(59,130,246,0.05)_45%),linear-gradient(160deg,rgba(255,255,255,0.7),rgba(226,232,240,0.65))]'
    if (id === 'aurora') return 'bg-[radial-gradient(circle_at_10%_20%,rgba(45,212,191,0.8),rgba(45,212,191,0.05)_45%),radial-gradient(circle_at_85%_20%,rgba(147,51,234,0.8),rgba(147,51,234,0.05)_45%),radial-gradient(circle_at_50%_90%,rgba(96,165,250,0.65),rgba(96,165,250,0.06)_45%)]'
    if (id === 'sunset') return 'bg-[radial-gradient(circle_at_15%_25%,rgba(251,146,60,0.8),rgba(251,146,60,0.05)_45%),radial-gradient(circle_at_80%_20%,rgba(244,63,94,0.75),rgba(244,63,94,0.05)_45%),radial-gradient(circle_at_45%_90%,rgba(250,204,21,0.65),rgba(250,204,21,0.06)_45%)]'
    if (id === 'graphite') return 'bg-[linear-gradient(155deg,rgba(30,41,59,0.95),rgba(15,23,42,0.95)),repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_2px,transparent_2px,transparent_8px)]'
    if (id === 'midnight') return 'bg-[linear-gradient(180deg,rgba(241,245,249,0.95),rgba(226,232,240,0.95))]'
    return 'bg-[radial-gradient(circle_at_20%_25%,rgba(99,102,241,0.75),rgba(99,102,241,0.06)_45%),radial-gradient(circle_at_80%_25%,rgba(16,185,129,0.7),rgba(16,185,129,0.05)_45%),radial-gradient(circle_at_50%_90%,rgba(236,72,153,0.6),rgba(236,72,153,0.06)_45%)]'
}

/* ── Stagger animation helper ── */
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.04, delayChildren: 0.06 },
    },
} as const

const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
} as const

/* ── Upgrade Card ── */
function UpgradeJewel({ tier, onClose, isDark }: { tier: 'free' | 'basic'; onClose: () => void; isDark: boolean }) {
    const isBasic = tier === 'basic'

    return (
        <Link href="/pricing" onClick={onClose} className="group block">
            <div
                className="relative overflow-hidden rounded-2xl"
                style={{
                    background: isDark
                        ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #115e59 100%)'
                        : 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)',
                    boxShadow: isDark
                        ? '0 8px 32px -4px rgba(13, 148, 136, 0.35), 0 0 0 1px rgba(255,255,255,0.06) inset'
                        : '0 8px 32px -4px rgba(13, 148, 136, 0.3), 0 0 0 1px rgba(255,255,255,0.2) inset',
                }}
            >
                {/* Light orbs */}
                <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
                <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

                <div className="relative px-6 py-6">
                    {isBasic ? (
                        <>
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm">
                                    <Crown className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">Upgrade to Pro</span>
                            </div>
                            <p className="text-[16px] font-bold text-white leading-snug">
                                Go unlimited. Zero cooldowns, full memory.
                            </p>
                            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold group-hover:bg-white/30 transition-colors">
                                <span>View plans</span>
                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/90">80% off launch</span>
                                </div>
                                <span className="text-[11px] text-white/50 line-through">$99/mo</span>
                            </div>
                            <p className="text-[17px] font-bold text-white leading-snug">
                                Unlock memory & unlimited messages
                            </p>
                            <p className="text-[12px] text-white/70 mt-1.5 leading-relaxed">
                                Your gang wants to remember you. From $14.99/mo.
                            </p>
                            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold group-hover:bg-white/30 transition-colors">
                                <span>See plans</span>
                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Link>
    )
}

/* ── Pro Status Card ── */
function ProStatusCard({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
    return (
        <div
            className="relative overflow-hidden rounded-2xl"
            style={{
                background: isDark ? 'rgba(251, 191, 36, 0.08)' : 'rgba(251, 191, 36, 0.06)',
                border: `1px solid ${isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.2)'}`,
            }}
        >
            <div className="absolute top-0 left-0 right-0 h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.4), transparent)' }} />
            <div className="relative px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ background: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.12)' }}>
                        <Crown className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold">Pro</p>
                        <p className="text-[11px] text-muted-foreground">Unlimited everything</p>
                    </div>
                </div>
                <Link
                    href="/api/customer-portal"
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Manage
                    <ExternalLink className="w-3 h-3" />
                </Link>
            </div>
        </div>
    )
}

/* ── Section Card wrapper ── */
function SectionCard({ children, isDark, className: extra }: { children: React.ReactNode; isDark: boolean; className?: string }) {
    return (
        <div
            className={cn('rounded-2xl px-4 py-4 sm:px-5 sm:py-5', extra)}
            style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
        >
            {children}
        </div>
    )
}

/* ── Icon Container ── */
function IconBox({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
    return (
        <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
            style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }}
        >
            {children}
        </div>
    )
}

/* ── Section Label ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
            {children}
        </p>
    )
}

/* ── Menu Row ── */
function MenuRow({
    children,
    onClick,
    href,
    onCloseDrawer,
    destructive,
    chevron,
    className: extraClass,
}: {
    children: React.ReactNode
    onClick?: () => void | Promise<void>
    href?: string
    onCloseDrawer?: () => void
    destructive?: boolean
    chevron?: boolean
    className?: string
}) {
    const cls = cn(
        'group/row w-full flex items-center justify-between gap-3 rounded-xl px-4 py-4 transition-all duration-200 cursor-pointer',
        !destructive && 'hover:bg-primary/5 active:scale-[0.99]',
        destructive && 'hover:bg-red-500/8',
        extraClass,
    )

    if (href) {
        return (
            <Link href={href} onClick={onCloseDrawer} className={cls}>
                {children}
                {chevron && <ChevronRight size={14} className="text-muted-foreground/50 shrink-0 transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-muted-foreground" />}
            </Link>
        )
    }

    return (
        <button type="button" onClick={onClick} className={cls}>
            {children}
            {chevron && <ChevronRight size={14} className="text-muted-foreground/50 shrink-0 transition-transform duration-200 group-hover/row:translate-x-0.5 group-hover/row:text-muted-foreground" />}
        </button>
    )
}

/* ════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════ */

export function ChatSettings({ isOpen, onClose, onTakeScreenshot, initialPanel = 'root' }: ChatSettingsProps) {
    const {
        chatMode,
        setChatMode,
        ecosystemSpeed,
        setEcosystemSpeed,
        lowCostMode,
        setLowCostMode,
        clearChat,
        chatWallpaper,
        setChatWallpaper,
        showPersonaRoles,
        setShowPersonaRoles,
        userName,
        activeGang,
        customCharacterNames,
        setCustomCharacterNames,
        subscriptionTier,
    } = useChatStore(useShallow((s) => ({
        chatMode: s.chatMode,
        setChatMode: s.setChatMode,
        ecosystemSpeed: s.ecosystemSpeed,
        setEcosystemSpeed: s.setEcosystemSpeed,
        lowCostMode: s.lowCostMode,
        setLowCostMode: s.setLowCostMode,
        clearChat: s.clearChat,
        chatWallpaper: s.chatWallpaper,
        setChatWallpaper: s.setChatWallpaper,
        showPersonaRoles: s.showPersonaRoles,
        setShowPersonaRoles: s.setShowPersonaRoles,
        userName: s.userName,
        activeGang: s.activeGang,
        customCharacterNames: s.customCharacterNames,
        setCustomCharacterNames: s.setCustomCharacterNames,
        subscriptionTier: s.subscriptionTier,
    })))

    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    const [panel, setPanel] = useState<SettingsPanel>('root')
    const [accountEmail, setAccountEmail] = useState<string | null>(null)
    const [deleteEmailInput, setDeleteEmailInput] = useState('')
    const [deleteEmailError, setDeleteEmailError] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [renameInputs, setRenameInputs] = useState<Record<string, string>>({})
    const [renameSaved, setRenameSaved] = useState(false)
    const [dangerExpanded, setDangerExpanded] = useState(false)
    const [deleteConfirmStep, setDeleteConfirmStep] = useState(false)

    const supabase = useMemo(() => createClient(), [])

    useEffect(() => {
        if (!isOpen) return
        let mounted = true
        const loadUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!mounted) return
                setAccountEmail(user?.email ?? null)
            } catch {
                if (!mounted) return
                setAccountEmail(null)
            }
        }
        loadUser()
        return () => { mounted = false }
    }, [isOpen, supabase])

    useEffect(() => {
        if (!isOpen) return
        setPanel(initialPanel)
        if (initialPanel === 'rename') {
            setRenameInputs({ ...customCharacterNames })
        }
    }, [customCharacterNames, initialPanel, isOpen])

    const handleChatModeChange = (value: string) => {
        if (value !== 'gang_focus' && value !== 'ecosystem') return
        setChatMode(value)
        updateUserSettings({ chat_mode: value })
    }

    const handleLowCostModeChange = (enabled: boolean) => {
        setLowCostMode(enabled)
        updateUserSettings({ low_cost_mode: enabled })
    }

    const handleWallpaperChange = (value: ChatWallpaper) => {
        setChatWallpaper(value)
        updateUserSettings({ chat_wallpaper: value })
    }

    const handleClose = (nextOpen: boolean) => {
        if (nextOpen) return
        setPanel('root')
        setDeleteEmailInput('')
        setDeleteEmailError(null)
        setDeleteConfirmStep(false)
        setDangerExpanded(false)
        onClose()
    }

    const handleDeleteAccount = async () => {
        const expectedEmail = (accountEmail || '').trim().toLowerCase()
        const typedEmail = deleteEmailInput.trim().toLowerCase()
        if (!expectedEmail || typedEmail !== expectedEmail) {
            setDeleteEmailError('Type your exact signed-in email to confirm account deletion.')
            return
        }
        if (!deleteConfirmStep) {
            setDeleteConfirmStep(true)
            return
        }
        setIsDeleting(true)
        try {
            await deleteAccount()
            window.location.href = '/'
        } catch (err) {
            const message = err instanceof Error ? err.message : ''
            if (!message.includes('NEXT_REDIRECT')) {
                setDeleteEmailError('Could not delete account. Please try again.')
            }
        } finally {
            setIsDeleting(false)
        }
    }

    const handleRenameCharacter = (charId: string, newName: string) => {
        const trimmed = newName.trim().slice(0, 30)
        const next = { ...customCharacterNames }
        if (trimmed && trimmed !== activeGang.find((c) => c.id === charId)?.name) {
            next[charId] = trimmed
        } else {
            delete next[charId]
        }
        setCustomCharacterNames(next)
        updateUserSettings({ custom_character_names: next } as Parameters<typeof updateUserSettings>[0])
    }

    const handleSaveAllNames = () => {
        const next = { ...customCharacterNames }
        for (const char of activeGang) {
            const raw = renameInputs[char.id] || ''
            const trimmed = raw.trim().slice(0, 30)
            if (trimmed && trimmed !== char.name) {
                next[char.id] = trimmed
            } else {
                delete next[char.id]
            }
        }
        setCustomCharacterNames(next)
        updateUserSettings({ custom_character_names: next } as Parameters<typeof updateUserSettings>[0])
        setRenameSaved(true)
        setTimeout(() => setRenameSaved(false), 2000)
    }

    const tierLabel = subscriptionTier === 'pro' ? 'Pro' : subscriptionTier === 'basic' ? 'Basic' : 'Free'
    const greeting = userName ? `Hey, ${userName}` : 'Settings'

    // Surface colors — inline to bypass Tailwind v4 arbitrary value bug
    const surface = {
        bg: 'var(--background)',
        shadow: isDark
            ? '0 0 60px -10px rgba(0,0,0,0.8), -4px 0 20px -4px rgba(0,0,0,0.4)'
            : '0 0 60px -10px rgba(0,0,0,0.15), -4px 0 20px -4px rgba(0,0,0,0.08)',
        headerBorder: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
        footerBorder: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
    }

    return (
        <Sheet open={isOpen} onOpenChange={handleClose}>
            <SheetContent
                side="right"
                showCloseButton={false}
                className="p-0 border-l-0 text-foreground"
                style={{
                    width: '85vw',
                    maxWidth: 480,
                    backgroundColor: surface.bg,
                    boxShadow: surface.shadow,
                    borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
                }}
            >
                <SheetTitle className="sr-only">Settings</SheetTitle>
                <SheetDescription className="sr-only">Adjust your gang experience, wallpaper, account, and billing.</SheetDescription>

                <div className="flex h-full flex-col">

                    {/* ─── HEADER ─── */}
                    <div className="relative px-5 sm:px-7 pt-6 sm:pt-7 pb-4 sm:pb-5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute top-5 right-4 sm:top-6 sm:right-6 p-2 rounded-xl text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105 active:scale-95"
                            style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
                            aria-label="Close settings"
                        >
                            <X size={16} />
                        </button>

                        {panel !== 'root' ? (
                            <button
                                type="button"
                                onClick={() => setPanel('root')}
                                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors -ml-1"
                                aria-label="Back to settings"
                            >
                                <ArrowLeft size={16} />
                                <span className="text-[12px] font-medium">Back</span>
                            </button>
                        ) : (
                            <>
                                <h2 className="text-[24px] font-bold tracking-tight leading-tight">{greeting}</h2>
                                <div className="flex items-center gap-2.5 mt-2">
                                    <p className="text-[13px] text-muted-foreground truncate">{accountEmail || '\u00A0'}</p>
                                    <span
                                        className={cn(
                                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.15em] border",
                                            subscriptionTier === 'pro'
                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                : subscriptionTier === 'basic'
                                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                                    : "bg-muted/50 text-muted-foreground border-border/50"
                                        )}
                                    >
                                        {subscriptionTier === 'pro' && <Crown className="w-2.5 h-2.5" />}
                                        {subscriptionTier === 'basic' && <Zap className="w-2.5 h-2.5" />}
                                        {tierLabel}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Header divider */}
                    <div className="h-px mx-5 sm:mx-7" style={{ background: `linear-gradient(90deg, transparent, ${surface.headerBorder}, transparent)` }} />

                    {/* ─── CONTENT ─── */}
                    <div className="relative flex-1 overflow-hidden">

                        {/* ROOT PANEL */}
                        <div
                            {...(panel !== 'root' ? { inert: true } : {})}
                            className={cn(
                                'absolute inset-0 overflow-y-auto transition-all duration-300 ease-out',
                                panel === 'root' ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0 pointer-events-none'
                            )}
                        >
                            <m.div
                                key="root"
                                variants={containerVariants}
                                initial="hidden"
                                animate="show"
                                className="px-5 sm:px-7 py-5 sm:py-6 space-y-5"
                            >
                                {/* Upgrade / Plan */}
                                <m.div variants={itemVariants}>
                                    {subscriptionTier === 'pro' ? (
                                        <ProStatusCard onClose={onClose} isDark={isDark} />
                                    ) : (
                                        <UpgradeJewel tier={subscriptionTier} onClose={onClose} isDark={isDark} />
                                    )}
                                </m.div>

                                {/* Chat Mode */}
                                <m.div variants={itemVariants}>
                                    <SectionCard isDark={isDark}>
                                        <SectionLabel>Chat Mode</SectionLabel>
                                        <div
                                            className="rounded-xl p-1"
                                            style={{ background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)' }}
                                        >
                                            <div className="relative grid grid-cols-2 gap-1" role="group" aria-label="Intelligence mode">
                                                <div
                                                    className={cn(
                                                        'absolute inset-y-0 w-[calc(50%-2px)] rounded-lg bg-primary transition-transform duration-300 ease-out',
                                                        chatMode === 'ecosystem' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
                                                    )}
                                                    style={{ boxShadow: '0 2px 8px -2px rgba(0,0,0,0.3)' }}
                                                    aria-hidden="true"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleChatModeChange('gang_focus')}
                                                    className={cn(
                                                        'relative z-10 h-10 rounded-lg px-3 text-[12px] font-semibold transition-colors',
                                                        chatMode === 'gang_focus' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                                    )}
                                                    aria-pressed={chatMode === 'gang_focus'}
                                                >
                                                    Gang Focus
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (subscriptionTier === 'free') return
                                                        handleChatModeChange('ecosystem')
                                                    }}
                                                    className={cn(
                                                        'relative z-10 h-10 rounded-lg px-3 text-[12px] font-semibold transition-colors',
                                                        subscriptionTier === 'free' && 'opacity-40 cursor-not-allowed',
                                                        chatMode === 'ecosystem' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                                    )}
                                                    aria-pressed={chatMode === 'ecosystem'}
                                                    aria-disabled={subscriptionTier === 'free'}
                                                >
                                                    Ecosystem
                                                    {subscriptionTier === 'free' && <Lock size={10} className="inline ml-1 -mt-0.5" />}
                                                </button>
                                            </div>
                                        </div>
                                        {subscriptionTier === 'free' ? (
                                            <p className="text-[11px] text-amber-500/80 mt-3 leading-relaxed">
                                                Ecosystem mode unlocks with Basic or Pro. Your gang talks freely, reacts to each other, and the chat feels alive.
                                            </p>
                                        ) : (
                                            <>
                                            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                                                {chatMode === 'gang_focus'
                                                    ? 'Replies stay focused on you. Less side chatter.'
                                                    : 'Natural group banter with side conversations.'}
                                            </p>
                                            {chatMode === 'ecosystem' && (
                                                <div className="mt-3 pt-3" style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                                                    <p className="text-[11px] font-medium text-muted-foreground mb-2">Reply Speed</p>
                                                    <div className="relative flex rounded-full bg-muted/60 p-[3px]">
                                                        <div
                                                            className="absolute top-[3px] bottom-[3px] rounded-full bg-primary transition-all duration-200 ease-out"
                                                            style={{
                                                                width: 'calc(33.333% - 2px)',
                                                                left: ecosystemSpeed === 'fast' ? '3px' : ecosystemSpeed === 'normal' ? 'calc(33.333% + 1px)' : 'calc(66.666% - 1px)',
                                                            }}
                                                        />
                                                        {(['fast', 'normal', 'relaxed'] as const).map((speed) => (
                                                            <button
                                                                key={speed}
                                                                type="button"
                                                                onClick={() => setEcosystemSpeed(speed)}
                                                                className={cn(
                                                                    'relative z-10 flex-1 rounded-full py-1.5 text-[11px] font-semibold capitalize transition-colors',
                                                                    ecosystemSpeed === speed ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                                                )}
                                                                aria-pressed={ecosystemSpeed === speed}
                                                            >
                                                                {speed}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                                                        {ecosystemSpeed === 'fast' ? 'Quick-fire replies, less waiting.' : ecosystemSpeed === 'relaxed' ? 'Slower, more natural pacing.' : 'Default conversation speed.'}
                                                    </p>
                                                </div>
                                            )}
                                            </>
                                        )}
                                    </SectionCard>
                                </m.div>

                                {/* Preferences */}
                                <m.div variants={itemVariants}>
                                    <SectionCard isDark={isDark}>
                                        <SectionLabel>Preferences</SectionLabel>
                                        <div className="space-y-0">
                                            <div className="flex items-center justify-between py-4">
                                                <div>
                                                    <p className="text-[13px] font-medium">Role Labels</p>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">Show role under character names</p>
                                                </div>
                                                <Switch
                                                    checked={showPersonaRoles}
                                                    onCheckedChange={setShowPersonaRoles}
                                                    aria-label="Toggle friend role labels"
                                                />
                                            </div>
                                            <div className="h-px" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                                            <div className="flex items-center justify-between py-4">
                                                <div>
                                                    <p className="text-[13px] font-medium">Low-Cost Mode</p>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">Fewer AI calls, smaller context</p>
                                                </div>
                                                <Switch
                                                    checked={lowCostMode}
                                                    onCheckedChange={handleLowCostModeChange}
                                                    aria-label="Toggle low-cost mode"
                                                />
                                            </div>
                                        </div>
                                    </SectionCard>
                                </m.div>

                                {/* Personalize */}
                                <m.div variants={itemVariants}>
                                    <SectionCard isDark={isDark} className="!px-2 !py-2">
                                        <div className="px-3 pt-3 pb-1">
                                            <SectionLabel>Personalize</SectionLabel>
                                        </div>
                                        <div>
                                            {subscriptionTier === 'free' ? (
                                                <div className="px-4 py-3">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 opacity-40" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                                                            <Paintbrush size={15} className="text-muted-foreground" />
                                                        </div>
                                                        <p className="text-[13px] font-medium text-muted-foreground/50">Wallpaper</p>
                                                        <Lock size={11} className="text-muted-foreground/30" />
                                                    </div>
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 opacity-40" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                                                            <PenLine size={15} className="text-muted-foreground" />
                                                        </div>
                                                        <p className="text-[13px] font-medium text-muted-foreground/50">Rename Characters</p>
                                                        <Lock size={11} className="text-muted-foreground/30" />
                                                    </div>
                                                    <Link
                                                        href="/pricing"
                                                        onClick={onClose}
                                                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
                                                    >
                                                        Upgrade to unlock
                                                        <ArrowRight size={12} />
                                                    </Link>
                                                </div>
                                            ) : (
                                                <>
                                                    <MenuRow onClick={() => setPanel('wallpaper')} chevron>
                                                        <div className="flex items-center gap-3">
                                                            <IconBox isDark={isDark}>
                                                                <Paintbrush size={15} className="text-muted-foreground" />
                                                            </IconBox>
                                                            <div>
                                                                <p className="text-[13px] font-medium">Wallpaper</p>
                                                                <p className="text-[11px] text-muted-foreground">{CHAT_WALLPAPERS.find((w) => w.id === chatWallpaper)?.label || 'Default'}</p>
                                                            </div>
                                                        </div>
                                                    </MenuRow>
                                                    <MenuRow onClick={() => { setRenameInputs({ ...customCharacterNames }); setPanel('rename') }} chevron>
                                                        <div className="flex items-center gap-3">
                                                            <IconBox isDark={isDark}>
                                                                <PenLine size={15} className="text-muted-foreground" />
                                                            </IconBox>
                                                            <div>
                                                                <p className="text-[13px] font-medium">Rename Characters</p>
                                                                <p className="text-[11px] text-muted-foreground">Give your gang custom names</p>
                                                            </div>
                                                        </div>
                                                    </MenuRow>
                                                </>
                                            )}
                                            <MenuRow onClick={async () => { await onTakeScreenshot() }}>
                                                <div className="flex items-center gap-3">
                                                    <IconBox isDark={isDark}>
                                                        <Camera size={15} className="text-muted-foreground" />
                                                    </IconBox>
                                                    <div>
                                                        <p className="text-[13px] font-medium">Capture Moment</p>
                                                        <p className="text-[11px] text-muted-foreground">Save chat as image</p>
                                                    </div>
                                                </div>
                                            </MenuRow>
                                        </div>
                                    </SectionCard>
                                </m.div>

                                {/* Account */}
                                <m.div variants={itemVariants}>
                                    <SectionCard isDark={isDark} className="!px-2 !py-2">
                                        <div className="px-3 pt-3 pb-1">
                                            <SectionLabel>Account</SectionLabel>
                                        </div>
                                        <div>
                                            <MenuRow href="/settings" onCloseDrawer={onClose} chevron>
                                                <div className="flex items-center gap-3">
                                                    <IconBox isDark={isDark}>
                                                        <Settings2 size={15} className="text-muted-foreground" />
                                                    </IconBox>
                                                    <div>
                                                        <p className="text-[13px] font-medium">Usage & Preferences</p>
                                                        <p className="text-[11px] text-muted-foreground">Detailed account settings</p>
                                                    </div>
                                                </div>
                                            </MenuRow>
                                            <MenuRow onClick={async () => {
                                                useChatStore.getState().setUserId(null)
                                                useChatStore.getState().setActiveGang([])
                                                useChatStore.getState().clearChat()
                                                useChatStore.getState().setUserName(null)
                                                useChatStore.getState().setUserNickname(null)
                                                useChatStore.getState().setCustomCharacterNames({})
                                                await signOut()
                                            }}>
                                                <div className="flex items-center gap-3">
                                                    <IconBox isDark={isDark}>
                                                        <LogOut size={15} className="text-muted-foreground" />
                                                    </IconBox>
                                                    <p className="text-[13px] font-medium">Sign Out</p>
                                                </div>
                                            </MenuRow>
                                        </div>
                                    </SectionCard>
                                </m.div>

                                {/* Danger Zone */}
                                <m.div variants={itemVariants}>
                                    <button
                                        type="button"
                                        onClick={() => setDangerExpanded(!dangerExpanded)}
                                        className="flex items-center gap-2 py-2 text-muted-foreground hover:text-destructive transition-colors"
                                        style={{ opacity: dangerExpanded ? 1 : 0.5 }}
                                    >
                                        <ShieldAlert size={13} />
                                        <span className="text-[10px] font-medium uppercase tracking-[0.15em]">Danger Zone</span>
                                        <ChevronDown size={12} className={cn('transition-transform duration-200', dangerExpanded && 'rotate-180')} />
                                    </button>

                                    <AnimatePresence>
                                        {dangerExpanded && (
                                            <m.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-3 pb-1 space-y-3">
                                                    <p className="text-[11px] text-destructive/60">
                                                        These actions cannot be undone.
                                                    </p>

                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            if (!confirm("Delete all messages? This can't be undone.")) return
                                                            const result = await deleteAllMessages()
                                                            if (!result.ok) {
                                                                alert(result.error || 'Could not delete messages right now.')
                                                                return
                                                            }
                                                            clearChat()
                                                            if (typeof window !== 'undefined') {
                                                                window.dispatchEvent(new CustomEvent('mygang:timeline-cleared'))
                                                            }
                                                            onClose()
                                                        }}
                                                        className="w-full flex items-center justify-between rounded-xl border border-destructive/20 px-4 py-3 text-destructive/70 hover:bg-destructive/8 hover:text-destructive transition-colors"
                                                    >
                                                        <span className="text-[11px] font-medium">Delete All Messages</span>
                                                        <Trash2 size={14} />
                                                    </button>

                                                    <div className="rounded-xl border border-destructive/15 px-4 py-4 space-y-3">
                                                        <label htmlFor="delete-email-confirm" className="block text-[11px] font-medium text-destructive/60">
                                                            Type your email to delete account
                                                        </label>
                                                        <input
                                                            id="delete-email-confirm"
                                                            type="email"
                                                            value={deleteEmailInput}
                                                            onChange={(event) => {
                                                                setDeleteEmailInput(event.target.value)
                                                                if (deleteEmailError) setDeleteEmailError(null)
                                                            }}
                                                            placeholder={accountEmail || 'your@email.com'}
                                                            className="h-10 w-full rounded-lg border border-destructive/20 bg-transparent px-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-destructive/50"
                                                            autoComplete="email"
                                                        />
                                                        {deleteEmailError && (
                                                            <p className="text-[10px] text-destructive/80">{deleteEmailError}</p>
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={handleDeleteAccount}
                                                            disabled={isDeleting || !accountEmail}
                                                            className="h-auto w-full justify-center rounded-xl border border-destructive/25 py-2.5 text-destructive/70 hover:bg-destructive hover:text-white hover:border-destructive disabled:opacity-40"
                                                        >
                                                            <span className="text-[11px] font-medium">{isDeleting ? 'Deleting...' : deleteConfirmStep ? 'Tap again to confirm deletion' : 'Delete Account'}</span>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </m.div>
                                        )}
                                    </AnimatePresence>
                                </m.div>

                                <div className="pt-2" />
                            </m.div>
                        </div>

                        {/* WALLPAPER PANEL */}
                        <div
                            {...(panel !== 'wallpaper' ? { inert: true } : {})}
                            className={cn(
                                'absolute inset-0 overflow-y-auto transition-all duration-300 ease-out',
                                panel === 'wallpaper' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                            )}
                        >
                            <div className="px-5 sm:px-7 py-5 sm:py-6 space-y-5">
                                <div>
                                    <h3 className="text-[18px] font-bold tracking-tight">Wallpaper</h3>
                                    <p className="text-[12px] text-muted-foreground mt-1">Visual only — doesn&apos;t affect AI behavior.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Wallpaper options">
                                    {CHAT_WALLPAPERS.map((option) => {
                                        const active = chatWallpaper === option.id
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                onClick={() => handleWallpaperChange(option.id)}
                                                className={cn(
                                                    'flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-all duration-200',
                                                    active ? 'ring-2 ring-primary/40' : ''
                                                )}
                                                style={{
                                                    background: active
                                                        ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                                                        : 'transparent',
                                                }}
                                            >
                                                <div className={cn('h-11 w-16 shrink-0 rounded-lg', wallpaperPreviewClass(option.id))} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[13px] font-medium">{option.label}</p>
                                                    <p className="truncate text-[11px] text-muted-foreground">{option.description}</p>
                                                </div>
                                                {active && (
                                                    <div className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary">
                                                        <Check className="w-3 h-3 text-primary-foreground" />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* RENAME PANEL */}
                        <div
                            {...(panel !== 'rename' ? { inert: true } : {})}
                            className={cn(
                                'absolute inset-0 overflow-y-auto transition-all duration-300 ease-out',
                                panel === 'rename' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                            )}
                        >
                            <div className="px-5 sm:px-7 py-5 sm:py-6 space-y-5">
                                <div>
                                    <h3 className="text-[18px] font-bold tracking-tight">Rename Characters</h3>
                                    <p className="text-[12px] text-muted-foreground mt-1">Leave blank to keep the default name.</p>
                                </div>
                                <div className="space-y-4">
                                    {activeGang.map((char) => (
                                        <div key={char.id}>
                                            <label htmlFor={`rename-${char.id}`} className="block text-[11px] font-medium text-muted-foreground mb-2">
                                                {char.name}
                                            </label>
                                            <input
                                                id={`rename-${char.id}`}
                                                type="text"
                                                value={renameInputs[char.id] || ''}
                                                onChange={(e) => setRenameInputs((prev) => ({ ...prev, [char.id]: e.target.value }))}
                                                onBlur={() => handleRenameCharacter(char.id, renameInputs[char.id] || '')}
                                                placeholder={char.name}
                                                maxLength={30}
                                                className="h-11 w-full rounded-xl bg-transparent px-4 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/30"
                                                style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}` }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleSaveAllNames}
                                    className="w-full rounded-xl h-11"
                                >
                                    {renameSaved ? 'Saved!' : 'Save Names'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* ─── FOOTER ─── */}
                    <div className="px-5 sm:px-7 py-4">
                        <div className="h-px mb-4" style={{ background: `linear-gradient(90deg, transparent, ${surface.footerBorder}, transparent)` }} />
                        <p className="text-center text-[9px] uppercase tracking-[0.35em] text-muted-foreground/40 select-none">
                            MyGang v1.7
                        </p>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
