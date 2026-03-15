'use client'

import { m } from 'framer-motion'
import Image from 'next/image'
import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCharactersForAvatarStyle } from '@/constants/characters'

function MarqueeRow({
    style,
    direction = 'left',
    label,
}: {
    style: 'human' | 'retro'
    direction?: 'left' | 'right'
    label: string
}) {
    const characters = getCharactersForAvatarStyle(style)
    const items = [...characters, ...characters]
    const dur = 25

    return (
        <div className="relative w-full overflow-hidden">
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <span className="rounded-full bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground/80 backdrop-blur-md shadow-sm border border-border/30">
                    {label}
                </span>
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-12 bg-gradient-to-r from-card to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-12 bg-gradient-to-l from-card to-transparent" />

            <m.div
                className="flex w-max gap-2.5 py-1"
                animate={{
                    x: direction === 'left'
                        ? ['0%', '-50%']
                        : ['-50%', '0%'],
                }}
                transition={{
                    x: {
                        repeat: Infinity,
                        repeatType: 'loop',
                        duration: dur,
                        ease: 'linear',
                    },
                }}
            >
                {items.map((character, i) => (
                    <div
                        key={`${character.id}-${i}`}
                        className="relative h-16 w-12 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-background shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4)] sm:h-20 sm:w-[3.75rem] sm:rounded-2xl"
                    >
                        <Image
                            src={character.avatar}
                            alt={character.name}
                            fill
                            className="object-cover"
                            sizes="60px"
                            loading="eager"
                            priority={i < 14}
                        />
                    </div>
                ))}
            </m.div>
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
            <div className="w-full overflow-hidden rounded-[1.75rem] border border-border/50 bg-card/88 text-center shadow-[0_24px_72px_-56px_rgba(15,23,42,0.92)] backdrop-blur-xl">
                <div className="px-5 pt-5 sm:px-6 sm:pt-6">
                    <m.div
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 to-emerald-400/20 text-amber-400"
                    >
                        <Gift className="h-5 w-5" />
                    </m.div>

                    <m.h2
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.4 }}
                        className="mt-2.5 text-[1.75rem] font-black tracking-tight sm:text-[2.5rem] sm:leading-[0.92]"
                    >
                        Free for Life
                    </m.h2>
                    <m.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 }}
                        className="mt-1 text-sm font-semibold text-foreground/90 sm:text-base"
                    >
                        Gift from us to you.
                    </m.p>
                    <m.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground"
                    >
                        As an early user, <span className="font-semibold text-foreground">Human and Retro avatar packs are unlocked forever.</span>
                    </m.p>
                </div>

                <m.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                    className="mt-4 flex flex-col gap-2.5 sm:mt-5"
                >
                    <MarqueeRow style="human" direction="left" label="Human" />
                    <MarqueeRow style="retro" direction="right" label="Retro" />
                </m.div>

                <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                    <m.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                    >
                        <Button
                            size="lg"
                            onClick={onNext}
                            data-testid="onboarding-avatar-gift-next"
                            className="w-full rounded-full px-8 py-5 text-base font-semibold sm:w-auto"
                        >
                            Continue
                        </Button>
                    </m.div>
                </div>
            </div>
        </m.section>
    )
}
