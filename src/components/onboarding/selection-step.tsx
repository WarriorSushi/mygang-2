'use client'

import { type KeyboardEvent, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { CHARACTERS } from '@/constants/characters'
import { Check, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface SelectionStepProps {
    selectedIds: string[]
    toggleCharacter: (id: string) => void
    onNext: () => void
}

export function SelectionStep({ selectedIds, toggleCharacter, onNext }: SelectionStepProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const selectedChars = CHARACTERS.filter(c => selectedIds.includes(c.id))
    const canContinue = selectedIds.length >= 2

    const handleCharacterKeyDown = (e: KeyboardEvent, id: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleCharacter(id)
        }
    }

    return (
        <motion.div
            key="selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-3xl mx-auto flex flex-col min-h-0"
        >
            {/* Header */}
            <div className="text-center pt-6 sm:pt-10 pb-4 sm:pb-6 px-2">
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight">Pick your crew</h2>
                <p className="text-muted-foreground text-sm sm:text-base mt-2">
                    Choose 2–4 personas for your gang.
                </p>
            </div>

            {/* Character grid */}
            <div className="flex-1 overflow-y-auto px-1 sm:px-2 pb-36 sm:pb-28">
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {CHARACTERS.map((char) => {
                        const isSelected = selectedIds.includes(char.id)
                        const isExpanded = expandedId === char.id
                        const isMaxed = selectedIds.length >= 4 && !isSelected

                        return (
                            <motion.div
                                key={char.id}
                                layout
                                data-testid={`character-${char.id}`}
                                onClick={() => {
                                    if (!isMaxed) toggleCharacter(char.id)
                                }}
                                onKeyDown={(e) => handleCharacterKeyDown(e, char.id)}
                                tabIndex={0}
                                role="button"
                                aria-pressed={isSelected}
                                aria-label={`${char.name}, ${char.archetype}${isSelected ? ', selected' : ''}`}
                                className={cn(
                                    "relative rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden group",
                                    "bg-card/80 backdrop-blur-sm hover:bg-card",
                                    isSelected
                                        ? "border-primary/60 ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                                        : "border-border/50 hover:border-border",
                                    isMaxed && "opacity-40 cursor-not-allowed"
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
                                    <div className={cn(
                                        "absolute inset-0 bg-gradient-to-br opacity-20",
                                        char.gradient
                                    )} />
                                    <Image
                                        src={char.avatar}
                                        alt={char.name}
                                        width={200}
                                        height={200}
                                        className={cn(
                                            "w-full h-full object-cover transition-transform duration-500",
                                            isSelected ? "scale-105" : "group-hover:scale-105"
                                        )}
                                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 180px"
                                    />
                                    {/* Bottom gradient overlay for text readability */}
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

                                    {/* Name + archetype over the image */}
                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                        <h3 className="font-bold text-sm sm:text-base text-white leading-tight">{char.name}</h3>
                                        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-white/70">
                                            {char.archetype}
                                        </p>
                                    </div>
                                </div>

                                {/* Info section */}
                                <div className="p-3 sm:p-3.5">
                                    <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2 italic">
                                        &quot;{char.sample}&quot;
                                    </p>

                                    {/* Expand toggle */}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setExpandedId(isExpanded ? null : char.id)
                                        }}
                                        className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-foreground transition-colors flex items-center gap-1"
                                    >
                                        {isExpanded ? 'Less' : 'More'}
                                        <ChevronRight className={cn(
                                            "w-3 h-3 transition-transform",
                                            isExpanded && "rotate-90"
                                        )} />
                                    </button>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-2.5 space-y-1.5 border-t border-border/30 mt-2">
                                                    <div>
                                                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Vibe</span>
                                                        <p className="text-[11px] sm:text-xs text-foreground/80">{char.vibe}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">Voice</span>
                                                        <p className="text-[11px] sm:text-xs text-foreground/80">{char.voice}</p>
                                                    </div>
                                                    {char.tags && (
                                                        <div className="flex flex-wrap gap-1 pt-1">
                                                            {char.tags.map(tag => (
                                                                <span
                                                                    key={tag}
                                                                    className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/30"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            </div>

            {/* Bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 z-40">
                <div className="bg-background/80 backdrop-blur-2xl border-t border-border/50 px-4 sm:px-6 py-3 sm:py-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
                        {/* Selected avatars */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="flex -space-x-2">
                                {selectedChars.map((c) => (
                                    <div
                                        key={c.id}
                                        className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 border-background shadow-sm cursor-pointer hover:scale-110 transition-transform"
                                        onClick={() => toggleCharacter(c.id)}
                                        title={`Remove ${c.name}`}
                                    >
                                        <Image
                                            src={c.avatar}
                                            alt={c.name}
                                            width={36}
                                            height={36}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center">
                                            <X className="w-3 h-3 text-white opacity-0 hover:opacity-100" />
                                        </div>
                                    </div>
                                ))}
                                {selectedIds.length === 0 && (
                                    <span className="text-xs text-muted-foreground/50 pl-1">Pick 2–4</span>
                                )}
                            </div>
                            {selectedIds.length > 0 && selectedIds.length < 2 && (
                                <span className="text-[10px] text-muted-foreground/50 ml-2 hidden sm:inline">
                                    {2 - selectedIds.length} more needed
                                </span>
                            )}
                        </div>

                        <Button
                            size="lg"
                            disabled={!canContinue}
                            data-testid="onboarding-selection-done"
                            onClick={onNext}
                            className="rounded-full px-6 sm:px-10 py-3 sm:py-5 text-sm sm:text-base font-bold shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95 shrink-0"
                        >
                            Let&apos;s Go
                            <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
