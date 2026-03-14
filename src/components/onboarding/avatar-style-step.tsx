'use client'

import type { CSSProperties, KeyboardEvent } from 'react'
import { m } from 'framer-motion'
import Image from 'next/image'
import { Bot, Gift, Sparkles, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCharactersForAvatarStyle } from '@/constants/characters'
import { cn } from '@/lib/utils'
import type { AvatarStyle } from '@/lib/avatar-style'

interface AvatarStyleStepProps {
    selectedStyle: AvatarStyle
    onSelectStyle: (style: AvatarStyle) => void
    onNext: () => void
}

type AvatarPackDefinition = {
    style: AvatarStyle
    title: string
    description: string
    accent: string
    surface: string
    previewTone: string
    eyebrow: string
    giftUnlocked: boolean
    icon: typeof Bot
}

const AVATAR_PACKS: AvatarPackDefinition[] = [
    {
        style: 'robots',
        title: 'Robots',
        description: 'The original MyGang look. Crisp, bold, and ready by default.',
        accent: 'from-cyan-200 via-sky-200 to-indigo-300',
        surface: 'from-slate-50/95 via-cyan-50/90 to-sky-100/90 dark:from-slate-950/90 dark:via-slate-900/92 dark:to-cyan-950/75',
        previewTone: 'border-cyan-300/35 bg-slate-950/85',
        eyebrow: 'Ready by default',
        giftUnlocked: false,
        icon: Bot,
    },
    {
        style: 'human',
        title: 'Human',
        description: 'A warmer, more intimate portrait pack with a premium cinematic feel.',
        accent: 'from-amber-200 via-rose-200 to-orange-200',
        surface: 'from-amber-50/95 via-rose-50/90 to-orange-100/90 dark:from-stone-950/90 dark:via-stone-900/92 dark:to-rose-950/70',
        previewTone: 'border-rose-300/35 bg-[#2b1712]/90',
        eyebrow: 'Early gift',
        giftUnlocked: true,
        icon: Gift,
    },
    {
        style: 'retro',
        title: 'Retro',
        description: 'Arcade-inspired avatars with nostalgic color, charm, and collectible energy.',
        accent: 'from-emerald-200 via-lime-200 to-yellow-200',
        surface: 'from-lime-50/95 via-emerald-50/90 to-yellow-100/90 dark:from-[#10121f]/92 dark:via-[#17172b]/92 dark:to-[#1c2b13]/85',
        previewTone: 'border-emerald-300/35 bg-[#121221]/92',
        eyebrow: 'Early gift',
        giftUnlocked: true,
        icon: Sparkles,
    },
]

function AvatarMarquee({ style, reverse = false, duration = '26s' }: { style: AvatarStyle; reverse?: boolean; duration?: string }) {
    const characters = getCharactersForAvatarStyle(style)
    const marqueeItems = [...characters, ...characters]

    return (
        <div className="overflow-hidden">
            <div
                className="avatar-pack-marquee-track flex w-max gap-3"
                data-direction={reverse ? 'reverse' : 'forward'}
                style={{ '--avatar-marquee-duration': duration } as CSSProperties}
            >
                {marqueeItems.map((character, index) => (
                    <div
                        key={`${style}-${character.id}-${index}`}
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-black/10"
                    >
                        <Image
                            src={character.avatar}
                            alt={character.name}
                            fill
                            className="object-cover"
                            sizes="56px"
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function AvatarStyleStep({ selectedStyle, onSelectStyle, onNext }: AvatarStyleStepProps) {
    const selectedPack = AVATAR_PACKS.find((pack) => pack.style === selectedStyle) ?? AVATAR_PACKS[0]
    const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, style: AvatarStyle) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelectStyle(style)
        }
    }

    return (
        <m.section
            key="avatar-style"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            data-testid="onboarding-avatar-style-step"
            className="mx-auto flex w-full max-w-6xl flex-col px-1 pb-6 pt-10 sm:pb-8 sm:pt-12"
        >
            <div className="mx-auto max-w-2xl text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-primary">
                    <Gift className="h-3.5 w-3.5" />
                    Unlocked forever
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">Pick your gang&apos;s look</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Robots is ready by default. Your Human and Retro packs are unlocked forever.
                </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {AVATAR_PACKS.map((pack, index) => {
                    const isSelected = selectedStyle === pack.style
                    const Icon = pack.icon

                    return (
                        <div
                            key={pack.style}
                            onClick={() => onSelectStyle(pack.style)}
                            data-testid={`avatar-style-card-${pack.style}`}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            aria-label={`${pack.title}${isSelected ? ', selected' : ''}`}
                            onKeyDown={(event) => handleCardKeyDown(event, pack.style)}
                            className={cn(
                                'group relative overflow-hidden rounded-[2rem] border p-5 text-left transition-all duration-300 sm:p-6',
                                'bg-gradient-to-br backdrop-blur-2xl shadow-[0_26px_70px_-38px_rgba(15,23,42,0.55)]',
                                pack.surface,
                                isSelected
                                    ? 'border-primary/55 ring-2 ring-primary/30 translate-y-[-2px]'
                                    : 'border-border/45 hover:border-primary/25 hover:translate-y-[-2px]'
                            )}
                        >
                            <div className={cn('absolute inset-x-0 top-0 h-28 bg-gradient-to-r opacity-55 blur-3xl', pack.accent)} />
                            <div className="relative flex h-full flex-col">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-muted-foreground/70">
                                            {pack.eyebrow}
                                        </div>
                                        <div className="mt-3 flex items-center gap-3">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/70 shadow-inner shadow-white/10">
                                                <Icon className="h-5 w-5 text-foreground/80" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black tracking-tight">{pack.title}</h3>
                                                {pack.giftUnlocked ? (
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
                                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-300/12 px-2.5 py-1">
                                                            <Gift className="h-3.5 w-3.5" />
                                                            Gift box
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1">
                                                            <Unlock className="h-3.5 w-3.5" />
                                                            Unlocked forever
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-200">
                                                        <Bot className="h-3.5 w-3.5" />
                                                        Default pack
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={cn(
                                        'rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em]',
                                        isSelected
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-background/70 text-muted-foreground'
                                    )}>
                                        {isSelected ? 'Selected' : 'Preview'}
                                    </div>
                                </div>

                                <p className="relative mt-5 text-sm leading-relaxed text-foreground/78">
                                    {pack.description}
                                </p>

                                <div className={cn(
                                    'relative mt-6 overflow-hidden rounded-[1.75rem] border p-4 shadow-inner shadow-white/5',
                                    pack.previewTone
                                )}>
                                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.16),_transparent_42%)]" />
                                    <AvatarMarquee style={pack.style} duration={`${24 + index * 2}s`} />
                                    <div className="mt-3">
                                        <AvatarMarquee style={pack.style} reverse duration={`${30 + index * 2}s`} />
                                    </div>
                                </div>

                                <div className="mt-6 pt-2">
                                    <Button
                                        type="button"
                                        size="lg"
                                        variant={isSelected ? 'default' : 'outline'}
                                        data-testid={`avatar-style-select-${pack.style}`}
                                        className={cn(
                                            'w-full rounded-2xl text-sm font-bold',
                                            !isSelected && 'bg-background/72'
                                        )}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onSelectStyle(pack.style)
                                        }}
                                    >
                                        {isSelected ? 'Selected' : `Select ${pack.title}`}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="sticky bottom-0 z-20 mt-6 border-t border-border/35 bg-background/86 px-1 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-4 backdrop-blur-2xl">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-center text-sm text-muted-foreground sm:text-left">
                        Your next screen will use <span className="font-semibold text-foreground">{selectedPack.title}</span>.
                    </p>
                    <Button
                        size="lg"
                        onClick={onNext}
                        data-testid="onboarding-avatar-style-continue"
                        className="w-full rounded-2xl px-8 py-5 text-sm font-bold shadow-[0_20px_55px_-32px_rgba(37,99,235,0.7)] sm:w-auto"
                    >
                        Continue with {selectedPack.title}
                    </Button>
                </div>
            </div>
        </m.section>
    )
}
