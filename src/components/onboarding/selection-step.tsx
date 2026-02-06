'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GlassCard } from '@/components/holographic/glass-card'
import { CHARACTERS } from '@/constants/characters'
import { Check, Shuffle, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface SelectionStepProps {
    selectedIds: string[]
    toggleCharacter: (id: string) => void
    onNext: () => void
}

export function SelectionStep({ selectedIds, toggleCharacter, onNext }: SelectionStepProps) {
    const [activeTag, setActiveTag] = useState('all')
    const [previewCharId, setPreviewCharId] = useState<string | null>(null)

    const tags = useMemo(() => {
        const allTags = CHARACTERS.flatMap(c => c.tags || [])
        return ['all', ...Array.from(new Set(allTags))]
    }, [])

    const filteredCharacters = useMemo(() => {
        if (activeTag === 'all') return CHARACTERS
        return CHARACTERS.filter(c => c.tags?.includes(activeTag))
    }, [activeTag])

    const selectedChars = CHARACTERS.filter(c => selectedIds.includes(c.id))
    const previewChar = CHARACTERS.find(c => c.id === previewCharId) || null

    const tagDescriptions: Record<string, string> = {
        hype: 'Amplifies energy, celebrates wins, keeps momentum.',
        social: 'Keeps the group talking and makes intros smooth.',
        style: 'High taste, sharp opinions, and aesthetic flair.',
        logic: 'Grounded reasoning with calm, structured takes.',
        roast: 'Playful jabs, dry humor, and quick comebacks.',
        ops: 'Direct, tactical advice with action-first bias.',
        support: 'Protective, reassuring, and emotionally steady.',
        empath: 'Emotionally attuned, validating, and reflective.',
        vibes: 'Atmosphere setter with mood-sensitive responses.',
        chaos: 'Unpredictable energy that sparks wild turns.',
        facts: 'Evidence-first, clarifies details and context.',
        art: 'Poetic, creative, and metaphor-driven.',
        philosophy: 'Abstract, reflective, big-picture framing.',
        drama: 'Spicy reactions and emotionally loud commentary.',
    }

    const getInteractionNotes = (tags: string[] = []) => {
        const has = (t: string) => tags.includes(t)
        if (has('chaos') && has('hype')) return 'Adds fireworks in group chats and pushes bold moves.'
        if (has('logic') && has('facts')) return 'Balances the crew with precise, grounded thinking.'
        if (has('empath') || has('support')) return 'Reads the room and smooths tension between others.'
        if (has('drama') || has('social')) return 'Keeps banter alive and stirs playful reactions.'
        if (has('art') || has('philosophy')) return 'Brings depth, perspective, and unexpected angles.'
        return 'Flexible energy that adapts to whoever is speaking.'
    }

    const getBestWith = (tags: string[] = []) => {
        const has = (t: string) => tags.includes(t)
        if (has('chaos')) return 'Pairs well with Support or Ops to keep things balanced.'
        if (has('logic') || has('facts')) return 'Pairs well with Hype or Drama to keep energy high.'
        if (has('empath') || has('support')) return 'Pairs well with Chaos or Roast to soften edges.'
        if (has('drama') || has('social')) return 'Pairs well with Logic for grounded counterpoints.'
        if (has('art') || has('philosophy')) return 'Pairs well with Social for expressive back-and-forth.'
        return 'Fits into most crews without dominating the vibe.'
    }

    const applySelection = (newIds: string[]) => {
        const current = new Set(selectedIds)
        const target = new Set(newIds)
        current.forEach((id) => {
            if (!target.has(id)) toggleCharacter(id)
        })
        target.forEach((id) => {
            if (!current.has(id)) toggleCharacter(id)
        })
    }

    const randomSquad = () => {
        const support = CHARACTERS.filter(c => c.tags?.includes('support') || c.tags?.includes('empath'))
        const chaos = CHARACTERS.filter(c => c.tags?.includes('chaos'))
        const logic = CHARACTERS.filter(c => c.tags?.includes('logic') || c.tags?.includes('facts'))
        const social = CHARACTERS.filter(c => c.tags?.includes('social') || c.tags?.includes('drama') || c.tags?.includes('style'))

        const pick = (list: typeof CHARACTERS) => list[Math.floor(Math.random() * list.length)]

        const picks = new Set<string>()
        if (support.length) picks.add(pick(support).id)
        if (chaos.length) picks.add(pick(chaos).id)
        if (logic.length) picks.add(pick(logic).id)
        if (social.length) picks.add(pick(social).id)

        while (picks.size < 4) {
            picks.add(pick(CHARACTERS).id)
        }

        applySelection(Array.from(picks).slice(0, 4))
    }

    return (
        <motion.div
            key="selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-6xl mx-auto flex flex-col gap-6 pb-24 sm:pb-12"
        >
            <div className="sticky top-3 sm:top-6 z-20">
                <div className="rounded-3xl border border-white/10 bg-background/70 backdrop-blur-xl px-4 sm:px-6 py-4 sm:py-5 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)]">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Pick your Gang</h2>
                            <p className="text-muted-foreground text-sm sm:text-base">Select exactly 4 unique friends to join your gang.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-mono text-xs border border-primary/20">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                                {selectedIds.length} / 4 Selected
                            </div>
                            <Button variant="ghost" size="sm" onClick={randomSquad} className="rounded-full">
                                <Shuffle className="w-4 h-4" />
                                Random Gang
                            </Button>
                        </div>
                    </div>
                    <div className="flex items-center justify-start gap-2 mt-3 overflow-x-auto sm:flex-wrap sm:justify-center sm:overflow-visible">
                        {tags.map(tag => (
                            <Button
                                key={tag}
                                variant={activeTag === tag ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveTag(tag)}
                                className="rounded-full text-[10px] uppercase tracking-widest shrink-0"
                            >
                                {tag}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {filteredCharacters.map((char) => {
                    const isSelected = selectedIds.includes(char.id)
                    return (
                        <GlassCard
                            key={char.id}
                            data-testid={`character-${char.id}`}
                            onClick={() => toggleCharacter(char.id)}
                            className={cn(
                                "p-4 sm:p-6 cursor-pointer relative group transition-all duration-500 flex items-start gap-4 sm:block",
                                isSelected && "ring-2 ring-primary ring-offset-4 ring-offset-background bg-primary/5"
                            )}
                        >
                            <div className="absolute top-3 right-3 z-10 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setPreviewCharId(char.id)
                                    }}
                                    className="rounded-full text-[10px] uppercase tracking-widest"
                                >
                                    <Play className="w-3 h-3" />
                                    Preview
                                </Button>
                            </div>

                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 mb-0 sm:mb-6 flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                                <div className={cn(
                                    "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-50 blur-sm",
                                    char.gradient
                                )} />
                                <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/20 shadow-lg">
                                    <Image
                                        src={char.avatar}
                                        alt={char.name}
                                        width={64}
                                        height={64}
                                        className="w-full h-full object-cover"
                                        sizes="64px"
                                        priority={false}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base sm:text-xl mb-1">{char.name}</h3>
                                <p className="text-[11px] sm:text-xs font-black uppercase tracking-widest mb-1 sm:mb-2 opacity-60" style={{ color: char.color }}>
                                    {char.archetype}
                                </p>
                                <p className="text-[13px] sm:text-sm italic text-muted-foreground leading-relaxed max-h-12 overflow-hidden sm:max-h-none">
                                    &quot;{char.sample}&quot;
                                </p>
                            </div>

                            {isSelected && (
                                <div className="absolute top-4 right-4 bg-primary text-black rounded-full p-1.5 shadow-lg animate-in zoom-in spin-in-90 duration-300">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                            )}
                        </GlassCard>
                    )
                })}
            </div>

            <div className="mt-4 sm:mt-6">
                <div className="md:hidden flex items-stretch gap-2 overflow-x-auto pb-2">
                    {selectedChars.map((char) => (
                        <div key={char.id} className="min-w-[150px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-widest opacity-60" style={{ color: char.color }}>{char.archetype}</div>
                            <div className="text-sm font-bold">{char.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">{char.vibe}</div>
                        </div>
                    ))}
                    {selectedChars.length < 4 && (
                        <div className="min-w-[150px] rounded-2xl border border-dashed border-white/10 px-3 py-2 text-xs text-muted-foreground flex items-center justify-center">
                            Pick 4 to continue
                        </div>
                    )}
                </div>
                <div className="hidden md:grid grid-cols-1 md:grid-cols-4 gap-3">
                    {selectedChars.map((char) => (
                        <div key={char.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="text-xs uppercase tracking-widest opacity-60" style={{ color: char.color }}>{char.archetype}</div>
                            <div className="text-lg font-bold">{char.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">{char.vibe}</div>
                        </div>
                    ))}
                    {selectedChars.length < 4 && (
                        <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground flex items-center justify-center">
                            Pick 4 to continue
                        </div>
                    )}
                </div>
            </div>

            <div className="sticky bottom-4 sm:static z-20">
                <div className="rounded-3xl border border-white/10 bg-background/80 backdrop-blur-xl sm:bg-transparent sm:border-transparent sm:backdrop-blur-0 px-4 sm:px-0 py-4 sm:py-0 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.8)] sm:shadow-none flex flex-col items-center gap-2">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">Pick 4 to continue</div>
                    <Button
                        size="xl"
                        disabled={selectedIds.length !== 4}
                        data-testid="onboarding-selection-done"
                        onClick={onNext}
                        className="rounded-full px-10 sm:px-16 py-6 sm:py-8 text-lg sm:text-xl font-bold shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
                    >
                        Let&apos;s Go
                    </Button>
                </div>
            </div>

            <Dialog open={!!previewChar} onOpenChange={() => setPreviewCharId(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Preview: {previewChar?.name}</DialogTitle>
                        <DialogDescription>{previewChar?.archetype}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground italic">"{previewChar?.sample}"</div>
                        <div className="grid gap-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Vibe</div>
                                <div className="text-sm font-semibold">{previewChar?.vibe}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Voice</div>
                                <div className="text-sm">{previewChar?.voice}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">How They Interact</div>
                                <div className="text-sm">{getInteractionNotes(previewChar?.tags)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Best With</div>
                                <div className="text-sm">{getBestWith(previewChar?.tags)}</div>
                            </div>
                            {previewChar?.tags?.length ? (
                                <div>
                                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Traits</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {previewChar.tags.map((tag) => (
                                            <span key={tag} className="text-[11px] uppercase tracking-widest rounded-full border border-white/10 px-3 py-1">
                                                {tagDescriptions[tag] || tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
