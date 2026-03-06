'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CHARACTERS } from '@/constants/characters'
import { CHARACTER_INTRO_MESSAGES } from '@/constants/character-messages'
import { Check, ChevronRight, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat-store'
import { saveGang, addSquadTierMembers } from '@/app/auth/actions'
import Image from 'next/image'

interface UpgradePickerModalProps {
    currentSquadIds: string[]
    newSlots: number
    newTier: 'basic' | 'pro'
    onComplete: (addedIds: string[]) => void
    onDismiss: () => void
}

export function UpgradePickerModal({
    currentSquadIds,
    newSlots,
    newTier,
    onComplete,
    onDismiss,
}: UpgradePickerModalProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const addMessage = useChatStore((s) => s.addMessage)
    const modalRef = useRef<HTMLDivElement>(null)

    // Escape key handler
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss?.() }
        document.addEventListener('keydown', handleEsc)
        return () => document.removeEventListener('keydown', handleEsc)
    }, [onDismiss])

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

    const availableCharacters = CHARACTERS.filter(
        (c) => !currentSquadIds.includes(c.id)
    )

    const isMaxed = selectedIds.length >= newSlots

    function toggleCharacter(id: string) {
        setSelectedIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id)
            if (prev.length >= newSlots) return prev
            return [...prev, id]
        })
    }

    async function handleConfirm() {
        if (selectedIds.length === 0 || saving) return
        setSaving(true)

        try {
            const updatedSquad = [...currentSquadIds, ...selectedIds]
            await saveGang(updatedSquad)
            await addSquadTierMembers(selectedIds, newTier)

            for (const id of selectedIds) {
                const introText =
                    CHARACTER_INTRO_MESSAGES[id] ?? `Hey, I just joined the gang!`
                addMessage({
                    id: `intro-${id}-${Date.now()}`,
                    speaker: id,
                    content: introText,
                    created_at: new Date().toISOString(),
                })
            }

            onComplete(selectedIds)
        } catch {
            setSaving(false)
        }
    }

    return (
        <AnimatePresence>
            <motion.div
                ref={modalRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="upgrade-picker-title"
            >
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onDismiss}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                    className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                >
                    {/* Dismiss button */}
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Header */}
                    <div className="text-center pt-8 pb-4 px-6">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
                            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4"
                        >
                            <Sparkles className="w-6 h-6 text-primary" />
                        </motion.div>
                        <h2 id="upgrade-picker-title" className="text-2xl sm:text-3xl font-black tracking-tight">
                            Your gang just got bigger!
                        </h2>
                        <p className="text-muted-foreground text-sm sm:text-base mt-2">
                            Pick {newSlots === 1 ? 'a new friend' : `up to ${newSlots} new friends`} to join your gang.
                        </p>
                    </div>

                    {/* Character grid */}
                    <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                            {availableCharacters.map((char) => {
                                const isSelected = selectedIds.includes(char.id)
                                const isDisabled = isMaxed && !isSelected

                                return (
                                    <motion.div
                                        key={char.id}
                                        layout
                                        onClick={() => {
                                            if (!isDisabled) toggleCharacter(char.id)
                                        }}
                                        tabIndex={0}
                                        role="button"
                                        aria-pressed={isSelected}
                                        aria-label={`${char.name}, ${char.archetype}${isSelected ? ', selected' : ''}`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                if (!isDisabled) toggleCharacter(char.id)
                                            }
                                        }}
                                        className={cn(
                                            'relative rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden group',
                                            'bg-card/80 backdrop-blur-sm hover:bg-card',
                                            isSelected
                                                ? 'border-primary/60 ring-2 ring-primary/30 shadow-lg shadow-primary/10'
                                                : 'border-border/50 hover:border-border',
                                            isDisabled && 'opacity-40 cursor-not-allowed'
                                        )}
                                    >
                                        {/* Selection checkmark */}
                                        <AnimatePresence>
                                            {isSelected && (
                                                <motion.div
                                                    initial={{ scale: 0, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full p-1 shadow-md"
                                                >
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Avatar */}
                                        <div className="relative w-full aspect-square overflow-hidden">
                                            <div
                                                className={cn(
                                                    'absolute inset-0 bg-gradient-to-br opacity-20',
                                                    char.gradient
                                                )}
                                            />
                                            {char.avatar ? (
                                                <Image
                                                    src={char.avatar}
                                                    alt={char.name}
                                                    width={200}
                                                    height={200}
                                                    className={cn(
                                                        'w-full h-full object-cover transition-transform duration-500',
                                                        isSelected
                                                            ? 'scale-105'
                                                            : 'group-hover:scale-105'
                                                    )}
                                                    sizes="(max-width: 640px) 45vw, 180px"
                                                />
                                            ) : (
                                                <div
                                                    className={cn(
                                                        'w-full h-full flex items-center justify-center transition-transform duration-500',
                                                        isSelected
                                                            ? 'scale-105'
                                                            : 'group-hover:scale-105'
                                                    )}
                                                    style={{ backgroundColor: char.color }}
                                                >
                                                    <span className="text-white text-4xl font-black">
                                                        {char.name[0]}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Bottom gradient for text readability */}
                                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

                                            {/* Name + archetype */}
                                            <div className="absolute bottom-0 left-0 right-0 p-3">
                                                <h3 className="font-bold text-sm sm:text-base text-white leading-tight">
                                                    {char.name}
                                                </h3>
                                                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-white/70">
                                                    {char.archetype}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Sample quote */}
                                        <div className="p-3 sm:p-3.5">
                                            <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2 italic">
                                                &quot;{char.sample}&quot;
                                            </p>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl px-4 sm:px-6 py-4">
                        <div className="flex items-center justify-between gap-3">
                            {/* Selected count */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="flex -space-x-2">
                                    {selectedIds.map((id) => {
                                        const c = CHARACTERS.find((ch) => ch.id === id)
                                        if (!c) return null
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                aria-label={`Remove ${c.name}`}
                                                className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 border-background shadow-sm cursor-pointer hover:scale-110 transition-transform group/avatar"
                                                onClick={() => toggleCharacter(c.id)}
                                            >
                                                {c.avatar ? (
                                                    <Image
                                                        src={c.avatar}
                                                        alt={c.name}
                                                        width={36}
                                                        height={36}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-full h-full flex items-center justify-center"
                                                        style={{ backgroundColor: c.color }}
                                                    >
                                                        <span className="text-white text-xs font-bold">
                                                            {c.name[0]}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover/avatar:bg-black/40 transition-colors flex items-center justify-center">
                                                    <X className="w-3 h-3 text-white opacity-100 sm:opacity-0 sm:group-hover/avatar:opacity-100" />
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                                {selectedIds.length === 0 && (
                                    <span className="text-xs text-muted-foreground/50">
                                        Pick up to {newSlots}
                                    </span>
                                )}
                                {selectedIds.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground/60 ml-1">
                                        {selectedIds.length}/{newSlots} selected
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onDismiss}
                                    className="text-muted-foreground text-xs"
                                >
                                    Later
                                </Button>
                                <Button
                                    size="lg"
                                    disabled={selectedIds.length === 0 || saving}
                                    onClick={handleConfirm}
                                    className="rounded-2xl px-6 sm:px-8 py-3 text-sm sm:text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
                                >
                                    {saving ? 'Adding...' : 'Add to Gang'}
                                    {!saving && <ChevronRight className="w-4 h-4 ml-1" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    )
}
