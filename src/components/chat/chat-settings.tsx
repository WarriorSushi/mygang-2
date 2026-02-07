'use client'

import { useEffect, useMemo, useState } from 'react'
import { useChatStore } from '@/stores/chat-store'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import {
    Settings2,
    Zap,
    Trash2,
    Camera,
    ChevronRight,
    ArrowLeft,
    Paintbrush,
    Tags,
    UserRound,
    Mail,
    LogOut,
    ShieldAlert,
    Gauge,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteAccount, deleteAllMessages, signOut, updateUserSettings } from '@/app/auth/actions'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { CHAT_WALLPAPERS, type ChatWallpaper } from '@/constants/wallpapers'
import { createClient } from '@/lib/supabase/client'

type SettingsPanel = 'root' | 'mode' | 'wallpaper' | 'labels' | 'account'

interface ChatSettingsProps {
    isOpen: boolean
    onClose: () => void
    onTakeScreenshot: () => Promise<void> | void
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

export function ChatSettings({ isOpen, onClose, onTakeScreenshot }: ChatSettingsProps) {
    const {
        chatMode,
        setChatMode,
        clearChat,
        chatWallpaper,
        setChatWallpaper,
        showPersonaRoles,
        setShowPersonaRoles,
        userName,
        isGuest,
    } = useChatStore()

    const [panel, setPanel] = useState<SettingsPanel>('root')
    const [accountEmail, setAccountEmail] = useState<string | null>(null)
    const [deleteEmailInput, setDeleteEmailInput] = useState('')
    const [deleteEmailError, setDeleteEmailError] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

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
        return () => {
            mounted = false
        }
    }, [isOpen, supabase])

    const handleChatModeChange = (value: string) => {
        if (value !== 'entourage' && value !== 'ecosystem') return
        setChatMode(value)
        updateUserSettings({ chat_mode: value })
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
        onClose()
    }

    const handleDeleteAccount = async () => {
        const expectedEmail = (accountEmail || '').trim().toLowerCase()
        const typedEmail = deleteEmailInput.trim().toLowerCase()
        if (!expectedEmail || typedEmail !== expectedEmail) {
            setDeleteEmailError('Type your exact signed-in email to confirm account deletion.')
            return
        }
        const confirmed = confirm('Delete your account and all data? This cannot be undone.')
        if (!confirmed) return
        setIsDeleting(true)
        try {
            await deleteAccount()
        } finally {
            setIsDeleting(false)
        }
    }

    const menuCardClass = 'h-auto w-full justify-between rounded-2xl border border-border/70 bg-card/60 dark:bg-white/[0.09] dark:border-white/20 dark:hover:bg-white/[0.14] px-4 py-4'
    const panelCardClass = 'rounded-2xl border border-border/70 bg-card/55 dark:bg-white/[0.09] dark:border-white/20'

    return (
        <Sheet open={isOpen} onOpenChange={handleClose}>
            <SheetContent
                side="right"
                showCloseButton={false}
                className="w-[88vw] max-w-[380px] p-0 border-l border-white/10 bg-background/95 backdrop-blur-2xl text-foreground shadow-[0_0_45px_-10px_rgba(0,0,0,0.5)]"
            >
                <SheetTitle className="sr-only">Gang Controls</SheetTitle>
                <SheetDescription className="sr-only">Adjust mode, wallpaper, labels, account settings, and media controls.</SheetDescription>
                <div className="flex h-full flex-col">
                    <div className="border-b border-border/70 px-4 py-3">
                        <div className="flex items-center gap-2">
                            {panel !== 'root' && (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="rounded-full"
                                    onClick={() => setPanel('root')}
                                    aria-label="Back to settings"
                                >
                                    <ArrowLeft size={16} />
                                </Button>
                            )}
                            <div className="flex items-center gap-2">
                                <div className="rounded-lg border border-primary/20 bg-primary/15 p-1.5">
                                    <Settings2 size={14} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-wide">Gang Controls</p>
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                        {panel === 'root' && 'Main Menu'}
                                        {panel === 'mode' && 'Intelligence'}
                                        {panel === 'wallpaper' && 'Chat Wallpaper'}
                                        {panel === 'labels' && 'Persona Labels'}
                                        {panel === 'account' && 'Account'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative flex-1 overflow-hidden">
                        <div className={cn(
                            'absolute inset-0 space-y-3 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'root' ? 'translate-x-0 opacity-100' : '-translate-x-6 opacity-0 pointer-events-none'
                        )}>
                            <Button
                                variant="ghost"
                                className={menuCardClass}
                                onClick={() => setPanel('mode')}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Intelligence Mode</p>
                                    <p className="text-[11px] text-muted-foreground">Gang Focus or Ecosystem</p>
                                </div>
                                <ChevronRight size={16} />
                            </Button>

                            <Button
                                variant="ghost"
                                className={menuCardClass}
                                onClick={() => setPanel('wallpaper')}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Wallpaper</p>
                                    <p className="text-[11px] text-muted-foreground">Current: {CHAT_WALLPAPERS.find((w) => w.id === chatWallpaper)?.label || 'Default'}</p>
                                </div>
                                <Paintbrush size={16} />
                            </Button>

                            <Button
                                variant="ghost"
                                className={menuCardClass}
                                onClick={() => setPanel('labels')}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Role Labels</p>
                                    <p className="text-[11px] text-muted-foreground">Show role next to persona names in chat</p>
                                </div>
                                <Tags size={16} />
                            </Button>

                            <Button
                                variant="ghost"
                                className={menuCardClass}
                                onClick={async () => {
                                    await onTakeScreenshot()
                                }}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Capture Moment</p>
                                    <p className="text-[11px] text-muted-foreground">Download chat as PNG</p>
                                </div>
                                <Camera size={16} />
                            </Button>

                            <Button
                                variant="ghost"
                                className={menuCardClass}
                                onClick={() => setPanel('account')}
                            >
                                <div className="text-left">
                                    <p className="text-[11px] font-black uppercase tracking-wider">Account</p>
                                    <p className="text-[11px] text-muted-foreground">Email, sign out, and account actions</p>
                                </div>
                                <UserRound size={16} />
                            </Button>
                        </div>

                        <div className={cn(
                            'absolute inset-0 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'mode' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                        )}>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Zap size={12} className="text-amber-400" />
                                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Intelligence</Label>
                                </div>
                                <div className={cn(panelCardClass, 'p-1.5')}>
                                    <div className="relative grid grid-cols-2 gap-1">
                                        <div
                                            className={cn(
                                                'absolute inset-y-0 w-[calc(50%-2px)] rounded-xl bg-primary shadow-[0_8px_24px_-14px_rgba(16,185,129,0.9)] transition-transform duration-300',
                                                chatMode === 'ecosystem' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
                                            )}
                                            aria-hidden="true"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleChatModeChange('entourage')}
                                            className={cn(
                                                'relative z-10 h-11 rounded-xl px-2 text-[10px] font-black uppercase tracking-widest transition-colors',
                                                chatMode === 'entourage' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                            )}
                                            aria-pressed={chatMode === 'entourage'}
                                        >
                                            Gang Focus
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleChatModeChange('ecosystem')}
                                            className={cn(
                                                'relative z-10 h-11 rounded-xl px-2 text-[10px] font-black uppercase tracking-widest transition-colors',
                                                chatMode === 'ecosystem' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                                            )}
                                            aria-pressed={chatMode === 'ecosystem'}
                                        >
                                            Ecosystem
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    {chatMode === 'entourage'
                                        ? 'Focused on your message only. Minimal side chatter and no autonomous drifts.'
                                        : 'Natural group banter, autonomous turns, and richer side interactions.'}
                                </p>
                            </div>
                        </div>

                        <div className={cn(
                            'absolute inset-0 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'wallpaper' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                        )}>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Paintbrush size={12} className="text-fuchsia-400" />
                                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Chat Wallpaper</Label>
                                </div>
                                <p className="px-1 text-[11px] text-muted-foreground">Visual look only. Does not affect AI behavior.</p>
                                <div className="grid max-h-[calc(100dvh-210px)] grid-cols-1 gap-2 overflow-y-auto pr-1">
                                    {CHAT_WALLPAPERS.map((option) => {
                                        const active = chatWallpaper === option.id
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => handleWallpaperChange(option.id)}
                                                className={cn(
                                                    'flex w-full items-center gap-3 rounded-2xl border px-2.5 py-2 text-left transition-colors',
                                                    active
                                                        ? 'border-primary/50 bg-primary/10 dark:bg-primary/20'
                                                        : 'border-border/70 bg-card/45 dark:bg-white/[0.08] dark:border-white/20 hover:bg-card/70 dark:hover:bg-white/[0.14]'
                                                )}
                                            >
                                                <div className={cn('h-12 w-16 shrink-0 rounded-xl border border-white/15', wallpaperPreviewClass(option.id))} />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-black uppercase tracking-wider">{option.label}</p>
                                                    <p className="truncate text-[11px] text-muted-foreground">{option.description}</p>
                                                </div>
                                                {active && <span className="text-[10px] font-black uppercase tracking-widest text-primary">Active</span>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className={cn(
                            'absolute inset-0 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'labels' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                        )}>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Tags size={12} className="text-cyan-400" />
                                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Persona Labels</Label>
                                </div>
                                <div className={cn(panelCardClass, 'flex items-center justify-between px-3 py-3')}>
                                    <div className="pr-3">
                                        <p className="text-[11px] font-bold uppercase tracking-wider">Show role next to name</p>
                                        <p className="text-[11px] text-muted-foreground">Example: Nyx - the hacker</p>
                                    </div>
                                    <Switch
                                        checked={showPersonaRoles}
                                        onCheckedChange={setShowPersonaRoles}
                                        aria-label="Toggle persona role labels"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={cn(
                            'absolute inset-0 overflow-y-auto p-4 transition-all duration-250',
                            panel === 'account' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'
                        )}>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <UserRound size={12} className="text-blue-400" />
                                    <Label className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Account</Label>
                                </div>

                                <div className={cn(panelCardClass, 'px-4 py-4 space-y-2')}>
                                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                        <Mail size={12} />
                                        Signed In Email
                                    </div>
                                    <p className="text-sm font-semibold break-all">{accountEmail || (isGuest ? 'Guest mode' : 'Email unavailable')}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {userName ? `Display name: ${userName}` : 'No display name saved yet.'}
                                    </p>
                                </div>

                                <div className={cn(panelCardClass, 'p-2 space-y-2')}>
                                    <form action={signOut}>
                                        <Button type="submit" variant="ghost" className="h-auto w-full justify-between rounded-xl px-3 py-3">
                                            <span className="text-[11px] font-black uppercase tracking-wider">Sign Out</span>
                                            <LogOut size={14} />
                                        </Button>
                                    </form>
                                </div>

                                <Button
                                    variant="ghost"
                                    asChild
                                    className={menuCardClass}
                                >
                                    <Link href="/settings" onClick={onClose}>
                                        <div className="text-left">
                                            <p className="text-[11px] font-black uppercase tracking-wider">Usage & Preferences</p>
                                            <p className="text-[11px] text-muted-foreground">Detailed account and usage view</p>
                                        </div>
                                        <Gauge size={16} />
                                    </Link>
                                </Button>

                                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 dark:bg-destructive/15 p-3 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert size={13} className="text-destructive" />
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-destructive">Danger Zone</p>
                                    </div>
                                    <p className="text-[11px] text-destructive/90">
                                        These actions are irreversible. Review before continuing.
                                    </p>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-auto w-full justify-between rounded-xl border border-destructive/40 bg-background/20 px-3 py-3 text-destructive hover:bg-destructive hover:text-white"
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
                                    >
                                        <span className="text-[11px] font-black uppercase tracking-wider">Delete All Messages</span>
                                        <Trash2 size={14} />
                                    </Button>

                                    <div className="space-y-2 rounded-xl border border-destructive/35 bg-background/20 px-3 py-3">
                                        <label htmlFor="delete-email-confirm" className="block text-[10px] font-black uppercase tracking-[0.15em] text-destructive">
                                            Confirm Email To Delete Account
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
                                            className="h-10 w-full rounded-lg border border-destructive/40 bg-background/70 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-destructive"
                                            autoComplete="email"
                                        />
                                        {deleteEmailError && (
                                            <p className="text-[10px] text-destructive">{deleteEmailError}</p>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={handleDeleteAccount}
                                            disabled={isDeleting || !accountEmail}
                                            className="h-auto w-full justify-between rounded-xl border border-destructive/40 px-3 py-3 text-destructive hover:bg-destructive hover:text-white disabled:opacity-60"
                                        >
                                            <span className="text-[11px] font-black uppercase tracking-wider">Delete Account</span>
                                            <ShieldAlert size={14} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-border/70 px-4 py-2 text-center text-[9px] uppercase tracking-[0.35em] text-muted-foreground/70">
                        MyGang Stable v1.7
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
