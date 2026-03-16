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

function CharacterModal({
    character,
    onClose,
}: {
    character: CharacterCatalogEntry
    onClose: () => void
}) {
    return (
        <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <m.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 w-full max-w-sm max-h-[80dvh] overflow-y-auto rounded-2xl border border-border/50 bg-card shadow-2xl"
            >
                {/* Hero image */}
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl">
                    <Image
                        src={character.avatar}
                        alt={character.name}
                        fill
                        className="object-cover"
                        sizes="400px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-black/20" />
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="text-2xl font-black text-white">{character.name}</h3>
                        <p className="text-sm font-semibold uppercase tracking-wider text-white/70">
                            {character.archetype}
                        </p>
                    </div>
                </div>

                {/* Details */}
                <div className="space-y-3 p-4">
                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                            Role
                        </span>
                        <p className="text-sm text-foreground">{character.roleLabel}</p>
                    </div>

                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                            Vibe
                        </span>
                        <p className="text-sm text-foreground">{character.vibe}</p>
                    </div>

                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                            Voice
                        </span>
                        <p className="text-sm text-foreground">{character.voice}</p>
                    </div>

                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                            Sample
                        </span>
                        <p className="text-sm italic text-foreground/80">&quot;{character.sample}&quot;</p>
                    </div>

                    {character.tags && character.tags.length > 0 && (
                        <div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                                Tags
                            </span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {character.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full border border-border/40 bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </m.div>
        </m.div>
    )
}

export function SelectionStep({ characters, selectedIds, toggleCharacter, onNext, maxMembers = 4, recommendedIds = [] }: SelectionStepProps) {
    const [modalCharId, setModalCharId] = useState<string | null>(null)

    const selectedChars = characters.filter(c => selectedIds.includes(c.id))
    const canContinue = selectedIds.length >= 2
    const modalChar = modalCharId ? characters.find(c => c.id === modalCharId) ?? null : null

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

            {/* Character grid */}
            <div className="flex-1 overflow-y-auto px-1 sm:px-2 pb-20 sm:pb-18">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                    {sortedCharacters.map((char) => {
                        const isSelected = selectedIds.includes(char.id)
                        const isRecommended = recommendedIds.includes(char.id)

                        return (
                            <m.div
                                key={char.id}
                                layout
                                data-testid={`character-${char.id}`}
                                onClick={() => toggleCharacter(char.id)}
                                onKeyDown={(e) => handleCharacterKeyDown(e, char.id)}
                                tabIndex={0}
                                role="button"
                                aria-pressed={isSelected}
                                aria-label={`${char.name}, ${char.archetype}${isSelected ? ', selected' : ''}`}
                                className={cn(
                                    "relative rounded-xl border cursor-pointer transition-all duration-300 overflow-hidden group",
                                    "bg-card/80 backdrop-blur-sm hover:bg-card",
                                    isSelected
                                        ? "border-[3px] border-primary ring-[3px] ring-primary/30 shadow-lg shadow-primary/10"
                                        : "border-border/50 hover:border-border",
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
                                    <div className="absolute top-1.5 left-1.5 right-1.5 z-10 text-[7px] uppercase tracking-wider font-bold px-1 py-0.5 rounded-full bg-primary/90 text-primary-foreground shadow-sm text-center leading-tight">
                                        Recommended
                                    </div>
                                )}

                                {/* Avatar */}
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
                                    <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

                                    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5">
                                        <h3 className="font-bold text-xs sm:text-sm text-white leading-tight">{char.name}</h3>
                                        <p className="text-[8px] sm:text-[10px] font-semibold uppercase tracking-wider text-white/70 mt-px">
                                            {char.archetype}
                                        </p>
                                    </div>
                                </div>

                                {/* Details button */}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setModalCharId(char.id)
                                    }}
                                    className="flex w-full items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground sm:py-2 sm:text-xs"
                                >
                                    Details
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15">
                                        <ChevronRight className="h-2.5 w-2.5 text-emerald-400/60" />
                                    </span>
                                </button>
                            </m.div>
                        )
                    })}
                </div>
            </div>

            {/* Bottom bar */}
            <div
                className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] dark:border-white/[0.06]"
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.12) 100%)',
                    backdropFilter: 'blur(24px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                }}
            >
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
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

            {/* Character detail modal */}
            <AnimatePresence>
                {modalChar && (
                    <CharacterModal
                        character={modalChar}
                        onClose={() => setModalCharId(null)}
                    />
                )}
            </AnimatePresence>
        </m.div>
    )
}
