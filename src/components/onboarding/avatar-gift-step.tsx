'use client'

import { m } from 'framer-motion'
import Image from 'next/image'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCharactersForAvatarStyle } from '@/constants/characters'

const GIFT_PACKS = [
    {
        style: 'human' as const,
        title: 'Human',
        description: 'Natural, cinematic portraits.',
    },
    {
        style: 'retro' as const,
        title: 'Retro',
        description: 'Playful, nostalgic avatars.',
    },
]

function PackMiniPreview({ style }: { style: 'human' | 'retro' }) {
    const characters = getCharactersForAvatarStyle(style).slice(0, 3)

    return (
        <div className="flex -space-x-3">
            {characters.map((character) => (
                <div
                    key={character.id}
                    className="relative h-11 w-11 overflow-hidden rounded-full border border-background/85 bg-background"
                >
                    <Image
                        src={character.avatar}
                        alt={character.name}
                        fill
                        className="object-cover"
                        sizes="44px"
                    />
                </div>
            ))}
        </div>
    )
}

export function AvatarGiftStep({ onNext }: { onNext: () => void }) {
    return (
        <m.section
            key="avatar-gift"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            data-testid="onboarding-avatar-gift-step"
            className="mx-auto flex min-h-full w-full max-w-xl items-center justify-center px-1 py-2 sm:py-8"
        >
            <div className="w-full rounded-[1.75rem] border border-border/50 bg-card/88 p-5 text-center shadow-[0_24px_72px_-56px_rgba(15,23,42,0.92)] backdrop-blur-xl sm:p-6">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[1rem] bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                </div>

                <h2 className="mt-3 text-[2rem] font-black tracking-tight sm:text-[3rem] sm:leading-[0.92]">
                    Free for Life
                </h2>
                <p className="mt-1.5 text-base font-semibold text-foreground/90 sm:text-lg">
                    Gift from us to you.
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    As an early user, <span className="font-semibold text-foreground">Human and Retro avatar packs are unlocked forever.</span> Pick the one you want next.
                </p>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                    {GIFT_PACKS.map((pack) => (
                        <div
                            key={pack.style}
                            className="rounded-[1.35rem] border border-border/45 bg-background/68 px-4 py-4 text-left"
                        >
                            <PackMiniPreview style={pack.style} />
                            <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/70">
                                {pack.title}
                            </div>
                            <p className="mt-1 text-sm text-foreground/82">{pack.description}</p>
                        </div>
                    ))}
                </div>

                <Button
                    size="lg"
                    onClick={onNext}
                    data-testid="onboarding-avatar-gift-next"
                    className="mt-5 w-full rounded-full px-8 py-5 text-base font-semibold sm:w-auto"
                >
                    Choose my style
                </Button>
            </div>
        </m.section>
    )
}
