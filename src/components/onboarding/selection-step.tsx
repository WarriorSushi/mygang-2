'use client'

import { type KeyboardEvent, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { CharacterCatalogEntry } from '@/constants/characters'
import { Check, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface SelectionStepProps {
    characters: CharacterCatalogEntry[]
    selectedIds: string[]
    toggleCharacter: (id: string) => void
    onNext: () => void
    maxMembers?: number
    recommendedIds?: string[]
}

export function SelectionStep({ characters, selectedIds, toggleCharacter, onNext, maxMembers = 4, recommendedIds = [] }: SelectionStepProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null)

    const selectedChars = characters.filter(c => selectedIds.includes(c.id))
    const canContinue = selectedIds.length >= 2

    // Sort: recommended first, then the rest
    const sortedCharacters = recommendedIds.length > 0
        ? [
            ...characters.filter(c => recommendedIds.includes(c.id)),
            ...characters.filter(c => !recommendedIds.includes(c.id)),
          ]
        : characters

    const handleCharacterKeyDown = (e: KeyboardEvent, id: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleCharacter(id)
        }
    }

    return (
        <m.div
            key="selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl mx-auto flex flex-col min-h-0"
        >
            {/* Header */}
            <div className="text-center pt-2 sm:pt-6 pb-2 sm:pb-4 px-2">
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight">Pick your gang</h2>
                <p className="text-muted-foreground text-xs sm:text-base mt-1.5">
                    Choose 2–{maxMembers} friends for your gang.
                </p>
            </div>

            {/* Character grid — compact cards, 3 cols mobile for above-the-fold fit */}
            <div className="flex-1 overflow-y-auto px-1 sm:px-2 pb-20 sm:pb-18">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                    {sortedCharacters.map((char) => {
                        const isSelected = selectedIds.includes(char.id)
                        const isExpanded = expandedId === char.id
                        const isMaxed = selectedIds.length >= maxMembers && !isSelected
                        const isRecommended = recommendedIds.includes(char.id)

                        return (
                            <m.div
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
                                    "relative rounded-xl border cursor-pointer transition-all duration-300 overflow-hidden group",
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
                                        <m.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                            className="absolute top-1.5 right-1.5 z-10 bg-primary text-primary-foreground rounded-full p-0.5 shadow-md"
                                        >
                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                        </m.div>
                                    )}
                                </AnimatePresence>

                                {/* Recommended badge */}
                                {isRecommended && !isSelected && (
                                    <div className="absolute top-1.5 right-1.5 z-10 text-[8px] uppercase tracking-wider font-bold px-1.5 py-px rounded-full bg-primary/90 text-primary-foreground shadow-sm">
                                        Match
                                    </div>
                                )}

                                {/* Avatar — compact portrait ratio */}
                                <div className="relative w-full aspect-[4/5] overflow-hidden">
                                    <div className={cn(
                                        "absolute inset-0 bg-gradient-to-br opacity-20",
                                        char.gradient
                                    )} />
                                    {char.avatar ? (
                                        <Image
                                            src={char.avatar}
                                            alt={char.name}
                                            width={160}
                                            height={200}
                                            className={cn(
                                                "w-full h-full object-cover transition-transform duration-500",
                                                isSelected ? "scale-105" : "group-hover:scale-105"
                                            )}
                                            sizes="(max-width: 640px) 32vw, (max-width: 1024px) 24vw, 160px"
                                        />
                                    ) : (
                                        <div
                                            className={cn(
                                                "w-full h-full flex items-center justify-center transition-transform duration-500",
                                                isSelected ? "scale-105" : "group-hover:scale-105"
                                            )}
                                            style={{ backgroundColor: char.color }}
                                        >
                                            <span className="text-white text-2xl sm:text-4xl font-black">{char.name[0]}</span>
                                        </div>
                                    )}
                                    {/* Bottom gradient overlay for text readability */}
                                    <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                                    {/* Name + archetype over the image */}
                                    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5">
                                        <h3 className="font-bold text-xs sm:text-sm text-white leading-tight">{char.name}</h3>
                                        <p className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wider text-white/70 mt-px">
                                            {char.archetype}
                                        </p>
                                    </div>
                                </div>

                                {/* Compact info — sample quote only, expand on tap */}
                                <div
                                    className="px-2 py-1.5 sm:px-2.5 sm:py-2"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedId(isExpanded ? null : char.id)
                                    }}
                                >
                                    <p className="text-[9px] sm:text-[11px] text-muted-foreground leading-snug line-clamp-1 italic">
                                        &quot;{char.sample}&quot;
                                    </p>

                                    <AnimatePresence>
                                        {isExpanded && (
                                            <m.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="pt-1.5 space-y-1 border-t border-border/30 mt-1.5">
                                                    <p className="text-[9px] sm:text-[11px] text-muted-foreground leading-snug italic line-clamp-none">
                                                        &quot;{char.sample}&quot;
                                                    </p>
                                                    <div>
                                                        <span className="text-[8px] uppercase tracking-widest text-muted-foreground/50">Vibe</span>
                                                        <p className="text-[10px] sm:text-xs text-foreground/80">{char.vibe}</p>
                                                    </div>
                                                    {char.tags && (
                                                        <div className="flex flex-wrap gap-0.5 pt-0.5">
                                                            {char.tags.map(tag => (
                                                                <span
                                                                    key={tag}
                                                                    className="text-[8px] uppercase tracking-wider px-1.5 py-px rounded-full bg-muted/60 text-muted-foreground border border-border/30"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </m.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </m.div>
                        )
                    })}
                </div>
            </div>

            {/* Glassmorphic bottom bar — thin, translucent, edge-to-edge, flush */}
            <div
                className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] dark:border-white/[0.06]"
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.12) 100%)',
                    backdropFilter: 'blur(24px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                }}
            >
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
                    {/* Selected avatars */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex -space-x-1.5">
                            {selectedChars.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    aria-label={`Remove ${c.name}`}
                                    className="group/avatar relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border-[1.5px] border-white/20 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                                    onClick={() => toggleCharacter(c.id)}
                                >
                                    {c.avatar ? (
                                        <Image
                                            src={c.avatar}
                                            alt={c.name}
                                            width={32}
                                            height={32}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: c.color }}>
                                            <span className="text-white text-[10px] font-bold">{c.name[0]}</span>
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/0 group-hover/avatar:bg-black/40 transition-colors flex items-center justify-center">
                                        <X className="w-2.5 h-2.5 text-white opacity-100 sm:opacity-0 sm:group-hover/avatar:opacity-100" />
                                    </div>
                                </button>
                            ))}
                            {selectedIds.length === 0 && (
                                <span className="text-[11px] text-white/40 pl-1">Pick 2–{maxMembers}</span>
                            )}
                        </div>
                        {selectedIds.length > 0 && selectedIds.length < 2 && (
                            <span className="text-[9px] text-white/40 ml-1.5">
                                {2 - selectedIds.length} more
                            </span>
                        )}
                    </div>

                    <Button
                        size="sm"
                        disabled={!canContinue}
                        data-testid="onboarding-selection-done"
                        onClick={onNext}
                        className="rounded-xl px-5 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 shrink-0"
                    >
                        Let&apos;s Go
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                </div>
            </div>
        </m.div>
    )
}
