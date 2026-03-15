'use client'

import { useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CharacterCatalogEntry } from '@/constants/characters'

interface FriendsIntroStepProps {
    characters: CharacterCatalogEntry[]
    selectedIds: string[]
    customNames: Record<string, string>
    onNameChange: (characterId: string, nextName: string) => void
    onNext: () => void
    onSkip: () => void
}

function CharacterDetailModal({
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
                <div className="space-y-3 p-4">
                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Role</span>
                        <p className="text-sm text-foreground">{character.roleLabel}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Vibe</span>
                        <p className="text-sm text-foreground">{character.vibe}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Voice</span>
                        <p className="text-sm text-foreground">{character.voice}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Sample</span>
                        <p className="text-sm italic text-foreground/80">&quot;{character.sample}&quot;</p>
                    </div>
                    {character.tags && character.tags.length > 0 && (
                        <div>
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Tags</span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {character.tags.map((tag) => (
                                    <span key={tag} className="rounded-full border border-border/40 bg-muted/50 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
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

export function FriendsIntroStep({
    characters,
    selectedIds,
    customNames,
    onNameChange,
    onNext,
}: FriendsIntroStepProps) {
    const selectedCharacters = characters.filter((character) => selectedIds.includes(character.id))
    const [modalCharId, setModalCharId] = useState<string | null>(null)
    const modalChar = modalCharId ? characters.find(c => c.id === modalCharId) ?? null : null

    return (
        <m.div
            key="friends-intro"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl mx-auto flex flex-col min-h-0"
        >
            <div className="text-center pt-2 sm:pt-4 pb-1.5 sm:pb-2 px-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">Want to rename your gang?</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                    Customize or keep defaults. Change anytime in settings.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto px-1 sm:px-2 pb-20 sm:pb-18">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedCharacters.map((character) => (
                        <div
                            key={character.id}
                            className="rounded-xl border border-border/50 bg-card/75 backdrop-blur-sm overflow-hidden p-3"
                        >
                            {/* Top row: avatar + name + details button */}
                            <div className="flex items-center gap-3">
                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-border/40">
                                    <Image
                                        src={character.avatar}
                                        alt={character.name}
                                        fill
                                        className="object-cover"
                                        sizes="48px"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-bold tracking-tight">{character.name}</h3>
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{character.archetype}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setModalCharId(character.id)}
                                    className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    Details
                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15">
                                        <ChevronRight className="h-2.5 w-2.5 text-emerald-400/60" />
                                    </span>
                                </button>
                            </div>

                            {/* Name input */}
                            <div className="mt-2.5">
                                <label htmlFor={`intro-name-${character.id}`} className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
                                    Change name or ignore to keep default
                                </label>
                                <input
                                    id={`intro-name-${character.id}`}
                                    type="text"
                                    value={customNames[character.id] || ''}
                                    onChange={(event) => onNameChange(character.id, event.target.value)}
                                    placeholder={character.name}
                                    maxLength={30}
                                    className="mt-1 h-9 w-full rounded-lg border border-border/40 bg-white/80 px-3 text-sm text-black outline-none transition-colors placeholder:text-black/70 focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/20"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom bar — matching other screens */}
            <div
                className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08]"
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.12) 100%)',
                    backdropFilter: 'blur(24px) saturate(1.6)',
                    WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
                }}
            >
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
                    <p className="text-xs text-muted-foreground">
                        {selectedCharacters.length} friend{selectedCharacters.length !== 1 ? 's' : ''} ready
                    </p>
                    <Button
                        size="sm"
                        onClick={onNext}
                        className="rounded-xl px-5 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 shrink-0"
                    >
                        Start Chat
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                </div>
            </div>

            {/* Detail modal */}
            <AnimatePresence>
                {modalChar && (
                    <CharacterDetailModal
                        character={modalChar}
                        onClose={() => setModalCharId(null)}
                    />
                )}
            </AnimatePresence>
        </m.div>
    )
}
