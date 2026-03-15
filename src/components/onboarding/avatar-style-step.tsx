'use client'

import { m } from 'framer-motion'
import Image from 'next/image'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MovingBorder } from '@/components/ui/moving-border'
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
    ribbonLabel: string
    ribbonTone: string
    previewTone: string
    giftBorderTone?: string
}

const AVATAR_PACKS: AvatarPackDefinition[] = [
    {
        style: 'robots',
        title: 'Robots',
        description: 'Bold and classic.',
        ribbonLabel: 'Included',
        ribbonTone: 'bg-cyan-300 text-slate-950',
        previewTone: 'from-slate-900 via-slate-800 to-[#0b1220]',
    },
    {
        style: 'human',
        title: 'Human',
        description: 'Lifelike and cinematic.',
        ribbonLabel: 'Free gift',
        ribbonTone: 'bg-amber-300 text-stone-950',
        previewTone: 'from-slate-900 via-slate-800 to-[#0b1220]',
        giftBorderTone:
            'bg-[conic-gradient(from_90deg_at_50%_50%,rgba(251,191,36,0)_0deg,rgba(251,191,36,0.16)_120deg,rgba(253,224,71,1)_180deg,rgba(245,158,11,0.26)_240deg,rgba(251,191,36,0)_360deg)] blur-[1px]',
    },
    {
        style: 'retro',
        title: 'Retro',
        description: 'Nostalgic and playful.',
        ribbonLabel: 'Free gift',
        ribbonTone: 'bg-emerald-300 text-slate-950',
        previewTone: 'from-[#111821] via-[#15131e] to-[#0f1518]',
        giftBorderTone:
            'bg-[conic-gradient(from_90deg_at_50%_50%,rgba(52,211,153,0)_0deg,rgba(52,211,153,0.16)_120deg,rgba(45,212,191,1)_180deg,rgba(20,184,166,0.26)_240deg,rgba(52,211,153,0)_360deg)] blur-[1px]',
    },
]

const PREVIEW_HERO_ID = 'sage'
const PREVIEW_SUPPORT_IDS = ['nyx', 'atlas', 'luna'] as const

function AvatarPackPreview({ style }: { style: AvatarStyle }) {
    const characters = getCharactersForAvatarStyle(style)
    const hero = characters.find((character) => character.id === PREVIEW_HERO_ID) ?? characters[0]
    const others = PREVIEW_SUPPORT_IDS
        .map((id) => characters.find((character) => character.id === id))
        .filter((character): character is NonNullable<typeof character> => Boolean(character))

    if (!hero) return null

    return (
        <div className="grid gap-2 sm:gap-2.5">
            <div className="relative aspect-[1.15/1] overflow-hidden rounded-[1rem] sm:aspect-[1.08/1] sm:rounded-[1.2rem]">
                <Image
                    src={hero.avatar}
                    alt={hero.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 767px) 84vw, 360px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/8" />
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {others.map((character, index) => {
                    const isLast = index === others.length - 1
                    return (
                        <div
                            key={character.id}
                            className="relative aspect-[1/1] overflow-hidden rounded-[0.85rem] border border-white/10 bg-background/80 sm:rounded-[1rem]"
                        >
                            <Image
                                src={character.avatar}
                                alt={character.name}
                                fill
                                className="object-cover"
                                sizes="(max-width: 767px) 26vw, 116px"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-black/6" />
                            <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/82 sm:px-2.5 sm:py-2 sm:text-[10px] sm:tracking-[0.18em]">
                                {character.name}
                            </div>
                            {isLast && (
                                <div className="absolute inset-0 flex items-end justify-end bg-black/30 p-1.5 sm:p-2">
                                    <span className="text-[9px] font-bold text-white/90 sm:text-[10px]">
                                        10+ more
                                    </span>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function AvatarStyleStep({ selectedStyle, onSelectStyle, onNext }: AvatarStyleStepProps) {
    const selectedPack = AVATAR_PACKS.find((pack) => pack.style === selectedStyle) ?? AVATAR_PACKS[0]

    return (
        <m.section
            key="avatar-style"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            data-testid="onboarding-avatar-style-step"
            className="mx-auto flex w-full max-w-[76rem] flex-col justify-center min-h-[100dvh] md:min-h-0 md:justify-start px-1 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-0 md:pt-2 md:pb-[calc(env(safe-area-inset-bottom)+5rem)]"
        >
            <div className="mx-auto max-w-md text-center md:max-w-lg">
                <h2 className="text-[1.5rem] font-black tracking-tight sm:text-[1.8rem] md:text-[2.2rem] md:leading-[0.96]">
                    Pick your gang&apos;s look
                </h2>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Choose one avatar pack for the whole app.
                </p>
            </div>

            <div className="mt-2 md:mt-3">
                <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:overflow-visible md:px-0">
                    <div className="flex snap-x snap-mandatory gap-2.5 md:grid md:grid-cols-3 md:gap-4">
                        {AVATAR_PACKS.map((pack) => {
                            const isSelected = selectedStyle === pack.style
                            const isGiftPack = Boolean(pack.giftBorderTone)

                            const cardContent = (
                                <div
                                    className={cn(
                                        'relative h-full overflow-hidden rounded-[1.35rem] border bg-card/88 p-2.5 shadow-[0_20px_56px_-48px_rgba(15,23,42,0.92)] transition-all duration-200 sm:rounded-[1.6rem] sm:p-3.5 sm:shadow-[0_24px_72px_-56px_rgba(15,23,42,0.92)]',
                                        isGiftPack ? 'border-white/10' : '',
                                        isSelected
                                            ? 'border-[3px] border-primary ring-[3px] ring-primary/35'
                                            : 'border-border/45 hover:border-primary/20'
                                    )}
                                >
                                    {isGiftPack && (
                                        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[1.35rem] sm:rounded-[1.6rem]">
                                            <div className="absolute -right-[3rem] top-[0.85rem] flex h-[1.4rem] w-[12rem] rotate-45 items-center justify-center bg-red-500 text-center text-[10px] font-extrabold uppercase leading-none tracking-wider text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)] sm:-right-[2.8rem] sm:top-[1rem] sm:h-[1.6rem] sm:w-[12.5rem] sm:text-[11px]">
                                                Free Gift
                                            </div>
                                        </div>
                                    )}

                                    <div className={cn('rounded-[1.15rem] bg-gradient-to-br p-1.5 sm:rounded-[1.45rem] sm:p-2', pack.previewTone)}>
                                        <AvatarPackPreview style={pack.style} />
                                    </div>

                                    <div className="mt-3 flex items-start justify-between gap-3 sm:mt-4">
                                        <div className="min-w-0">
                                            <h3 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl md:text-2xl">
                                                {pack.title}
                                            </h3>
                                            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                                                {pack.description}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground sm:h-8 sm:w-8">
                                                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => onSelectStyle(pack.style)}
                                        data-testid={`avatar-style-select-${pack.style}`}
                                        aria-label={`Use ${pack.title}`}
                                        aria-pressed={isSelected}
                                        className="absolute inset-0 z-10 rounded-[1.6rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                                    >
                                        <span className="sr-only">Use {pack.title}</span>
                                    </button>
                                </div>
                            )

                            return (
                                <div
                                    key={pack.style}
                                    data-testid={`avatar-style-card-${pack.style}`}
                                    className="min-w-[92%] snap-center md:min-w-0"
                                >
                                    {isGiftPack ? (
                                        <MovingBorder
                                            className="rounded-[1.4rem] p-[1.5px] sm:rounded-[1.65rem]"
                                            borderClassName={pack.giftBorderTone}
                                            duration={4.25}
                                        >
                                            {cardContent}
                                        </MovingBorder>
                                    ) : (
                                        cardContent
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/30 bg-background/95 backdrop-blur-2xl shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.5)]">
                <div className="mx-auto flex max-w-[76rem] items-center justify-between gap-3 px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:px-6">
                    <p className="text-xs leading-tight text-muted-foreground text-center flex-1 sm:text-sm sm:text-left">
                        You have selected the <span className="font-semibold text-foreground">{selectedPack.title}</span> avatar pack.
                    </p>
                    <Button
                        size="lg"
                        onClick={onNext}
                        data-testid="onboarding-avatar-style-continue"
                        className="h-10 shrink-0 rounded-xl px-5 text-sm font-semibold sm:h-11 sm:px-6"
                    >
                        Continue with {selectedPack.title}
                    </Button>
                </div>
            </div>
        </m.section>
    )
}
