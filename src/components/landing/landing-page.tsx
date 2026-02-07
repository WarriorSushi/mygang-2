'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight,
  Users,
  HeartHandshake,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  Bot,
  MessageCircle,
  Reply,
  ThumbsUp,
  Layers3,
  UserRound,
} from 'lucide-react'
import Image from 'next/image'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chat-store'
import { AuthWall } from '@/components/orchestrator/auth-wall'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

const stats = [
  { label: 'Someone Is Always Here', value: '24/7' },
  { label: 'Distinct Personalities', value: '8' },
  { label: 'Awkward Silence', value: 'Zero' },
  { label: 'Mood Boost Moments', value: 'Daily' },
]

const steps = [
  {
    title: 'Build your crew',
    copy: 'Pick your lineup and shape the room vibe in less than a minute.',
  },
  {
    title: 'Say anything',
    copy: 'Rant, celebrate, vent, joke. Your gang replies with personality, not generic answers.',
  },
  {
    title: 'Watch the room come alive',
    copy: 'They react, reply, and riff off each other so it feels like a real chat thread.',
  },
]

const howItWorksPillars = [
  {
    title: 'Warm welcome',
    copy: 'Your gang opens with energy and quickly pulls you into the flow.',
    icon: <HeartHandshake className="w-4 h-4 text-rose-500" />,
  },
  {
    title: 'Live banter',
    copy: 'Messages bounce naturally between personas, not one robotic block.',
    icon: <MessageCircle className="w-4 h-4 text-cyan-500" />,
  },
  {
    title: 'Social signals',
    copy: 'Reads, reactions, replies, and momentum make the room feel active.',
    icon: <ThumbsUp className="w-4 h-4 text-emerald-500" />,
  },
]

type DemoBubble = {
  speaker: string
  role?: string
  text: string
  side: 'left' | 'right'
  tone: 'user' | 'crew'
  delay?: number
  replyTo?: string
  reaction?: string
}

type DemoThread = {
  title: string
  subtitle: string
  bubbles: DemoBubble[]
}

const demoThreads: DemoThread[] = [
  {
    title: 'Late-night check-in',
    subtitle: 'Warm + playful energy',
    bubbles: [
      { speaker: 'You', text: 'Long day. Need a tiny win right now.', side: 'right', tone: 'user', delay: 900 },
      { speaker: 'Luna', role: 'The Empath', text: 'First, breathe. I am proud of you for showing up.', side: 'left', tone: 'crew', delay: 900 },
      { speaker: 'Kael', role: 'Hype Man', text: 'Mini mission: water + one song + one stretch. Go.', side: 'left', tone: 'crew', delay: 900, reaction: '🔥' },
      { speaker: 'Rico', role: 'Chaos Gremlin', text: 'I vote dance break. 45 seconds. No excuses.', side: 'left', tone: 'crew', delay: 950, replyTo: 'Mini mission: water + one song + one stretch. Go.' },
      { speaker: 'You', text: 'Fine, dance break accepted.', side: 'right', tone: 'user', delay: 1000 },
    ],
  },
  {
    title: 'Decision mode',
    subtitle: 'Fast replies + quick plan',
    bubbles: [
      { speaker: 'You', text: 'I keep procrastinating this application.', side: 'right', tone: 'user', delay: 900 },
      { speaker: 'Nyx', role: 'The Hacker', text: 'Open it now. We split it into 3 tiny chunks.', side: 'left', tone: 'crew', delay: 850 },
      { speaker: 'Atlas', role: 'The Ops', text: 'Chunk 1 in 7 mins: headline + first bullet only.', side: 'left', tone: 'crew', delay: 950 },
      { speaker: 'Luna', role: 'The Empath', text: 'Reply here with just the headline. We cheer after.', side: 'left', tone: 'crew', delay: 900, reaction: '💛' },
      { speaker: 'You', text: 'Okay. Starting now.', side: 'right', tone: 'user', delay: 1000 },
    ],
  },
  {
    title: 'Pure fun thread',
    subtitle: 'Witty banter + reactions',
    bubbles: [
      { speaker: 'You', text: 'I need a ridiculous weekend idea.', side: 'right', tone: 'user', delay: 900 },
      { speaker: 'Rico', role: 'Chaos Gremlin', text: 'Theme dinner where everyone speaks in movie quotes.', side: 'left', tone: 'crew', delay: 900 },
      { speaker: 'Kael', role: 'Hype Man', text: 'Yes. Dress code: dramatic entrance only.', side: 'left', tone: 'crew', delay: 850, reaction: '✨' },
      { speaker: 'Nyx', role: 'The Hacker', text: 'I will allow this if snacks are elite.', side: 'left', tone: 'crew', delay: 900, replyTo: 'Theme dinner where everyone speaks in movie quotes.' },
      { speaker: 'You', text: 'This is objectively perfect.', side: 'right', tone: 'user', delay: 950 },
    ],
  },
]

const realSignals = [
  {
    title: 'Distinct voices',
    copy: 'Every persona has a clear point of view, so replies sound like people, not templates.',
    meterLabel: 'Personality clarity',
    meter: 94,
    icon: <UserRound className="w-5 h-5 text-cyan-500" />,
    chips: ['Different tones', 'Recognizable style', 'No copy-paste vibe'],
  },
  {
    title: 'Group chemistry',
    copy: 'They respond to each other naturally, creating the rhythm of a real room.',
    meterLabel: 'Conversation flow',
    meter: 91,
    icon: <Layers3 className="w-5 h-5 text-fuchsia-500" />,
    chips: ['Reply chains', 'Reactions', 'Shared callbacks'],
  },
  {
    title: 'Feels socially alive',
    copy: 'Micro-signals like reads, typing, and layered replies make chats feel active and warm.',
    meterLabel: 'Social presence',
    meter: 96,
    icon: <Bot className="w-5 h-5 text-emerald-500" />,
    chips: ['Live energy', 'Fast momentum', 'Warm tone'],
  },
]

const highlights = [
  {
    title: 'Always your people',
    copy: 'Your crew remembers your style and shows up like familiar friends.',
    icon: <HeartHandshake className="w-6 h-6 text-emerald-500" />,
  },
  {
    title: 'Your pace, your mood',
    copy: 'Go deep when you need support, or keep it playful when you want energy.',
    icon: <Users className="w-6 h-6 text-cyan-500" />,
  },
  {
    title: 'Alive group vibes',
    copy: 'They bounce off each other naturally, so every chat feels lively and real.',
    icon: <Sparkles className="w-6 h-6 text-fuchsia-500" />,
  },
]

const testimonials = [
  {
    quote: 'It feels like my own late-night friend group, minus the drama.',
    name: 'Ava',
    role: 'Night owl',
  },
  {
    quote: 'When I do not want to talk to anyone, this still makes me feel seen.',
    name: 'Jay',
    role: 'Quiet introvert',
  },
  {
    quote: 'I open it for five minutes and end up smiling every time.',
    name: 'Mira',
    role: 'Student',
  },
]

const faq = [
  {
    q: 'Can this really feel like a friend group?',
    a: 'Yes. Each persona has a distinct voice and the group chemistry grows with you.',
  },
  {
    q: 'Can I change my crew later?',
    a: 'Absolutely. You can swap personalities anytime until your lineup feels perfect.',
  },
  {
    q: 'Is it just for lonely moments?',
    a: 'Use it for anything: late-night talks, motivation, confidence, or pure chaos and fun.',
  },
]

export function LandingPage() {
  const [showAuthWall, setShowAuthWall] = useState(false)
  const router = useRouter()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const effectiveTheme = resolvedTheme ?? theme
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -120])
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92])

  const { userId, isHydrated } = useChatStore()
  const isAuthenticated = isHydrated && !!userId
  const ctaText = !isHydrated ? 'Syncing...' : isAuthenticated ? 'Continue' : 'Assemble Your Gang'
  const ctaLink = isAuthenticated ? '/post-auth' : '/onboarding'
  const ctaDisabled = !isHydrated
  const safeCtaLink = ctaDisabled ? '#' : ctaLink

  const marqueeItems = useMemo(
    () => ['Late-night talks', 'No awkward silence', 'Main-character energy', 'Warm support', 'Fun chaos', 'Inside jokes', 'Daily check-ins', 'Crew love'],
    []
  )

  useEffect(() => {
    if (!isHydrated) return
    router.prefetch('/post-auth')
    router.prefetch('/onboarding')
    router.prefetch('/chat')
  }, [isHydrated, router])

  return (
    <div className="relative min-h-dvh flex flex-col overflow-hidden bg-background text-foreground">
      <BackgroundBlobs />

      <nav className="px-4 sm:px-6 pb-4 sm:pb-6 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-[calc(env(safe-area-inset-top)+1.5rem)] flex flex-wrap justify-between items-center gap-3 max-w-7xl mx-auto w-full z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-bold flex items-center gap-2"
        >
          <Image src="/logo.png" alt="MyGang" width={40} height={40} className="object-contain" priority />
          <span className="tracking-tighter text-xl sm:text-3xl">
            MyGang<span className="text-primary">.ai</span>
          </span>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full border border-border/80 bg-card/70 hover:bg-card"
            onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {effectiveTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          {isAuthenticated && (
            <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              Logged In
            </span>
          )}
          {isAuthenticated ? (
            <Link href={safeCtaLink} prefetch aria-disabled={ctaDisabled} onClick={(e) => ctaDisabled && e.preventDefault()}>
              <Button variant="ghost" disabled={ctaDisabled} className="rounded-full px-4 sm:px-6 border border-border/80 bg-card/70 hover:bg-card transition-all">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Button
              variant="ghost"
              className="rounded-full px-4 sm:px-6 border border-border/80 bg-card/70 hover:bg-card transition-all"
              onClick={() => setShowAuthWall(true)}
            >
              Log in
            </Button>
          )}
        </motion.div>
      </nav>

      <main ref={heroRef} className="flex flex-col items-center text-center z-10 relative">
        <section className="relative w-full px-6 sm:px-10 lg:px-14 pt-16 sm:pt-24 pb-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[600px] sm:h-[800px] bg-primary/5 blur-[140px] rounded-full -z-10 animate-pulse" />
          <motion.div style={{ y: heroY, scale: heroScale }} className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-10 lg:gap-16">
              <div className="order-2 lg:order-1 text-center lg:text-left flex-1">
                <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-full border border-border/70 bg-card/70 text-xs sm:text-sm mb-8 backdrop-blur-md shadow-[0_10px_30px_-20px_rgba(15,23,42,0.7)]">
                  <Users className="w-4 h-4 text-cyan-500" />
                  <span className="text-foreground/90 font-medium">Your personal crew, always online.</span>
                </div>

                <h1 className="text-5xl sm:text-7xl lg:text-[7.9rem] font-black tracking-tighter mb-8 leading-[0.85] uppercase">
                  <span className="inline-flex items-baseline gap-[0.22em] whitespace-nowrap">
                    <span>YOUR</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 via-primary to-blue-600 animate-gradient">GANG</span>
                  </span>
                  <br />
                  IS <span className="italic font-serif normal-case font-light text-muted-foreground/70">READY.</span>
                </h1>

                <p className="text-sm sm:text-base lg:text-xl text-muted-foreground/80 mb-10 sm:mb-12 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Real-feeling conversations with a crew that hypes you up, checks on you, and keeps life less lonely.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center lg:justify-start items-center lg:items-start">
                  <Link href={safeCtaLink} prefetch aria-disabled={ctaDisabled} onClick={(e) => ctaDisabled && e.preventDefault()}>
                    <Button
                      size="xl"
                      disabled={ctaDisabled}
                      data-testid="landing-cta"
                      className="rounded-full w-[min(92vw,22rem)] sm:w-auto px-10 sm:px-16 py-6 sm:py-10 text-lg sm:text-2xl font-black group relative overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-primary/20"
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        {ctaText}
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform duration-500" />
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </Link>
                  <div className="inline-flex w-[min(72vw,16rem)] sm:w-auto">
                    <Button
                      variant="outline"
                      size="xl"
                      type="button"
                      onClick={() => {
                        const target = document.getElementById('how-it-works')
                        if (!target) return
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }}
                      className="rounded-full px-8 sm:px-16 py-5 sm:py-10 text-base sm:text-2xl font-black w-full sm:w-auto border-border/80 bg-card/65 hover:bg-card"
                    >
                      How It Works
                    </Button>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 flex-shrink-0">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                  className="relative w-64 h-64 sm:w-72 sm:h-72 lg:w-[29rem] lg:h-[29rem]"
                >
                  <div className="absolute inset-0 rounded-full bg-primary/15 blur-3xl" />
                  <Image
                    src="/logo.png"
                    alt="MyGang logo"
                    width={464}
                    height={464}
                    className="relative w-full h-full object-contain drop-shadow-2xl"
                    priority
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="w-full px-6 sm:px-10 lg:px-14 pb-20">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-6 text-left shadow-[0_18px_35px_-28px_rgba(15,23,42,0.8)]">
                <div className="text-2xl sm:text-3xl font-black">{stat.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground uppercase tracking-[0.18em] mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full overflow-hidden border-y border-border/60 bg-card/65">
          <div className="hidden sm:flex items-center gap-8 whitespace-nowrap py-6 text-xs sm:text-sm uppercase tracking-[0.3em] text-muted-foreground/80">
            <div className="flex w-max gap-8 animate-marquee">
              {[...marqueeItems, ...marqueeItems].map((item, idx) => (
                <span key={`${item}-${idx}`} className="px-6 py-2 rounded-full border border-border/80 bg-background/70">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="sm:hidden py-3 space-y-2">
            <div className="overflow-hidden">
              <div className="flex w-max gap-3 animate-marquee text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                {[...marqueeItems, ...marqueeItems].map((item, idx) => (
                  <span key={`${item}-mobile-a-${idx}`} className="px-3 py-1 rounded-full border border-border/75 bg-background/70">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-hidden">
              <div
                className="flex w-max gap-3 animate-marquee text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80"
                style={{ animationDirection: 'reverse', animationDuration: '22s' }}
              >
                {[...marqueeItems, ...marqueeItems].map((item, idx) => (
                  <span key={`${item}-mobile-b-${idx}`} className="px-3 py-1 rounded-full border border-border/75 bg-background/70">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Section id="how-it-works" title="How it works" subtitle="Simple setup, rich social flow">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.35fr] gap-8 lg:gap-10">
            <div className="space-y-4">
              {steps.map((step, index) => (
                <GlowCard key={step.title} index={index + 1} title={step.title} copy={step.copy} />
              ))}
              <div className="rounded-[1.5rem] border border-border/70 bg-card/75 p-4 sm:p-5 shadow-[0_20px_35px_-30px_rgba(15,23,42,0.9)]">
                <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground mb-3">What happens inside each chat</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {howItWorksPillars.map((pillar) => (
                    <div key={pillar.title} className="rounded-xl border border-border/70 bg-background/70 px-3 py-3">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {pillar.icon}
                        <span>{pillar.title}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{pillar.copy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {demoThreads.map((thread) => (
                <LiveDemoCard key={thread.title} thread={thread} />
              ))}
            </div>

            <div className="md:hidden -mx-1 overflow-x-auto pb-2">
              <div className="flex gap-4 snap-x snap-mandatory px-1">
                {demoThreads.map((thread) => (
                  <div key={`mobile-${thread.title}`} className="snap-start w-[84vw] shrink-0">
                    <LiveDemoCard thread={thread} />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80 text-center">
                Swipe to see more live chat moments
              </p>
            </div>
          </div>
        </Section>

        <Section id="why-it-feels-real" title="Why it feels real" subtitle="Built for people who want company, not just answers">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {realSignals.map((item) => (
              <RealityCard
                key={item.title}
                icon={item.icon}
                title={item.title}
                desc={item.copy}
                meterLabel={item.meterLabel}
                meter={item.meter}
                chips={item.chips}
              />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {highlights.map((item) => (
              <FeatureCard key={item.title} icon={item.icon} title={item.title} desc={item.copy} />
            ))}
          </div>
        </Section>

        <Section id="testimonials" title="Loved by night owls" subtitle="People who wanted a chat that finally feels alive">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <Testimonial key={item.name} {...item} />
            ))}
          </div>
        </Section>

        <Section id="faq" title="Questions, answered" subtitle="Quick clarity, no jargon">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {faq.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border/70 bg-card/70 p-6 shadow-[0_16px_32px_-24px_rgba(15,23,42,0.8)]">
                <div className="text-base font-semibold">{item.q}</div>
                <p className="text-sm text-muted-foreground mt-2">{item.a}</p>
              </div>
            ))}
          </div>
        </Section>

        <section className="w-full px-6 sm:px-10 lg:px-14 pb-24">
          <div className="max-w-6xl mx-auto rounded-[2.5rem] border border-border/70 bg-gradient-to-br from-primary/20 via-card/90 to-accent/20 p-8 sm:p-12 flex flex-col lg:flex-row gap-8 items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Ready to vibe?</div>
              <h3 className="text-3xl sm:text-4xl font-black mt-3">Meet your crew in under a minute.</h3>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Start with one message and watch the room come alive around you.
              </p>
            </div>
            <Link href={safeCtaLink} prefetch aria-disabled={ctaDisabled} onClick={(e) => ctaDisabled && e.preventDefault()}>
              <Button size="xl" className="rounded-full px-10 sm:px-14 py-6 text-lg font-black group">
                {ctaText}
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="p-8 sm:p-12 text-center text-muted-foreground/40 text-xs sm:text-sm border-t border-border/60">
        &copy; 2026 MyGang.ai - Your always-on social circle.
      </footer>

      <AuthWall
        isOpen={showAuthWall}
        onClose={() => setShowAuthWall(false)}
        onSuccess={() => {
          setShowAuthWall(false)
          router.push('/post-auth')
        }}
      />
    </div>
  )
}

function LiveDemoCard({ thread }: { thread: DemoThread }) {
  const [visibleCount, setVisibleCount] = useState(1)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const run = (index: number) => {
      if (cancelled) return
      if (index >= thread.bubbles.length) {
        timer = setTimeout(() => {
          if (cancelled) return
          setVisibleCount(1)
          run(1)
        }, 2200)
        return
      }
      const delay = thread.bubbles[index - 1]?.delay ?? 900
      timer = setTimeout(() => {
        if (cancelled) return
        setVisibleCount(index + 1)
        run(index + 1)
      }, delay)
    }

    run(1)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [thread])

  const visibleBubbles = thread.bubbles.slice(0, visibleCount)
  const nextBubble = thread.bubbles[visibleCount]

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/80 p-4 shadow-[0_20px_36px_-30px_rgba(15,23,42,0.9)]">
      <div className="absolute -top-5 right-4 h-20 w-20 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative z-10">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/85">{thread.subtitle}</div>
        <h3 className="mt-1 text-sm font-black tracking-tight">{thread.title}</h3>

        <div className="mt-3 rounded-xl border border-border/70 bg-background/72 p-2.5 min-h-[16.5rem]">
          <div className="space-y-2.5">
            {visibleBubbles.map((bubble, idx) => (
              <motion.div
                key={`${thread.title}-${bubble.speaker}-${idx}`}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn(bubble.side === 'right' ? 'ml-auto' : 'mr-auto', 'max-w-[88%]')}
              >
                <div
                  className={cn(
                    'rounded-2xl px-2.5 py-2 border text-[12px] leading-relaxed',
                    bubble.tone === 'user'
                      ? 'bg-primary text-primary-foreground border-primary/30 rounded-br-md'
                      : 'bg-card/95 text-foreground border-border/80 rounded-tl-md'
                  )}
                >
                  {bubble.replyTo && (
                    <div className="mb-1.5 rounded-lg border border-border/70 bg-background/60 px-1.5 py-1 text-[10px] italic text-muted-foreground truncate">
                      Replying to: {bubble.replyTo}
                    </div>
                  )}
                  <p>{bubble.text}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] opacity-70">
                    {bubble.role && <span>{bubble.role}</span>}
                    {bubble.reaction && <span>{bubble.reaction}</span>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          {nextBubble && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <Reply className="w-3 h-3" />
              {nextBubble.speaker} is typing...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ id, title, subtitle, children }: { id?: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section id={id} className="w-full px-6 sm:px-10 lg:px-14 py-20 sm:py-28">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{subtitle}</div>
          <h2 className="text-3xl sm:text-4xl font-black mt-2">{title}</h2>
        </div>
        {children}
      </div>
    </section>
  )
}

function RealityCard({
  icon,
  title,
  desc,
  meterLabel,
  meter,
  chips,
}: {
  icon: ReactNode
  title: string
  desc: string
  meterLabel: string
  meter: number
  chips: string[]
}) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="rounded-[2rem] border border-border/70 bg-card/75 p-6 sm:p-7 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.8)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl border border-border/70 bg-background/70 flex items-center justify-center">
            {icon}
          </div>
          <h3 className="text-xl font-black tracking-tight">{title}</h3>
        </div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{meter}%</div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground/85 leading-relaxed">{desc}</p>
      <div className="mt-4">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{meterLabel}</div>
        <div className="mt-1.5 h-2 rounded-full bg-background/80 border border-border/70 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${meter}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-500 to-emerald-500"
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span key={chip} className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.13em] text-foreground/80">
            {chip}
          </span>
        ))}
      </div>
    </motion.div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="p-6 sm:p-8 rounded-[2rem] bg-card/75 border border-border/70 text-left hover:bg-card transition-all duration-500 group backdrop-blur-sm shadow-[0_18px_35px_-28px_rgba(15,23,42,0.8)]"
    >
      <div className="w-12 h-12 rounded-2xl bg-background/70 flex items-center justify-center mb-6 border border-border/70 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-inner">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4 tracking-tight">{title}</h3>
      <p className="text-muted-foreground/85 leading-relaxed text-base">{desc}</p>
    </motion.div>
  )
}

function GlowCard({ index, title, copy }: { index: number; title: string; copy: string }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 p-6 sm:p-8 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.8)]"
    >
      <div className="absolute top-0 right-0 h-24 w-24 bg-primary/20 blur-[60px]" />
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Step {index}</div>
      <h3 className="text-2xl font-bold mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground mt-3">{copy}</p>
    </motion.div>
  )
}

function Testimonial({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="rounded-[2rem] border border-border/70 bg-card/75 p-6 sm:p-8 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.8)]"
    >
      <div className="text-base font-medium leading-relaxed">&quot;{quote}&quot;</div>
      <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
        {name} - {role}
      </div>
    </motion.div>
  )
}
