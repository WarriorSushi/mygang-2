'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { deleteAccount, deleteAllMessages, deleteAllMemories, resetOnboarding, signOut, saveGang } from '@/app/auth/actions'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { getMessagesPerWindow, getSquadLimit, getTierCopy, getTierFromProfile } from '@/lib/billing'
import { useChatStore } from '@/stores/chat-store'
import { CHARACTERS, getCharactersForAvatarStyle } from '@/constants/characters'
import { Crown, Zap, Brain, Infinity, ArrowRight, Check, Trash2, AlertTriangle, BarChart3, RotateCcw, Sparkles, Globe, Palette, PenLine, X, Bell, BellOff, Plus, UserMinus } from 'lucide-react'
import { usePushSubscription } from '@/hooks/use-push-subscription'
import Image from 'next/image'

interface SettingsPanelProps {
    username: string | null
    email: string | null
    initialSettings: {
        theme: 'light' | 'dark'
    }
    usage: {
        subscriptionTier: string | null
    }
}

function UpgradeCard({ tier }: { tier: string | null }) {
    const normalizedTier = getTierFromProfile(tier)
    const isPro = normalizedTier === 'pro'
    const isBasic = normalizedTier === 'basic'
    const basicCopy = getTierCopy('basic')
    const freeCopy = getTierCopy('free')

    if (isPro) {
        return (
            <section className="relative rounded-3xl border border-primary/30 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5" />
                <div className="relative p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-primary/15">
                            <Crown className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-primary font-bold">Pro Plan</div>
                    </div>
                    <p className="text-sm font-semibold mt-1">You&apos;re on the best plan.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        {getTierCopy('pro').usageDescription}
                    </p>
                    <div className="mt-4 flex gap-2">
                        <Button asChild variant="outline" className="rounded-full text-[10px] uppercase tracking-widest">
                            <a href="/api/customer-portal">Manage Subscription</a>
                        </Button>
                    </div>
                </div>
            </section>
        )
    }

    if (isBasic) {
        return (
            <section className="relative rounded-3xl border border-border/50 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/3" />
                <div className="relative p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-blue-500/15">
                            <Zap className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-blue-500 dark:text-blue-400 font-bold">Basic Plan</div>
                    </div>
                    <p className="text-sm font-semibold mt-1">{basicCopy.usageHeading}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        Want unlimited? Upgrade to Pro.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button asChild className="rounded-full text-[10px] uppercase tracking-widest">
                            <Link href="/pricing">
                                Upgrade to Pro
                                <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="rounded-full text-[10px] uppercase tracking-widest">
                            <a href="/api/customer-portal">Manage</a>
                        </Button>
                    </div>
                </div>
            </section>
        )
    }

    // Free tier — enticing upgrade card
    return (
        <section className="relative rounded-3xl border border-primary/20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent" />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient" />

            <div className="relative p-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/20 text-[10px] font-bold uppercase tracking-widest text-accent mb-4">
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                    </span>
                    80% off — launch week
                </div>

                <h3 className="text-xl font-black tracking-tight">
                    Unlock the full gang experience
                </h3>
                <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed max-w-sm">
                    You&apos;re on the free tier ({freeCopy.shortMessagesLabel}, starter memory). Your gang wants to remember you.
                </p>

                <div className="mt-4 flex flex-col gap-2">
                    {[
                        { icon: <Infinity className="w-3 h-3" />, text: 'Unlimited messages' },
                        { icon: <Brain className="w-3 h-3" />, text: 'Your gang remembers everything' },
                        { icon: <Zap className="w-3 h-3" />, text: 'Zero cooldowns, ever' },
                    ].map((f) => (
                        <div key={f.text} className="flex items-center gap-2">
                            <div className="shrink-0 text-primary">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[12px] text-foreground/80">{f.text}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-5 flex flex-col sm:flex-row sm:items-end gap-4">
                    <div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black tracking-tight">$19.99</span>
                            <span className="text-xs text-muted-foreground">/mo</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            <span className="line-through opacity-50">$99/mo</span>
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild className="rounded-full text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20">
                            <Link href="/pricing">
                                <Crown className="w-3 h-3 mr-1" />
                                View Plans
                                <ArrowRight className="w-3 h-3 ml-1" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}

function NotificationsSection() {
    const { state, busy, subscribe, unsubscribe } = usePushSubscription()

    if (state === 'unsupported') {
        return (
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="flex items-center gap-2">
                    <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Notifications</div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                    Push notifications are not supported in this browser.
                </p>
            </section>
        )
    }

    if (state === 'loading') {
        return (
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Notifications</div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Checking notification status...</p>
            </section>
        )
    }

    return (
        <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
            <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Notifications</div>
            </div>
            <div className="mt-3">
                {state === 'denied' && (
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            Notifications are blocked for this site.
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">
                            To re-enable, open your browser&apos;s site settings and allow notifications for this page, then refresh.
                        </p>
                    </div>
                )}
                {state === 'subscribed' && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold">Push notifications are on</div>
                            <div className="text-[11px] text-muted-foreground">
                                This device will receive notifications from your gang.
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-widest shrink-0"
                            disabled={busy}
                            onClick={unsubscribe}
                        >
                            <BellOff className="w-3 h-3 mr-1" />
                            {busy ? 'Disabling...' : 'Disable'}
                        </Button>
                    </div>
                )}
                {(state === 'default' || state === 'unsubscribed') && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold">Get notified when your gang is active</div>
                            <div className="text-[11px] text-muted-foreground">
                                Enable push notifications so you never miss what your gang is up to.
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-widest shrink-0"
                            disabled={busy}
                            onClick={subscribe}
                        >
                            <Bell className="w-3 h-3 mr-1" />
                            {busy ? 'Enabling...' : 'Enable Notifications'}
                        </Button>
                    </div>
                )}
            </div>
        </section>
    )
}

function SquadEditorSection({ tier }: { tier: string | null }) {
    const normalizedTier = getTierFromProfile(tier)
    const squadLimit = getSquadLimit(normalizedTier)
    const activeGang = useChatStore((s) => s.activeGang)
    const avatarStyle = useChatStore((s) => s.avatarStylePreference)
    const customNames = useChatStore((s) => s.customCharacterNames)
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [selectedAddId, setSelectedAddId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

    const allCharacters = getCharactersForAvatarStyle(avatarStyle)
    const availableCharacters = allCharacters.filter(
        (c) => !activeGang.some((g) => g.id === c.id)
    )

    const canRemove = activeGang.length > 2
    const canAdd = activeGang.length < squadLimit

    const handleRemove = async (characterId: string) => {
        if (!canRemove) return
        setError(null)
        setIsSaving(true)
        try {
            const currentGang = useChatStore.getState().activeGang
            const newIds = currentGang.filter((c) => c.id !== characterId).map((c) => c.id)
            await saveGang(newIds)
            useChatStore.getState().setActiveGang(currentGang.filter((c) => c.id !== characterId))
            trackEvent('squad_remove_member', { metadata: { characterId, source: 'settings' } })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to remove member.')
        } finally {
            setIsSaving(false)
        }
    }

    const handleAdd = async (characterId: string) => {
        if (!canAdd) return
        setError(null)
        setIsSaving(true)
        try {
            const currentGang = useChatStore.getState().activeGang
            const newIds = [...currentGang.map((c) => c.id), characterId]
            await saveGang(newIds)
            const addedChar = allCharacters.find((c) => c.id === characterId)
            if (addedChar) {
                useChatStore.getState().setActiveGang([...currentGang, addedChar])
            }
            trackEvent('squad_add_member', { metadata: { characterId, source: 'settings' } })
            setAddModalOpen(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add member.')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your Squad</div>
                        <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
                            {activeGang.length}/{squadLimit}
                        </span>
                    </div>
                </div>

                {error && (
                    <p className="text-[11px] text-destructive mb-3">{error}</p>
                )}

                <div className="space-y-2">
                    {activeGang.map((member) => {
                        const displayName = customNames[member.id] || member.name
                        return (
                            <div
                                key={member.id}
                                className="flex items-center gap-3 rounded-xl bg-background/60 border border-border/30 p-2.5"
                            >
                                <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border-2" style={{ borderColor: member.color }}>
                                    {member.avatar ? (
                                        <Image
                                            src={member.avatar}
                                            alt={displayName}
                                            width={40}
                                            height={40}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: member.color }}>
                                            <span className="text-white text-sm font-bold">{displayName[0]}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold truncate">{displayName}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{member.archetype || member.vibe}</div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!canRemove || isSaving}
                                    onClick={() => {
                                        if (confirmRemoveId === member.id) {
                                            handleRemove(member.id)
                                            setConfirmRemoveId(null)
                                        } else {
                                            setConfirmRemoveId(member.id)
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => setConfirmRemoveId(null), 200)}
                                    className={cn(
                                        'shrink-0 rounded-full transition-all',
                                        confirmRemoveId === member.id
                                            ? 'h-8 w-auto px-3 bg-destructive/10 text-destructive hover:bg-destructive/20'
                                            : 'h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                    )}
                                    title={canRemove ? `Remove ${displayName}` : 'Minimum 2 members required'}
                                >
                                    {confirmRemoveId === member.id ? (
                                        <span className="text-[10px] font-semibold uppercase tracking-wider">Remove?</span>
                                    ) : (
                                        <UserMinus className="w-3.5 h-3.5" />
                                    )}
                                </Button>
                            </div>
                        )
                    })}
                </div>

                {canAdd && (
                    <Button
                        variant="outline"
                        className="w-full mt-3 rounded-xl text-[11px] uppercase tracking-widest"
                        disabled={isSaving}
                        onClick={() => {
                            setError(null)
                            setAddModalOpen(true)
                        }}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Friend
                    </Button>
                )}

                {!canAdd && (
                    <p className="text-[10px] text-muted-foreground text-center mt-3">
                        Squad full — upgrade your plan for more slots.
                    </p>
                )}
            </section>

            {/* Add Friend Modal */}
            <Dialog open={addModalOpen} onOpenChange={(open) => { setAddModalOpen(open); if (!open) setSelectedAddId(null) }}>
                <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-border/30 rounded-[1.5rem] max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-center">Add a Friend</DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground">
                            Pick someone new for your squad.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="overflow-y-auto flex-1 -mx-2 px-2 pb-2">
                        {availableCharacters.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">No more characters available.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {availableCharacters.map((char) => (
                                    <button
                                        key={char.id}
                                        type="button"
                                        disabled={isSaving}
                                        onClick={() => setSelectedAddId(selectedAddId === char.id ? null : char.id)}
                                        className={cn(
                                            'relative rounded-xl border-2 bg-card/80 overflow-hidden cursor-pointer transition-all group text-left',
                                            selectedAddId === char.id
                                                ? 'border-primary shadow-md shadow-primary/20 scale-[1.02]'
                                                : 'border-transparent hover:border-primary/30 hover:shadow-md hover:shadow-primary/10'
                                        )}
                                    >
                                        {selectedAddId === char.id && (
                                            <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                <Check className="w-3 h-3 text-primary-foreground" />
                                            </div>
                                        )}
                                        <div className="relative w-full aspect-[4/5] overflow-hidden">
                                            {char.avatar ? (
                                                <Image
                                                    src={char.avatar}
                                                    alt={char.name}
                                                    width={140}
                                                    height={175}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    sizes="140px"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: char.color }}>
                                                    <span className="text-white text-2xl font-black">{char.name[0]}</span>
                                                </div>
                                            )}
                                            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                            <div className="absolute bottom-0 left-0 right-0 p-2">
                                                <h3 className="font-bold text-xs text-white leading-tight">{char.name}</h3>
                                                <p className="text-[8px] font-semibold uppercase tracking-wider text-white/70 mt-px">{char.archetype}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedAddId && (
                        <div className="pt-2 border-t border-border/30">
                            <Button
                                onClick={() => { handleAdd(selectedAddId); setSelectedAddId(null) }}
                                disabled={isSaving}
                                className="w-full rounded-xl h-11"
                            >
                                {isSaving ? 'Adding...' : `Add ${availableCharacters.find(c => c.id === selectedAddId)?.name || 'Friend'}`}
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}

export function SettingsPanel({ username, email, initialSettings, usage }: SettingsPanelProps) {
    const router = useRouter()
    const { setTheme } = useTheme()
    const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>(initialSettings.theme)
    const [deleteEmail, setDeleteEmail] = useState('')
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [deleteConfirmStep, setDeleteConfirmStep] = useState(false)

    // Delete Chat modal state
    const [chatModalOpen, setChatModalOpen] = useState(false)
    const [isDeletingChat, setIsDeletingChat] = useState(false)
    const [chatDeleteMsg, setChatDeleteMsg] = useState<string | null>(null)

    // Delete Memories modal state
    const [memoryModalOpen, setMemoryModalOpen] = useState(false)
    const [isDeletingMemories, setIsDeletingMemories] = useState(false)
    const [memoryDeleteMsg, setMemoryDeleteMsg] = useState<string | null>(null)

    // Sign Out loading state
    const [isSigningOut, setIsSigningOut] = useState(false)

    const [freshModalOpen, setFreshModalOpen] = useState(false)
    const [isResetting, setIsResetting] = useState(false)
    const [freshMsg, setFreshMsg] = useState<string | null>(null)

    const handleTheme = (nextTheme: 'light' | 'dark') => {
        setThemeChoice(nextTheme)
        setTheme(nextTheme)
        import('@/app/auth/actions').then(m => m.updateUserSettings({ theme: nextTheme }))
    }

    const handleDeleteAllChat = async () => {
        setIsDeletingChat(true)
        setChatDeleteMsg(null)
        try {
            const result = await deleteAllMessages()
            if (!result.ok) {
                setChatDeleteMsg(result.error || 'Failed to delete.')
                return
            }
            const store = useChatStore.getState()
            store.clearChat()
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('mygang:timeline-cleared'))
            }
            setChatDeleteMsg('All chat deleted successfully.')
            trackEvent('delete_all_chat', { metadata: { source: 'settings_page' } })
            setTimeout(() => setChatModalOpen(false), 1200)
        } catch {
            setChatDeleteMsg('Something went wrong.')
        } finally {
            setIsDeletingChat(false)
        }
    }

    const handleDeleteAllMemories = async () => {
        setIsDeletingMemories(true)
        setMemoryDeleteMsg(null)
        try {
            const result = await deleteAllMemories()
            if (!result.ok) {
                setMemoryDeleteMsg(result.error || 'Failed to delete.')
                return
            }
            setMemoryDeleteMsg('All memories deleted successfully.')
            trackEvent('delete_all_memories', { metadata: { source: 'settings_page' } })
            setTimeout(() => setMemoryModalOpen(false), 1200)
        } catch {
            setMemoryDeleteMsg('Something went wrong.')
        } finally {
            setIsDeletingMemories(false)
        }
    }

    const handleStartFresh = async () => {
        setIsResetting(true)
        setFreshMsg(null)
        try {
            const result = await resetOnboarding()
            if (!result.ok) {
                setFreshMsg(result.error || 'Failed to reset.')
                return
            }
            const store = useChatStore.getState()
            store.clearChat()
            store.setActiveGang([])
            store.setUserName(null)
            store.setUserNickname(null)
            store.setCustomCharacterNames({})
            store.setNewMemoryCount(0)
            store.setTotalMemoryCount(0)
            trackEvent('start_fresh', { metadata: { source: 'settings_page' } })
            window.location.href = '/onboarding'
        } catch {
            setFreshMsg('Something went wrong.')
        } finally {
            setIsResetting(false)
        }
    }

    const tier = usage.subscriptionTier || 'free'
    const normalizedTier = getTierFromProfile(tier)
    const tierCopy = getTierCopy(normalizedTier)
    const tierLimit = getMessagesPerWindow(normalizedTier)
    const tierLabel = tierCopy.usageHeading
    const messagesRemaining = useChatStore((s) => s.messagesRemaining)
    const showUpgradeTour = useChatStore((s) => s.showUpgradeTour)

    const upgradeTourFeatures = [
        { icon: Globe, label: 'Ecosystem Mode', desc: 'All characters jump into the chat' },
        { icon: Palette, label: 'Chat Wallpapers', desc: 'Personalize your chat background' },
        { icon: PenLine, label: 'Custom Nicknames', desc: 'Rename your squad members' },
        { icon: Brain, label: 'Memory Vault', desc: 'View & edit what your gang remembers' },
    ]

    return (
        <div className="space-y-6">
            {/* Upgrade tour card */}
            {showUpgradeTour && normalizedTier !== 'free' && (
                <section className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-transparent p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <button
                        type="button"
                        onClick={() => useChatStore.getState().setShowUpgradeTour(false)}
                        className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">New features unlocked</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                        {upgradeTourFeatures.map((f) => (
                            <div key={f.label} className="flex items-start gap-2 rounded-xl bg-background/50 p-2.5">
                                <f.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[11px] font-semibold text-foreground leading-tight">{f.label}</p>
                                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => useChatStore.getState().setShowUpgradeTour(false)}
                        className="mt-3 w-full py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold transition-colors"
                    >
                        Got it!
                    </button>
                </section>
            )}

            {/* Account */}
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Account</div>
                <div className="mt-2 text-2xl font-black">{username || 'Member'}</div>
                <div className="mt-1 text-xs text-muted-foreground break-all">{email || 'Email unavailable'}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                        variant={themeChoice === 'dark' ? 'default' : 'outline'}
                        onClick={() => handleTheme('dark')}
                        aria-pressed={themeChoice === 'dark'}
                        className="rounded-full text-[10px] uppercase tracking-widest"
                    >
                        Dark
                    </Button>
                    <Button
                        variant={themeChoice === 'light' ? 'default' : 'outline'}
                        onClick={() => handleTheme('light')}
                        aria-pressed={themeChoice === 'light'}
                        className="rounded-full text-[10px] uppercase tracking-widest"
                    >
                        Light
                    </Button>
                </div>
            </section>

            {/* Plan & Upgrade */}
            <UpgradeCard tier={usage.subscriptionTier} />

            {/* Your Squad */}
            <SquadEditorSection tier={usage.subscriptionTier} />

            {/* Usage */}
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Usage</div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-lg font-bold">{tierLabel}</span>
                </div>
                <div className="mt-1.5">
                    <span className="text-[10px] text-muted-foreground capitalize">
                        {normalizedTier} tier
                    </span>
                </div>
                {/* Active usage counter */}
                {normalizedTier === 'pro' ? (
                    <div className="mt-4 flex items-center gap-2">
                        <Infinity className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">Messages: {tierCopy.messagesLabel}</span>
                    </div>
                ) : messagesRemaining !== null && messagesRemaining !== undefined ? (
                    <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">
                                {tierLimit
                                    ? `${Math.max(0, tierLimit - messagesRemaining)} / ${tierLimit} used this hour`
                                    : tierCopy.messagesLabel
                                }
                            </span>
                            <span className={`text-xs font-bold ${messagesRemaining <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {messagesRemaining} left
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    messagesRemaining <= 3
                                        ? 'bg-destructive'
                                        : messagesRemaining <= 8
                                            ? 'bg-amber-500'
                                            : 'bg-primary'
                                }`}
                                style={{
                                    width: tierLimit
                                        ? `${Math.min(100, ((tierLimit - messagesRemaining) / tierLimit) * 100)}%`
                                        : '0%'
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="mt-4">
                        <span className="text-xs text-muted-foreground">
                            Send a message to see your usage
                        </span>
                    </div>
                )}
            </section>

            {/* Notifications */}
            <NotificationsSection />

            {/* Data Management */}
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Data Management</div>
                <div className="mt-4 flex flex-col gap-3">
                    {/* Delete All Chat */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold">Delete All Chat</div>
                            <div className="text-[11px] text-muted-foreground">
                                Permanently deletes your entire chat history.
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => {
                                setChatDeleteMsg(null)
                                setChatModalOpen(true)
                            }}
                        >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete All Chat
                        </Button>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Delete All Memories */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold">Delete All Memories</div>
                            <div className="text-[11px] text-muted-foreground">
                                Permanently deletes everything your gang remembers about you.
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => {
                                setMemoryDeleteMsg(null)
                                setMemoryModalOpen(true)
                            }}
                        >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete All Memories
                        </Button>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Retake Vibe Quiz */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold">Retake Vibe Quiz</div>
                            <div className="text-[11px] text-muted-foreground">
                                Update your vibe preferences. Your chat, memories, and squad stay safe.
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-widest shrink-0"
                            onClick={() => router.push('/onboarding?retake=true')}
                        >
                            <Sparkles className="w-3 h-3 mr-1" />
                            Retake Quiz
                        </Button>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Start Fresh */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold">Start Fresh</div>
                            <div className="text-[11px] text-muted-foreground">
                                Wipes chat, memories, and squad — then restarts onboarding. Your subscription stays.
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => {
                                setFreshMsg(null)
                                setFreshModalOpen(true)
                            }}
                        >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Start Fresh
                        </Button>
                    </div>
                </div>
            </section>

            {/* Account Actions */}
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Account Actions</div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        className="rounded-full text-[10px] uppercase tracking-widest"
                        disabled={isSigningOut}
                        onClick={async () => {
                            setIsSigningOut(true)
                            try {
                                const store = useChatStore.getState()
                                store.setUserId(null)
                                store.setActiveGang([])
                                store.clearChat()
                                store.setUserName(null)
                                store.setUserNickname(null)
                                store.setCustomCharacterNames({})
                                await signOut()
                            } catch {
                                setIsSigningOut(false)
                            }
                        }}
                    >
                        {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                    </Button>
                </div>
                <div className="mt-4 space-y-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-destructive">Danger Zone</div>
                    <p className="text-[11px] text-destructive/80">Type your email to confirm account deletion. This cannot be undone.</p>
                    <input
                        type="email"
                        aria-label="Confirm email for account deletion"
                        value={deleteEmail}
                        onChange={(e) => {
                            setDeleteEmail(e.target.value)
                            if (deleteError) setDeleteError(null)
                            if (deleteConfirmStep) setDeleteConfirmStep(false)
                        }}
                        placeholder={email || 'your@email.com'}
                        className="h-10 w-full rounded-lg border border-destructive/40 bg-background/70 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-destructive"
                        autoComplete="email"
                    />
                    {deleteError && (
                        <p className="text-[10px] text-destructive">{deleteError}</p>
                    )}
                    <Button
                        variant="destructive"
                        className="rounded-full text-[10px] uppercase tracking-widest w-full"
                        disabled={isDeleting || !email || deleteEmail.trim().toLowerCase() !== (email || '').trim().toLowerCase()}
                        onClick={async () => {
                            if (!email || deleteEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
                                setDeleteError('Type your exact email to confirm.')
                                return
                            }
                            if (!deleteConfirmStep) {
                                setDeleteConfirmStep(true)
                                setDeleteError('Are you sure? Click again to permanently delete your account.')
                                return
                            }
                            setIsDeleting(true)
                            setDeleteError(null)
                            setDeleteConfirmStep(false)
                            try {
                                const result = await deleteAccount()
                                if (result && !result.ok) {
                                    setDeleteError(result.error)
                                }
                            } catch (err) {
                                const message = err instanceof Error ? err.message : ''
                                if (!message.includes('NEXT_REDIRECT')) {
                                    setDeleteError('Could not delete account. Please try again.')
                                }
                            } finally {
                                setIsDeleting(false)
                            }
                        }}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Account'}
                    </Button>
                </div>
            </section>

            {/* Delete All Chat Confirmation Modal */}
            <Dialog open={chatModalOpen} onOpenChange={setChatModalOpen}>
                <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-destructive/20 rounded-[1.5rem]">
                    <DialogHeader className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-lg font-black text-center">
                            Delete all chat messages?
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground leading-relaxed">
                            This will permanently delete your entire chat history with your gang. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {chatDeleteMsg && (
                        <p className={`text-sm text-center font-medium ${chatDeleteMsg.includes('successfully') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                            {chatDeleteMsg}
                        </p>
                    )}
                    <DialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button
                            variant="destructive"
                            className="w-full rounded-xl font-bold"
                            disabled={isDeletingChat || chatDeleteMsg?.includes('successfully')}
                            onClick={handleDeleteAllChat}
                        >
                            {isDeletingChat ? 'Deleting...' : 'Yes, delete all chat'}
                        </Button>
                        <DialogClose asChild>
                            <Button variant="outline" className="w-full rounded-xl">
                                Cancel
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete All Memories Confirmation Modal */}
            <Dialog open={memoryModalOpen} onOpenChange={setMemoryModalOpen}>
                <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-destructive/20 rounded-[1.5rem]">
                    <DialogHeader className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                            <Brain className="w-6 h-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-lg font-black text-center">
                            Delete all memories?
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground leading-relaxed">
                            Your gang will forget everything they&apos;ve learned about you — your preferences, inside jokes, everything. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {memoryDeleteMsg && (
                        <p className={`text-sm text-center font-medium ${memoryDeleteMsg.includes('successfully') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                            {memoryDeleteMsg}
                        </p>
                    )}
                    <DialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button
                            variant="destructive"
                            className="w-full rounded-xl font-bold"
                            disabled={isDeletingMemories || memoryDeleteMsg?.includes('successfully')}
                            onClick={handleDeleteAllMemories}
                        >
                            {isDeletingMemories ? 'Deleting...' : 'Yes, delete all memories'}
                        </Button>
                        <DialogClose asChild>
                            <Button variant="outline" className="w-full rounded-xl">
                                Cancel
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Start Fresh Confirmation Modal */}
            <Dialog open={freshModalOpen} onOpenChange={setFreshModalOpen}>
                <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-destructive/20 rounded-[1.5rem]">
                    <DialogHeader className="flex flex-col items-center gap-3">
                        <div className="p-3 rounded-full bg-destructive/10">
                            <RotateCcw className="w-6 h-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-lg font-black text-center">
                            Start completely fresh?
                        </DialogTitle>
                        <DialogDescription className="text-center text-sm text-muted-foreground leading-relaxed">
                            This will delete all your chat history, memories, and squad — then take you back to onboarding to set up a new gang. Your subscription and billing stay untouched.
                        </DialogDescription>
                    </DialogHeader>
                    {freshMsg && (
                        <p className={`text-sm text-center font-medium ${freshMsg.includes('successfully') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                            {freshMsg}
                        </p>
                    )}
                    <DialogFooter className="flex-col gap-2 sm:flex-col">
                        <Button
                            variant="destructive"
                            className="w-full rounded-xl font-bold"
                            disabled={isResetting}
                            onClick={handleStartFresh}
                        >
                            {isResetting ? 'Resetting...' : 'Yes, start fresh'}
                        </Button>
                        <DialogClose asChild>
                            <Button variant="outline" className="w-full rounded-xl">
                                Cancel
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
