'use client'

import { useState, useEffect, useRef } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Check, HeartCrack, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface SquadMember {
    id: string
    name: string
    color: string
    avatar?: string
    archetype?: string
    gradient?: string
}

interface DowngradeKeeperModalProps {
    currentSquad: SquadMember[]
    maxKeep: number
    autoRemovableIds: string[]
    onConfirm: (keepIds: string[]) => void | Promise<void>
    onAutoRemove: () => void | Promise<void>
}

export function DowngradeKeeperModal({
    currentSquad,
    maxKeep,
    autoRemovableIds,
    onConfirm,
    onAutoRemove,
}: DowngradeKeeperModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isSaving, setIsSaving] = useState(false)
    const modalRef = useRef<HTMLDivElement>(null)

    // Note: no Escape key handler — this modal is NOT dismissible (user must choose)

    // Basic focus trap
    useEffect(() => {
        const modal = modalRef.current
        if (!modal) return
        const focusable = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length > 0) focusable[0].focus()

        const handleTab = (e: KeyboardEvent) => {
            if (e.key !== 'Tab' || !modal) return
            const focusableEls = modal.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
            if (focusableEls.length === 0) return
            const first = focusableEls[0]
            const last = focusableEls[focusableEls.length - 1]
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
    }, [])

    const selectedCount = selectedIds.size
    const isReady = selectedCount === maxKeep
    const removedMembers = currentSquad.filter(c => !selectedIds.has(c.id))

    function toggleMember(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else if (next.size < maxKeep) {
                next.add(id)
            }
            return next
        })
    }

    async function handleConfirm() {
        if (!isReady) return
        setIsSaving(true)
        try {
            await onConfirm(Array.from(selectedIds))
        } finally {
            setIsSaving(false)
        }
    }

    async function handleAutoRemove() {
        setIsSaving(true)
        try {
            await onAutoRemove()
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <LazyMotion features={domAnimation}>
        <AnimatePresence>
            <m.div
                ref={modalRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="downgrade-keeper-title"
            >
                {/* Backdrop - NOT dismissible */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

                {/* Modal */}
                <m.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-background/80 backdrop-blur-3xl border border-border/50 rounded-3xl shadow-2xl"
                >
                    {/* Top accent bar */}
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-t-3xl" />

                    <div className="p-6 sm:p-8">
                        {/* Header */}
                        <div className="flex flex-col items-center gap-3 pb-5">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                <HeartCrack className="w-6 h-6 text-amber-500" />
                            </div>
                            <h2 id="downgrade-keeper-title" className="text-xl sm:text-2xl font-black text-center tracking-tight">
                                Your plan has changed
                            </h2>
                            <p className="text-sm text-muted-foreground/80 text-center leading-relaxed max-w-sm">
                                Your new plan supports up to {maxKeep} gang members.
                                Choose who stays — your chat history with everyone is safe.
                            </p>
                        </div>

                        {/* Selection counter */}
                        <div className="flex items-center justify-center gap-2 pb-4">
                            <span className={cn(
                                "text-sm font-semibold tabular-nums transition-colors",
                                isReady ? "text-green-500" : "text-muted-foreground"
                            )}>
                                {selectedCount} of {maxKeep} selected
                            </span>
                            {!isReady && selectedCount > 0 && (
                                <span className="text-xs text-muted-foreground/50">
                                    ({maxKeep - selectedCount} more needed)
                                </span>
                            )}
                        </div>

                        {/* Character grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {currentSquad.map((member) => {
                                const isSelected = selectedIds.has(member.id)
                                const isMaxed = selectedCount >= maxKeep && !isSelected

                                return (
                                    <m.button
                                        key={member.id}
                                        type="button"
                                        onClick={() => toggleMember(member.id)}
                                        disabled={isSaving || isMaxed}
                                        aria-pressed={isSelected}
                                        aria-label={`${member.name}${member.archetype ? ` — ${member.archetype}` : ''}: ${isSelected ? 'selected' : 'not selected'}`}
                                        whileTap={{ scale: 0.97 }}
                                        className={cn(
                                            "relative rounded-2xl border overflow-hidden transition-all duration-300 group text-left",
                                            "bg-card/80 backdrop-blur-sm",
                                            isSelected
                                                ? "border-primary/60 ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                                                : "border-border/50 hover:border-border",
                                            isMaxed && "opacity-35 cursor-not-allowed",
                                            !isMaxed && !isSaving && "cursor-pointer"
                                        )}
                                    >
                                        {/* Selection checkmark */}
                                        <AnimatePresence>
                                            {isSelected && (
                                                <m.div
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1 shadow-md"
                                                >
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </m.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Avatar */}
                                        <div className="relative w-full aspect-square overflow-hidden">
                                            <div className={cn(
                                                "absolute inset-0 bg-gradient-to-br opacity-20",
                                                member.gradient
                                            )} />
                                            {member.avatar ? (
                                                <Image
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    width={160}
                                                    height={160}
                                                    className={cn(
                                                        "w-full h-full object-cover transition-transform duration-500",
                                                        isSelected ? "scale-105" : "group-hover:scale-105"
                                                    )}
                                                    sizes="(max-width: 640px) 40vw, 150px"
                                                />
                                            ) : (
                                                <div
                                                    className={cn(
                                                        "w-full h-full flex items-center justify-center transition-transform duration-500",
                                                        isSelected ? "scale-105" : "group-hover:scale-105"
                                                    )}
                                                    style={{ backgroundColor: member.color }}
                                                >
                                                    <span className="text-white text-3xl font-black">
                                                        {member.name[0]}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Gradient overlay */}
                                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

                                            {/* Name over image */}
                                            <div className="absolute bottom-0 left-0 right-0 p-2.5">
                                                <h3 className="font-bold text-sm text-white leading-tight">
                                                    {member.name}
                                                </h3>
                                                {member.archetype && (
                                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                                                        {member.archetype}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </m.button>
                                )
                            })}
                        </div>

                        {/* Removed preview */}
                        <AnimatePresence>
                            {selectedCount > 0 && removedMembers.length > 0 && (
                                <m.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-4 rounded-2xl border border-border/30 bg-muted/30 p-3">
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-2">
                                            Will be paused
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {removedMembers.map(m => (
                                                <span
                                                    key={m.id}
                                                    className="text-[11px] px-2.5 py-1 rounded-full bg-muted/60 text-muted-foreground border border-border/30"
                                                >
                                                    {m.name}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground/50 mt-2 italic">
                                            We&apos;re sorry to see them go, but your chat history stays safe.
                                        </p>
                                    </div>
                                </m.div>
                            )}
                        </AnimatePresence>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 mt-6">
                            <Button
                                onClick={handleConfirm}
                                disabled={!isReady || isSaving}
                                className={cn(
                                    "w-full h-12 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98] shadow-lg",
                                    isReady
                                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20"
                                        : ""
                                )}
                            >
                                <Sparkles className="w-4 h-4 mr-1.5" />
                                {isReady
                                    ? `Keep these ${maxKeep} members`
                                    : `Select ${maxKeep - selectedCount} more`
                                }
                            </Button>

                            {autoRemovableIds.length > 0 && (
                                <>
                                    {/* Divider */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-border/40" />
                                        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                                            or
                                        </span>
                                        <div className="flex-1 h-px bg-border/40" />
                                    </div>

                                    <Button
                                        variant="outline"
                                        onClick={handleAutoRemove}
                                        disabled={isSaving}
                                        className="w-full h-10 rounded-2xl text-[13px] font-semibold border-border/50 text-muted-foreground hover:text-foreground transition-all"
                                    >
                                        Decide for me
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </m.div>
            </m.div>
        </AnimatePresence>
        </LazyMotion>
    )
}
