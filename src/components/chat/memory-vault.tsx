'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, Trash2, Edit3, Check, Search, Loader2 } from 'lucide-react'
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
}

export function MemoryVault({ isOpen, onClose }: MemoryVaultProps) {
    const [memories, setMemories] = useState<Memory[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [cursor, setCursor] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const isGuest = useChatStore((state) => state.isGuest)
    const drawerRef = useRef<HTMLDivElement>(null)

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
        const focusable = drawer.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length > 0) focusable[0].focus()

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
        return () => document.removeEventListener('keydown', handleTab)
    }, [isOpen])

    const loadMemories = useCallback(async (options?: { reset?: boolean; before?: string | null }) => {
        const reset = options?.reset ?? false
        const before = options?.before ?? null
        if (reset) {
            setLoading(true)
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
            if (isGuest) {
                setMemories([])
                setLoading(false)
                return
            }
            setCursor(null)
            setHasMore(false)
            loadMemories({ reset: true, before: null })
        } else {
            setEditingId(null)
            setPendingDeleteId(null)
        }
    }, [isOpen, isGuest, loadMemories])

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
        const query = searchQuery.toLowerCase()
        return memories.filter((m) => m.content.toLowerCase().includes(query))
    }, [memories, searchQuery])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-end pointer-events-none">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                    />

                    {/* Drawer */}
                    <motion.div
                        ref={drawerRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Memory Vault"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-md h-full bg-background/80 backdrop-blur-2xl border-l border-border/50 shadow-2xl pointer-events-auto flex flex-col pt-safe"
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
                            {isGuest ? (
                                <div className="text-center py-12">
                                    <p className="text-muted-foreground text-sm">Memories are saved to your account.</p>
                                    <p className="text-[10px] uppercase mt-2 opacity-50">Sign in to unlock long-term memory.</p>
                                </div>
                            ) : loading ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                    <Loader2 className="animate-spin" size={24} />
                                    <span className="text-xs font-medium uppercase tracking-tighter">Syncing Neural Links...</span>
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
                                                        className="w-full bg-black/20 border border-border/50 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none"
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

                        <div className="p-4 sm:p-6 border-t border-border/50 bg-muted/30 dark:bg-black/20">
                            <p className="text-[10px] text-center text-muted-foreground uppercase leading-relaxed font-medium">
                                Memories shape how the gang interacts with you.<br />
                                Changes take effect immediately.
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
