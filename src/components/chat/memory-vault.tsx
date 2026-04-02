'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { X, Brain, Trash2, Edit3, Check, Search, Loader2, Lock, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/holographic/glass-card'
import { getMemoriesPage, deleteMemory, updateMemory } from '@/app/auth/actions'
import { FREE_MEMORY_VAULT_PREVIEW_LIMIT, type SubscriptionTier } from '@/lib/billing'

interface Memory {
    id: string
    content: string
    created_at: string
}

interface MemoryPageResponse {
    items: Memory[]
    hasMore: boolean
    nextBefore: string | null
    totalCount: number
    lockedCount: number
    previewLimit: number
    isPreview: boolean
    canManage: boolean
}

interface MemoryVaultProps {
    isOpen: boolean
    onClose: () => void
    tier?: SubscriptionTier
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
    const [savingId, setSavingId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)
    const [lockedPreviewCount, setLockedPreviewCount] = useState(0)
    const [previewLimit, setPreviewLimit] = useState(FREE_MEMORY_VAULT_PREVIEW_LIMIT)
    const [totalCount, setTotalCount] = useState(0)
    const [actionError, setActionError] = useState<string | null>(null)
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
            setActionError(null)
        } else {
            setLoadingMore(true)
        }
        try {
            const page = await getMemoriesPage({ before, limit: 30 }) as MemoryPageResponse
            setLockedPreviewCount(page.lockedCount ?? 0)
            setPreviewLimit(page.previewLimit || FREE_MEMORY_VAULT_PREVIEW_LIMIT)
            setTotalCount(page.totalCount ?? 0)
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
            setActionError(null)
            loadMemories({ reset: true, before: null })
        } else {
            setEditingId(null)
            setPendingDeleteId(null)
            setActionError(null)
        }
    }, [isOpen, loadMemories, tier])

    const handleDeleteConfirm = async () => {
        if (!pendingDeleteId) return
        const id = pendingDeleteId
        const original = memories.find(m => m.id === id)
        setPendingDeleteId(null)
        setIsDeleting(true)
        setActionError(null)
        // Optimistic delete
        setMemories(prev => prev.filter(m => m.id !== id))
        setTotalCount((current) => Math.max(0, current - 1))
        try {
            const result = await deleteMemory(id)
            if (!result.ok) {
                if (original) {
                    setMemories(prev => [...prev, original].sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    ))
                }
                setTotalCount((current) => current + 1)
                setActionError(result.message)
            }
        } catch {
            // Rollback on failure
            if (original) {
                setMemories(prev => [...prev, original].sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ))
            }
            setTotalCount((current) => current + 1)
            setActionError('Could not delete this memory. Please try again.')
        } finally {
            setIsDeleting(false)
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
        setSavingId(id)
        setActionError(null)
        // Optimistic update
        setMemories(prev => prev.map(m => m.id === id ? { ...m, content: editContent } : m))
        try {
            const result = await updateMemory(id, editContent)
            if (!result.ok) {
                if (previousContent !== undefined) {
                    setMemories(prev => prev.map(m => m.id === id ? { ...m, content: previousContent } : m))
                }
                setActionError(result.message)
            }
        } catch {
            // Rollback on failure
            if (previousContent !== undefined) {
                setMemories(prev => prev.map(m => m.id === id ? { ...m, content: previousContent } : m))
            }
            setActionError('Could not update this memory. Please try again.')
        } finally {
            setSavingId(null)
        }
    }

    const filteredMemories = useMemo(() => {
        const query = deferredSearch.toLowerCase()
        return memories.filter((m) => m.content.toLowerCase().includes(query))
    }, [memories, deferredSearch])
    const visibleFreeMemories = filteredMemories.slice(0, previewLimit)

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
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">What the gang remembers</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full" aria-label="Close memory vault">
                                <X size={20} />
                            </Button>
                        </div>

                        {actionError && (
                            <div className="mx-4 mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-100">
                                {actionError}
                            </div>
                        )}

                        {isFree ? (
                        <div className="flex-1 flex flex-col min-h-0">
                            {loading ? (
                                <div className="flex-1 flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-xs font-medium uppercase tracking-tighter">Syncing Neural Links...</span>
                                </div>
                            ) : (
                                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                                    <div className="rounded-[1.4rem] border border-emerald-400/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(20,184,166,0.06),rgba(255,255,255,0.02))] px-4 py-4">
                                        <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-300/75">Starter memory preview</p>
                                        <p className="mt-1 text-sm font-semibold text-foreground">Your first {previewLimit} memories stay readable here, and the gang can lightly recall a couple when it matters.</p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                            Keep talking and this starts to feel more like shared history. After {previewLimit}, the rest stays blurred until you unlock the full vault.
                                        </p>
                                        <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-white/45">
                                            {visibleFreeMemories.length} visible / {totalCount} active memories
                                        </p>
                                    </div>

                                    {visibleFreeMemories.length === 0 ? (
                                        <div className="space-y-3">
                                            {Array.from({ length: previewLimit }).map((_, index) => (
                                                <GlassCard key={`memory-slot-${index}`} className="border-border/40 bg-card/55 p-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-medium text-foreground/88">Memory slot {index + 1}</p>
                                                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                                                Empty for now. The gang will start saving the small personal things you share.
                                                            </p>
                                                        </div>
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background/55 text-muted-foreground/70">
                                                            <Brain className="h-4 w-4" />
                                                        </div>
                                                    </div>
                                                </GlassCard>
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            {visibleFreeMemories.map((memory) => (
                                                <GlassCard key={memory.id} className="p-4 border-border/50">
                                                    <p className="text-sm leading-relaxed">{memory.content}</p>
                                                    <div className="mt-3 flex items-center justify-between opacity-60">
                                                        <span className="text-[9px] uppercase tracking-tighter text-muted-foreground">
                                                            {new Date(memory.created_at).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-[9px] uppercase tracking-[0.24em] text-emerald-300/70">
                                                            Preview
                                                        </span>
                                                    </div>
                                                </GlassCard>
                                            ))}

                                            {lockedPreviewCount > 0 && (
                                                <div className="relative overflow-hidden rounded-[1.6rem] border border-border/50 bg-card/60">
                                                    <div className="space-y-3 p-4 opacity-55 blur-[3px] pointer-events-none" aria-hidden="true">
                                                        {Array.from({ length: Math.min(lockedPreviewCount, 3) }).map((_, index) => (
                                                            <GlassCard key={`locked-memory-${index}`} className="p-4 border-border/40">
                                                                <p className="text-sm leading-relaxed">
                                                                    Locked memory preview {index + 1}
                                                                </p>
                                                                <div className="mt-3 flex items-center justify-between opacity-50">
                                                                    <span className="text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
                                                                        Upgrade to reveal
                                                                    </span>
                                                                </div>
                                                            </GlassCard>
                                                        ))}
                                                    </div>
                                                    <div className="absolute inset-0 flex items-center justify-center bg-background/72 px-5 text-center">
                                                        <div className="max-w-[280px] space-y-3 rounded-2xl border border-border/60 bg-card/92 p-5 shadow-lg">
                                                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                                                <Lock className="h-5 w-5 text-primary" />
                                                            </div>
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {lockedPreviewCount} more memor{lockedPreviewCount === 1 ? 'y is' : 'ies are'} waiting in the full vault
                                                            </p>
                                                            <p className="text-xs leading-5 text-muted-foreground">
                                                                The preview stays readable. Upgrade when you want the whole archive and for the gang to remember you more deeply.
                                                            </p>
                                                            <Link
                                                                href="/pricing?upgrade=basic"
                                                                onClick={onClose}
                                                                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.03] hover:shadow-violet-500/40 active:scale-[0.98]"
                                                            >
                                                                <Sparkles size={13} />
                                                                Unlock full memory
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {lockedPreviewCount === 0 && memories.length < previewLimit && (
                                                <div className="rounded-2xl border border-dashed border-border/50 bg-background/35 px-4 py-3 text-xs leading-5 text-muted-foreground">
                                                    {previewLimit - memories.length} starter slot{previewLimit - memories.length === 1 ? '' : 's'} still open.
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-center">
                                        <p className="text-sm font-semibold text-foreground">Want the full vault?</p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                            Upgrade to unlock the entire archive, better recall, and longer-running memory behavior.
                                        </p>
                                        <Link
                                            href="/pricing?upgrade=basic"
                                            onClick={onClose}
                                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.03] hover:shadow-violet-500/40 active:scale-[0.98]"
                                        >
                                            <Sparkles size={13} />
                                            Upgrade for full memory
                                        </Link>
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
                            <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                                {totalCount} active memories
                            </p>
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
                                                    <div className="relative">
                                                        <p className="text-sm leading-relaxed pr-8">{memory.content}</p>
                                                        {savingId === memory.id && (
                                                            <span className="absolute top-0 right-0 flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                <Loader2 className="w-3 h-3 animate-spin" /> Saving
                                                            </span>
                                                        )}
                                                    </div>
                                                    {pendingDeleteId === memory.id ? (
                                                        <div className="mt-3 flex items-center justify-between">
                                                            <span className="text-xs text-destructive font-medium">Delete this memory?</span>
                                                            <div className="flex items-center gap-1.5">
                                                                <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)} className="text-xs h-7 px-2">Cancel</Button>
                                                                <Button variant="destructive" size="sm" onClick={handleDeleteConfirm} disabled={isDeleting} className="text-xs h-7 px-2">
                                                                    {isDeleting ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Deleting</> : 'Delete'}
                                                                </Button>
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
