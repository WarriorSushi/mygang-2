'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { X, Brain, Trash2, Edit3, Check, Search, Loader2, Lock, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/holographic/glass-card'
import { getMemoriesPage, deleteMemory, updateMemory } from '@/app/auth/actions'
import { useChatStore } from '@/stores/chat-store'

interface Memory {
    id: string
    content: string
    created_at: string
}

interface MemoryVaultProps {
    isOpen: boolean
    onClose: () => void
    tier?: 'free' | 'basic' | 'pro'
}

export function MemoryVault({ isOpen, onClose, tier = 'free' }: MemoryVaultProps) {
    const isFree = tier === 'free'
    const [memories, setMemories] = useState<Memory[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [cursor, setCursor] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const deferredSearch = useDeferredValue(searchQuery)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const drawerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLElement | null>(null)

    // Capture trigger element on open, restore focus on close
    useEffect(() => {
        if (isOpen) {
            triggerRef.current = document.activeElement as HTMLElement
        } else {
            triggerRef.current?.focus()
        }
    }, [isOpen])

    // Escape key to close
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // Focus trap: keep focus within the drawer
    useEffect(() => {
        if (!isOpen) return
        const drawer = drawerRef.current
        if (!drawer) return

        // Delay initial focus until React has painted dynamic content
        const rafId = requestAnimationFrame(() => {
            const focusable = drawer.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
            if (focusable.length > 0) focusable[0].focus()
        })

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return
            const currentFocusable = drawer.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
            if (currentFocusable.length === 0) return
            const first = currentFocusable[0]
            const last = currentFocusable[currentFocusable.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener('keydown', handleTab)
        return () => {
            cancelAnimationFrame(rafId)
            document.removeEventListener('keydown', handleTab)
        }
    }, [isOpen])

    const loadMemories = useCallback(async (options?: { reset?: boolean; before?: string | null }) => {
        const reset = options?.reset ?? false
        const before = options?.before ?? null
        if (reset) {
            setLoading(true)
            setLoadError(null)
        } else {
            setLoadingMore(true)
        }
        try {
            const page = await getMemoriesPage({ before, limit: 30 })
            let appendedCount = 0
            setMemories((prev) => {
                const incoming = page.items as Memory[]
                if (reset) return incoming
                const seen = new Set(prev.map((m) => m.id))
                const deduped = incoming.filter((m) => !seen.has(m.id))
                appendedCount = deduped.length
                return [...prev, ...deduped]
            })
            setCursor(page.nextBefore)
            setHasMore(page.hasMore && (reset || appendedCount > 0))
        } catch {
            setLoadError('Could not load memories. Please try again.')
        } finally {
            if (reset) {
                setLoading(false)
            } else {
                setLoadingMore(false)
            }
        }
    }, [])

    useEffect(() => {
        if (isOpen) {
            setCursor(null)
            setHasMore(false)
            setSearchQuery('')
            loadMemories({ reset: true, before: null })
        } else {
            setEditingId(null)
            setPendingDeleteId(null)
        }
    }, [isOpen, loadMemories])

    const handleDeleteConfirm = async () => {
        if (!pendingDeleteId) return
        const id = pendingDeleteId
        const original = memories.find(m => m.id === id)
        setPendingDeleteId(null)
        // Optimistic delete
        setMemories(prev => prev.filter(m => m.id !== id))
        try {
            await deleteMemory(id)
        } catch {
            // Rollback on failure
            if (original) {
                setMemories(prev => [...prev, original].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ))
            }
        }
    }

    const handleEdit = (memory: Memory) => {
        setEditingId(memory.id)
        setEditContent(memory.content)
    }

    const handleSave = async (id: string) => {
        if (!editContent.trim()) return
        const previousContent = memories.find(m => m.id === id)?.content
        setEditingId(null)
        // Optimistic update
        setMemories(prev => prev.map(m => m.id === id ? { ...m, content: editContent } : m))
        try {
            await updateMemory(id, editContent)
        } catch {
            // Rollback on failure
            if (previousContent !== undefined) {
                setMemories(prev => prev.map(m => m.id === id ? { ...m, content: previousContent } : m))
            }
        }
    }

    const filteredMemories = useMemo(() => {
        const query = deferredSearch.toLowerCase()
        return memories.filter((m) => m.content.toLowerCase().includes(query))
    }, [memories, deferredSearch])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-end pointer-events-none">
                    {/* Backdrop */}
                    <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                    />

                    {/* Drawer */}
                    <m.div
                        ref={drawerRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Memory Vault"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-md h-full bg-background/[0.97] backdrop-blur-3xl border-l border-border/50 shadow-2xl pointer-events-auto flex flex-col pt-safe"
                    >
                        <div className="p-6 border-b border-border/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-primary/20 text-primary">
                                    <Brain size={20} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg">Memory Vault</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">AI Long-term Awareness</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full" aria-label="Close memory vault">
                                <X size={20} />
                            </Button>
                        </div>

                        {isFree ? (
                        <div className="flex-1 flex flex-col min-h-0">
                            {loading ? (
                                <div className="flex-1 flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-xs font-medium uppercase tracking-tighter">Syncing Neural Links...</span>
                                </div>
                            ) : memories.length === 0 ? (
                                /* No memories saved yet -- show classic locked state */
                                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-5">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-center">
                                            <Brain className="text-muted-foreground/40" size={28} />
                                        </div>
                                        <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-background border border-border/50 flex items-center justify-center">
                                            <Lock className="text-muted-foreground/60" size={13} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-sm font-semibold text-foreground/90">Memories are a paid feature</h3>
                                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                                            The gang can&apos;t remember your conversations on the free plan. Upgrade so they never forget what matters to you.
                                        </p>
                                    </div>
                                    <Link
                                        href="/pricing"
                                        onClick={onClose}
                                        className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all hover:scale-[1.03] active:scale-[0.98]"
                                    >
                                        <Sparkles size={15} className="opacity-80 group-hover:opacity-100 transition-opacity" />
                                        <span>Unlock Memories — 80% off</span>
                                    </Link>
                                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">Limited time offer</p>
                                </div>
                            ) : (
                                /* Ghost memories: blurred memories with upgrade overlay */
                                <div className="flex-1 relative overflow-hidden">
                                    <div className="blur-sm pointer-events-none opacity-60 p-4 sm:p-6 space-y-4" aria-hidden="true">
                                        {memories.slice(0, 8).map((memory) => (
                                            <GlassCard key={memory.id} className="p-4 border-border/50">
                                                <p className="text-sm leading-relaxed">{memory.content}</p>
                                                <div className="mt-3 flex items-center justify-between opacity-50">
                                                    <span className="text-[9px] uppercase tracking-tighter text-muted-foreground">
                                                        {new Date(memory.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </GlassCard>
                                        ))}
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                                        <div className="bg-card/90 backdrop-blur-sm rounded-xl p-5 text-center space-y-3 border border-border shadow-lg max-w-[280px]">
                                            <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Lock className="w-5 h-5 text-primary" />
                                            </div>
                                            <p className="text-sm font-semibold text-foreground">
                                                Your gang has stored {memories.length} memor{memories.length === 1 ? 'y' : 'ies'} about you
                                            </p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                They remember things, but can&apos;t use them on the free plan. Upgrade to unlock memory-powered conversations.
                                            </p>
                                            <Link
                                                href="/pricing?upgrade=basic"
                                                onClick={onClose}
                                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white rounded-full text-xs font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all hover:scale-[1.03] active:scale-[0.98]"
                                            >
                                                <Sparkles size={13} />
                                                Unlock Memories
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        ) : (<>
                        {/* Search */}
                        <div className="p-4 px-6 pb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search memories..."
                                    aria-label="Search memories"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-muted/40 border border-border/50 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-xs font-medium uppercase tracking-tighter">Syncing Neural Links...</span>
                                </div>
                            ) : loadError ? (
                                <div className="text-center py-12 space-y-3">
                                    <p className="text-destructive text-sm font-medium">{loadError}</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadMemories({ reset: true, before: null })}
                                        className="rounded-full text-[10px] uppercase tracking-widest"
                                    >
                                        Try Again
                                    </Button>
                                </div>
                            ) : filteredMemories.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-muted-foreground text-sm">No memories found.</p>
                                    <p className="text-[10px] uppercase mt-2 opacity-50">The gang hasn&apos;t saved any facts yet.</p>
                                </div>
                            ) : (
                                <>
                                    {filteredMemories.map((memory) => (
                                        <GlassCard key={memory.id} className="p-4 border-border/50 group relative transition-all hover:border-primary/30">
                                            {editingId === memory.id ? (
                                                <div className="space-y-3">
                                                    <textarea
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        aria-label="Edit memory content"
                                                        maxLength={500}
                                                        className="w-full bg-muted/40 dark:bg-black/20 border border-border/50 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none"
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="text-xs h-8">Cancel</Button>
                                                        <Button size="sm" onClick={() => handleSave(memory.id)} className="text-xs h-8 gap-1">
                                                            <Check size={14} /> Save
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-sm leading-relaxed pr-8">{memory.content}</p>
                                                    {pendingDeleteId === memory.id ? (
                                                        <div className="mt-3 flex items-center justify-between">
                                                            <span className="text-xs text-destructive font-medium">Delete this memory?</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)} className="text-xs h-7 px-2">Cancel</Button>
                                                                <Button variant="destructive" size="sm" onClick={handleDeleteConfirm} className="text-xs h-7 px-2">Delete</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-3 flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity">
                                                            <span className="text-[9px] uppercase tracking-tighter text-muted-foreground">
                                                                {new Date(memory.created_at).toLocaleDateString()}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleEdit(memory)}
                                                                    className="h-9 w-9 rounded-full hover:bg-muted/60"
                                                                    aria-label="Edit memory"
                                                                >
                                                                    <Edit3 size={14} />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => setPendingDeleteId(memory.id)}
                                                                    className="h-9 w-9 rounded-full hover:bg-destructive/20 hover:text-destructive"
                                                                    aria-label="Delete memory"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </GlassCard>
                                    ))}
                                    {hasMore && !searchQuery && (
                                        <div className="flex justify-center pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => loadMemories({ reset: false, before: cursor })}
                                                disabled={loadingMore}
                                                className="rounded-full text-[10px] uppercase tracking-widest"
                                            >
                                                {loadingMore ? (
                                                    <>
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        Loading
                                                    </>
                                                ) : (
                                                    'Load More'
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        </>)}

                        {!isFree && (
                        <div className="p-4 sm:p-6 border-t border-border/50 bg-muted/30 dark:bg-black/20">
                            <p className="text-[10px] text-center text-muted-foreground uppercase leading-relaxed font-medium">
                                Memories shape how the gang interacts with you.<br />
                                Changes take effect immediately.
                            </p>
                        </div>
                        )}
                    </m.div>
                </div>
            )}
        </AnimatePresence>
    )
}
