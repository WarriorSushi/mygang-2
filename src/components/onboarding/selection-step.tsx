'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/holographic/glass-card'
import { CHARACTERS } from '@/constants/characters'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectionStepProps {
    selectedIds: string[]
    toggleCharacter: (id: string) => void
    onNext: () => void
}

export function SelectionStep({ selectedIds, toggleCharacter, onNext }: SelectionStepProps) {
    return (
        <motion.div
            key="selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-5xl"
        >
            <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4 tracking-tight">Pick your Squad</h2>
                <p className="text-muted-foreground text-lg">Select exactly 4 unique friends to join your gang.</p>
                <div className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-mono text-sm border border-primary/20">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    {selectedIds.length} / 4 Selected
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {CHARACTERS.map((char) => {
                    const isSelected = selectedIds.includes(char.id)
                    return (
                        <GlassCard
                            key={char.id}
                            onClick={() => toggleCharacter(char.id)}
                            className={cn(
                                "p-6 cursor-pointer relative group transition-all duration-500",
                                isSelected && "ring-2 ring-primary ring-offset-4 ring-offset-background bg-primary/5"
                            )}
                        >
                            <div className="relative w-16 h-16 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                                <div className={cn(
                                    "absolute inset-0 rounded-2xl bg-gradient-to-br opacity-50 blur-sm",
                                    char.gradient
                                )} />
                                <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/20 shadow-lg">
                                    <img
                                        src={char.avatar}
                                        alt={char.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                            <h3 className="font-bold text-xl mb-1">{char.name}</h3>
                            <p className="text-xs font-black uppercase tracking-widest mb-3 opacity-60" style={{ color: char.color }}>
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

            <div className="mt-16 flex justify-center">
                <Button
                    size="xl"
                    disabled={selectedIds.length !== 4}
                    onClick={onNext}
                    className="rounded-full px-16 py-8 text-xl font-bold shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
                >
                    Let&apos;s Go
                </Button>
            </div>
        </motion.div>
    )
}
