'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
    const isGuest = useChatStore((state) => state.isGuest)

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
        }
    }, [isOpen, isGuest, loadMemories])

    const handleDelete = async (id: string) => {
        await deleteMemory(id)
        setMemories(prev => prev.filter(m => m.id !== id))
    }

    const handleEdit = (memory: Memory) => {
        setEditingId(memory.id)
        setEditContent(memory.content)
    }

    const handleSave = async (id: string) => {
        if (!editContent.trim()) return
        setEditingId(null)
        // Optimistic update
        setMemories(prev => prev.map(m => m.id === id ? { ...m, content: editContent } : m))
        await updateMemory(id, editContent)
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
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full max-w-md h-full bg-background/80 backdrop-blur-2xl border-l border-white/10 shadow-2xl pointer-events-auto flex flex-col pt-safe"
                    >
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-primary/20 text-primary">
                                    <Brain size={20} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg">Memory Vault</h2>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">AI Long-term Awareness</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
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
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                                        <GlassCard key={memory.id} className="p-4 border-white/10 group relative transition-all hover:border-primary/30">
                                            {editingId === memory.id ? (
                                                <div className="space-y-3">
                                                    <textarea
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary h-24 resize-none"
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
                                                    <div className="mt-3 flex items-center justify-between opacity-50 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-[9px] uppercase tracking-tighter text-muted-foreground">
                                                            {new Date(memory.created_at).toLocaleDateString()}
                                                        </span>
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(memory)}
                                                                className="h-7 w-7 rounded-full hover:bg-white/10"
                                                            >
                                                                <Edit3 size={14} />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(memory.id)}
                                                                className="h-7 w-7 rounded-full hover:bg-destructive/20 hover:text-destructive"
                                                            >
                                                                <Trash2 size={14} />
                                                            </Button>
                                                        </div>
                                                    </div>
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

                        <div className="p-6 border-t border-white/10 bg-black/20">
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
