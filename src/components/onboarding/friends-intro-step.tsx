'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Sparkles, PenLine, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CHARACTERS } from '@/constants/characters'
import { cn } from '@/lib/utils'

interface FriendsIntroStepProps {
    selectedIds: string[]
    customNames: Record<string, string>
    onNameChange: (characterId: string, nextName: string) => void
    onNext: () => void
    onSkip: () => void
}

export function FriendsIntroStep({
    selectedIds,
    customNames,
    onNameChange,
    onNext,
    onSkip,
}: FriendsIntroStepProps) {
    const selectedCharacters = CHARACTERS.filter((character) => selectedIds.includes(character.id))

    return (
        <motion.div
            key="friends-intro"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-5xl mx-auto flex flex-col min-h-0"
        >
            <div className="text-center pt-8 sm:pt-12 pb-6 px-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-primary">
                    <Sparkles className="w-3.5 h-3.5" />
                    Meet your AI friends
                </div>
                <h2 className="mt-5 text-3xl sm:text-5xl font-black tracking-tight">Name them now, or later.</h2>
                <p className="mt-3 max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
                    These are the friends joining your first chat. You can keep their default names, personalize them now,
                    and change them later anytime in settings.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto px-1 sm:px-2 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    {selectedCharacters.map((character) => (
                        <div
                            key={character.id}
                            className="rounded-[2rem] border border-border/50 bg-card/75 backdrop-blur-sm overflow-hidden"
                        >
                            <div className="relative p-5 sm:p-6">
                                <div className={cn('absolute inset-x-0 top-0 h-24 bg-gradient-to-r opacity-15', character.gradient)} />

                                <div className="relative flex items-start gap-4">
                                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/40 bg-background/60">
                                        <Image
                                            src={character.avatar}
                                            alt={character.name}
                                            fill
                                            className="object-cover"
                                            sizes="80px"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[11px] uppercase tracking-widest text-primary/80 font-bold">
                                            {character.roleLabel}
                                        </div>
                                        <h3 className="mt-1 text-xl font-black tracking-tight">{character.name}</h3>
                                        <p className="mt-1 text-sm text-muted-foreground">{character.archetype}</p>
                                        <p className="mt-3 text-sm leading-relaxed text-foreground/85">&quot;{character.sample}&quot;</p>
                                    </div>
                                </div>

                                <div className="relative mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-border/35 bg-background/50 px-4 py-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Vibe</div>
                                        <p className="mt-2 text-sm text-foreground/85">{character.vibe}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border/35 bg-background/50 px-4 py-3">
                                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Voice</div>
                                        <p className="mt-2 text-sm text-foreground/85">{character.voice}</p>
                                    </div>
                                </div>

                                <div className="relative mt-4 rounded-2xl border border-border/35 bg-background/60 px-4 py-4">
                                    <label htmlFor={`intro-name-${character.id}`} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                                        <PenLine className="w-3.5 h-3.5" />
                                        What should they call themselves?
                                    </label>
                                    <input
                                        id={`intro-name-${character.id}`}
                                        type="text"
                                        value={customNames[character.id] || ''}
                                        onChange={(event) => onNameChange(character.id, event.target.value)}
                                        placeholder={character.name}
                                        maxLength={30}
                                        className="mt-3 h-12 w-full rounded-xl border border-border/40 bg-background/70 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/45 focus:border-primary/40"
                                    />
                                    <p className="mt-2 text-[11px] text-muted-foreground">
                                        Leave this blank to keep <span className="font-medium text-foreground/80">{character.name}</span>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="sticky bottom-0 z-30 border-t border-border/40 bg-background/85 backdrop-blur-2xl px-4 sm:px-6 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onSkip}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Skip for now
                    </button>
                    <Button
                        size="lg"
                        onClick={onNext}
                        className="rounded-2xl px-8 sm:px-10 py-5 text-sm sm:text-base font-bold shadow-lg shadow-primary/20"
                    >
                        Start Chat
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            </div>
        </motion.div>
    )
}
