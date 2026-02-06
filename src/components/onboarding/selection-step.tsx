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
            className="w-full max-w-6xl"
        >
            <div className="text-center mb-8">
                <h2 className="text-4xl font-bold mb-3 tracking-tight">Pick your Squad</h2>
                <p className="text-muted-foreground text-lg">Select exactly 4 unique friends to join your gang.</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    {tags.map(tag => (
                        <Button
                            key={tag}
                            variant={activeTag === tag ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveTag(tag)}
                            className="rounded-full text-[10px] uppercase tracking-widest"
                        >
                            {tag}
                        </Button>
                    ))}
                </div>
                <div className="flex items-center justify-center gap-3 mt-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-mono text-sm border border-primary/20">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        {selectedIds.length} / 4 Selected
                    </div>
                    <Button variant="ghost" size="sm" onClick={randomSquad} className="rounded-full">
                        <Shuffle className="w-4 h-4" />
                        Random Squad
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredCharacters.map((char) => {
                    const isSelected = selectedIds.includes(char.id)
                    return (
                        <GlassCard
                            key={char.id}
                            data-testid={`character-${char.id}`}
                            onClick={() => toggleCharacter(char.id)}
                            className={cn(
                                "p-6 cursor-pointer relative group transition-all duration-500",
                                isSelected && "ring-2 ring-primary ring-offset-4 ring-offset-background bg-primary/5"
                            )}
                        >
                            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
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

                            <div className="relative w-16 h-16 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
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
                            <h3 className="font-bold text-xl mb-1">{char.name}</h3>
                            <p className="text-xs font-black uppercase tracking-widest mb-2 opacity-60" style={{ color: char.color }}>
                                {char.archetype}
                            </p>
                            <p className="text-sm italic text-muted-foreground leading-relaxed">&quot;{char.sample}&quot;</p>

                            {isSelected && (
                                <div className="absolute top-4 right-4 bg-primary text-black rounded-full p-1.5 shadow-lg animate-in zoom-in spin-in-90 duration-300">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                            )}
                        </GlassCard>
                    )
                })}
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-3">
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

            <div className="mt-12 flex flex-col items-center gap-2">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Pick 4 to continue</div>
                <Button
                    size="xl"
                    disabled={selectedIds.length !== 4}
                    data-testid="onboarding-selection-done"
                    onClick={onNext}
                    className="rounded-full px-16 py-8 text-xl font-bold shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
                >
                    Let&apos;s Go
                </Button>
            </div>

            <Dialog open={!!previewChar} onOpenChange={() => setPreviewCharId(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Preview: {previewChar?.name}</DialogTitle>
                        <DialogDescription>{previewChar?.archetype}</DialogDescription>
                    </DialogHeader>
                    <div className="text-sm text-muted-foreground italic">"{previewChar?.sample}"</div>
                </DialogContent>
            </Dialog>
        </motion.div>
    )
}
