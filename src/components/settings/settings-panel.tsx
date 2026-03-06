'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { deleteAccount, deleteAllMessages, deleteAllMemories, signOut } from '@/app/auth/actions'
import { trackEvent } from '@/lib/analytics'
import { useChatStore } from '@/stores/chat-store'
import { Crown, Zap, Brain, Infinity, ArrowRight, Check, Trash2, AlertTriangle } from 'lucide-react'

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
    const isPro = tier === 'pro'
    const isBasic = tier === 'basic'

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
                        Unlimited messages, full memory, zero cooldowns.
                    </p>
                    <div className="mt-4 flex gap-2">
                        <Button asChild variant="outline" className="rounded-full text-[10px] uppercase tracking-widest">
                            <Link href="/api/customer-portal">Manage Subscription</Link>
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
                    <p className="text-sm font-semibold mt-1">500 messages/month + memory</p>
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
                            <Link href="/api/customer-portal">Manage</Link>
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
                    You&apos;re on the free tier (20 msgs/hr, no memory). Your gang wants to remember you.
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

export function SettingsPanel({ username, email, initialSettings, usage }: SettingsPanelProps) {
    const { setTheme } = useTheme()
    const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>(initialSettings.theme)
    const [deleteEmail, setDeleteEmail] = useState('')
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Delete Chat modal state
    const [chatModalOpen, setChatModalOpen] = useState(false)
    const [isDeletingChat, setIsDeletingChat] = useState(false)
    const [chatDeleteMsg, setChatDeleteMsg] = useState<string | null>(null)

    // Delete Memories modal state
    const [memoryModalOpen, setMemoryModalOpen] = useState(false)
    const [isDeletingMemories, setIsDeletingMemories] = useState(false)
    const [memoryDeleteMsg, setMemoryDeleteMsg] = useState<string | null>(null)

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

    const tier = usage.subscriptionTier || 'free'
    const tierLabel = tier === 'pro' ? 'Unlimited messages' : tier === 'basic' ? '500 messages/month' : '20 messages per hour'

    return (
        <div className="space-y-6">
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

            {/* Usage */}
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your Plan</div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-lg font-bold">{tierLabel}</span>
                </div>
                <div className="mt-1.5">
                    <span className="text-[10px] text-muted-foreground capitalize">
                        {tier} tier
                    </span>
                </div>
            </section>

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
                </div>
            </section>

            {/* Account Actions */}
            <section className="rounded-3xl border border-border/50 bg-muted/40 p-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Account Actions</div>
                <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        className="rounded-full text-[10px] uppercase tracking-widest"
                        onClick={async () => {
                            const store = useChatStore.getState()
                            store.setUserId(null)
                            store.setActiveGang([])
                            store.clearChat()
                            store.setUserName(null)
                            store.setUserNickname(null)
                            store.setCustomCharacterNames({})
                            await signOut()
                        }}
                    >
                        Sign Out
                    </Button>
                </div>
                <div className="mt-4 space-y-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-destructive">Danger Zone</div>
                    <p className="text-[11px] text-destructive/80">Type your email to confirm account deletion. This cannot be undone.</p>
                    <input
                        type="email"
                        value={deleteEmail}
                        onChange={(e) => {
                            setDeleteEmail(e.target.value)
                            if (deleteError) setDeleteError(null)
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
                            setDeleteError('Are you sure? Click again to permanently delete your account.')
                            if (deleteError !== 'Are you sure? Click again to permanently delete your account.') return
                            setIsDeleting(true)
                            setDeleteError(null)
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
        </div>
    )
}
