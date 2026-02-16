'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Users,
  HeartHandshake,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Bot,
  MessageCircle,
  Reply,
  Layers3,
  UserRound,
  Clock3,
  Zap,
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
  { label: 'Someone Is Always Here', value: '24/7', icon: <Clock3 className="w-4 h-4 text-cyan-500" /> },
  { label: 'Is It Free To Try', value: 'Yes', icon: <Zap className="w-4 h-4 text-amber-500" /> },
  { label: 'Awkward Silence', value: 'Zero', icon: <MessageCircle className="w-4 h-4 text-rose-500" /> },
  { label: 'Feel-Better Moments', value: 'Daily', icon: <HeartHandshake className="w-4 h-4 text-emerald-500" /> },
]

const steps = [
  {
    num: '01',
    title: 'Build your gang',
    copy: 'Pick your lineup and shape the room vibe in less than a minute.',
    icon: <Users className="w-5 h-5" />,
  },
  {
    num: '02',
    title: 'Say anything',
    copy: 'Rant, celebrate, vent, joke. Your gang replies with personality, not boring answers.',
    icon: <MessageCircle className="w-5 h-5" />,
  },
  {
    num: '03',
    title: 'Watch the room come alive',
    copy: 'They react, reply, and riff off each other so it feels like a real chat thread.',
    icon: <Sparkles className="w-5 h-5" />,
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
      { speaker: 'You', text: 'Long day. Need a tiny win right now.', side: 'right', tone: 'user', delay: 1800 },
      { speaker: 'Luna', role: 'The Empath', text: 'First, breathe. I am proud of you for showing up.', side: 'left', tone: 'crew', delay: 2000 },
      { speaker: 'Kael', role: 'Hype Man', text: 'Mini mission: water + one song + one stretch. Go.', side: 'left', tone: 'crew', delay: 1900, reaction: '🔥' },
      { speaker: 'Rico', role: 'Chaos Gremlin', text: 'I vote dance break. 45 seconds. No excuses.', side: 'left', tone: 'crew', delay: 2100, replyTo: 'Mini mission: water + one song...' },
      { speaker: 'You', text: 'Fine, dance break accepted.', side: 'right', tone: 'user', delay: 2200 },
    ],
  },
  {
    title: 'Decision mode',
    subtitle: 'Fast replies + quick plan',
    bubbles: [
      { speaker: 'You', text: 'I keep procrastinating this application.', side: 'right', tone: 'user', delay: 1800 },
      { speaker: 'Nyx', role: 'The Hacker', text: 'Open it now. We split it into 3 tiny chunks.', side: 'left', tone: 'crew', delay: 1900 },
      { speaker: 'Atlas', role: 'The Ops', text: 'Chunk 1 in 7 mins: headline + first bullet only.', side: 'left', tone: 'crew', delay: 2100 },
      { speaker: 'Luna', role: 'The Empath', text: 'Reply here with just the headline. We cheer after.', side: 'left', tone: 'crew', delay: 2000, reaction: '🎉' },
      { speaker: 'You', text: 'Okay. Starting now.', side: 'right', tone: 'user', delay: 2200 },
    ],
  },
  {
    title: 'Pure fun thread',
    subtitle: 'Witty banter + reactions',
    bubbles: [
      { speaker: 'You', text: 'I need a ridiculous weekend idea.', side: 'right', tone: 'user', delay: 1800 },
      { speaker: 'Rico', role: 'Chaos Gremlin', text: 'Theme dinner where everyone speaks in movie quotes.', side: 'left', tone: 'crew', delay: 2000 },
      { speaker: 'Kael', role: 'Hype Man', text: 'Yes. Dress code: dramatic entrance only.', side: 'left', tone: 'crew', delay: 1900, reaction: '✨' },
      { speaker: 'Nyx', role: 'The Hacker', text: 'I will allow this if snacks are elite.', side: 'left', tone: 'crew', delay: 2100, replyTo: 'Theme dinner where everyone...' },
      { speaker: 'You', text: 'This is objectively perfect.', side: 'right', tone: 'user', delay: 2200 },
    ],
  },
]

const whyRealFeatures = [
  {
    title: 'Distinct voices',
    copy: 'Every persona has a clear personality. Replies feel like people, not templates.',
    icon: <UserRound className="w-6 h-6 text-cyan-500" />,
  },
  {
    title: 'Group chemistry',
    copy: 'They riff off each other naturally, building the rhythm of a real conversation.',
    icon: <Layers3 className="w-6 h-6 text-fuchsia-500" />,
  },
  {
    title: 'Socially alive',
    copy: 'Typing indicators, reactions, and reply chains make every chat feel warm and active.',
    icon: <Bot className="w-6 h-6 text-emerald-500" />,
  },
]

const highlights = [
  {
    title: 'Always your people',
    copy: 'Your gang remembers your style and shows up like familiar friends.',
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
  const effectiveTheme = resolvedTheme ?? theme ?? 'dark'
  const isDarkTheme = effectiveTheme === 'dark'
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -120])
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92])

  const prefersReducedMotion = useReducedMotion()
  const { userId, isHydrated } = useChatStore()
  const isAuthenticated = isHydrated && !!userId
  const ctaText = !isHydrated ? 'Syncing...' : isAuthenticated ? 'Continue' : 'Assemble Your Gang'
  const ctaLink = isAuthenticated ? '/post-auth' : '/onboarding'
  const ctaDisabled = !isHydrated
  const safeCtaLink = ctaDisabled ? '#' : ctaLink

  const marqueeItems = useMemo(
    () => [
      'Late-night talks', 'No awkward silence', 'Main-character energy', 'Warm support',
      'Fun chaos', 'Inside jokes', 'Daily check-ins', 'Crew love',
      'Zero judgment', 'Instant hype', 'Real banter', 'Your people 24/7',
      'Emotional backup', 'Good vibes only',
    ],
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

      {/* ── Nav ── */}
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
            onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}
            aria-label="Toggle color mode"
          >
            <Sun className="hidden w-4 h-4 dark:block" />
            <Moon className="w-4 h-4 dark:hidden" />
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

      {/* ── Main ── */}
      <main ref={heroRef} className="flex flex-col items-center text-center z-10 relative">

        {/* ── Hero ── */}
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
                  animate={prefersReducedMotion ? undefined : { rotate: 360 }}
                  transition={prefersReducedMotion ? undefined : { duration: 60, repeat: Infinity, ease: 'linear' }}
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

        {/* ── Stats ── */}
        <section className="w-full px-6 sm:px-10 lg:px-14 pb-20">
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="rounded-2xl border border-border/70 bg-card/70 p-4 sm:p-6 text-left shadow-[0_18px_35px_-28px_rgba(15,23,42,0.8)] hover:border-primary/30 transition-colors duration-300"
              >
                <div className="flex items-center gap-2 mb-2">
                  {stat.icon}
                  <div className="text-2xl sm:text-3xl font-black">{stat.value}</div>
                </div>
                <div className="text-[11px] sm:text-xs text-muted-foreground leading-snug">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Marquee ── */}
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

        {/* ── How It Works ── */}
        <Section id="how-it-works" title="How it works" subtitle="Three steps to your crew">
          {/* Steps - spacious numbered layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-16">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="group relative text-left"
              >
                <div className="mb-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform duration-300">
                    {step.icon}
                  </div>
                  <span className="text-5xl font-black text-primary/15 leading-none select-none">{step.num}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">{step.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-sm">{step.copy}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-7 -right-4 lg:-right-5">
                    <ChevronRight className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Live demo threads */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <MessageCircle className="w-4 h-4 text-cyan-500" />
              <span className="text-sm font-semibold text-muted-foreground tracking-wide">See it in action</span>
            </div>

            {/* Desktop: 3 columns */}
            <div className="hidden md:grid md:grid-cols-3 gap-6">
              {demoThreads.map((thread, i) => (
                <motion.div
                  key={thread.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                >
                  <LiveDemoCard thread={thread} />
                </motion.div>
              ))}
            </div>

            {/* Mobile: single card carousel with arrows */}
            <DemoCarousel threads={demoThreads} />
          </div>
        </Section>

        {/* ── Why It Feels Real ── */}
        <Section id="why-it-feels-real" title="Why it feels real" subtitle="Company, not just answers">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {whyRealFeatures.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.45 }}
                className="group text-left"
              >
                <div className="w-14 h-14 rounded-2xl bg-card/80 border border-border/70 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">{item.title}</h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-sm">{item.copy}</p>
              </motion.div>
            ))}
          </div>

          {/* Highlight strip */}
          <div className="mt-12 rounded-2xl border border-border/70 bg-card/60 p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              {highlights.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-background/60 border border-border/60 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold mb-1">{item.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.copy}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Testimonials ── */}
        <Section id="testimonials" title="Loved by night owls" subtitle="People who wanted a chat that finally feels alive">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
              >
                <Testimonial {...item} />
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── FAQ ── */}
        <Section id="faq" title="Questions, answered" subtitle="Quick clarity, no jargon">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {faq.map((item, i) => (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="rounded-2xl border border-border/70 bg-card/70 p-6 text-left hover:border-primary/30 transition-colors duration-300"
              >
                <div className="text-base font-semibold mb-2">{item.q}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ── Final CTA ── */}
        <section className="w-full px-6 sm:px-10 lg:px-14 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-6xl mx-auto rounded-[2.5rem] border border-border/70 bg-gradient-to-br from-primary/15 via-card/90 to-accent/15 p-8 sm:p-12 flex flex-col lg:flex-row gap-8 items-center justify-between overflow-hidden relative"
          >
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 blur-[80px] rounded-full" />
            <div className="relative text-left">
              <span className="text-xs font-semibold text-primary tracking-wide">Ready to vibe?</span>
              <h3 className="text-3xl sm:text-4xl font-black mt-2 tracking-tight">Meet your crew in under a minute.</h3>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm sm:text-base">
                Start with one message and watch the room come alive around you.
              </p>
            </div>
            <Link href={safeCtaLink} prefetch aria-disabled={ctaDisabled} onClick={(e) => ctaDisabled && e.preventDefault()}>
              <Button size="xl" className="rounded-full px-10 sm:px-14 py-6 text-lg font-black group shrink-0">
                {ctaText}
                <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ── */}
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

/* ── LiveDemoCard: truly fixed-size, no layout shift ── */
function LiveDemoCard({ thread }: { thread: DemoThread }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const run = (index: number) => {
      if (cancelled) return
      if (index >= thread.bubbles.length) {
        timer = setTimeout(() => {
          if (cancelled) return
          setVisibleCount(0)
          run(0)
        }, 3500)
        return
      }
      const delay = index === 0 ? 1200 : (thread.bubbles[index - 1]?.delay ?? 1800)
      timer = setTimeout(() => {
        if (cancelled) return
        setVisibleCount(index + 1)
        run(index + 1)
      }, delay)
    }

    run(0)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [thread])

  // Scroll only the chat container, not the page
  useEffect(() => {
    const el = scrollContainerRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [visibleCount])

  const visibleBubbles = thread.bubbles.slice(0, visibleCount)
  const nextBubble = thread.bubbles[visibleCount]

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-4 sm:p-5 h-full">
      <div className="relative z-10 flex flex-col h-full">
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{thread.subtitle}</div>
          <h3 className="mt-0.5 text-base font-bold tracking-tight">{thread.title}</h3>
        </div>

        {/* Fixed-size chat area - overflow scroll, never changes page height */}
        <div className="rounded-xl border border-border/60 bg-background/60 p-3 h-[19rem] flex flex-col">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
            <div className="space-y-2.5 flex flex-col justify-end min-h-full">
              <div className="flex-1" />
              <AnimatePresence initial={false}>
                {visibleBubbles.map((bubble, idx) => (
                  <motion.div
                    key={`${thread.title}-${bubble.speaker}-${idx}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={cn(bubble.side === 'right' ? 'ml-auto' : 'mr-auto', 'max-w-[88%]')}
                  >
                    <div
                      className={cn(
                        'rounded-2xl px-3.5 py-2.5 border text-[12.5px] leading-relaxed',
                        bubble.tone === 'user'
                          ? 'bg-primary text-primary-foreground border-primary/30 rounded-br-md'
                          : 'bg-card/95 text-foreground border-border/70 rounded-tl-md'
                      )}
                    >
                      {bubble.replyTo && (
                        <div className="mb-1.5 rounded-lg border border-border/50 bg-background/50 px-2 py-1 text-[10px] italic text-muted-foreground truncate">
                          {bubble.replyTo}
                        </div>
                      )}
                      <p>{bubble.text}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-[9px] opacity-60">
                        {bubble.tone === 'crew' && <span className="font-medium">{bubble.speaker}</span>}
                        {bubble.reaction && <span>{bubble.reaction}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Typing indicator anchored at bottom */}
          <div className="h-7 flex items-center mt-2 shrink-0">
            <AnimatePresence mode="wait">
              {nextBubble && (
                <motion.div
                  key={`typing-${visibleCount}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[10px] text-muted-foreground"
                >
                  <Reply className="w-3 h-3" />
                  {nextBubble.speaker} is typing...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Mobile demo carousel with arrow navigation ── */
function DemoCarousel({ threads }: { threads: DemoThread[] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % threads.length)
  }, [threads.length])

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + threads.length) % threads.length)
  }, [threads.length])

  return (
    <div className="md:hidden">
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <LiveDemoCard thread={threads[activeIndex]} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Arrow controls + dots */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <button
          onClick={goPrev}
          className="w-10 h-10 rounded-full border border-border/70 bg-card/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          aria-label="Previous chat"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {threads.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                i === activeIndex ? 'bg-primary w-5' : 'bg-muted-foreground/30'
              )}
              aria-label={`Go to chat ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          className="w-10 h-10 rounded-full border border-border/70 bg-card/80 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          aria-label="Next chat"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

function Section({ id, title, subtitle, children }: { id?: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section id={id} className="w-full px-6 sm:px-10 lg:px-14 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-10 text-left"
        >
          <span className="text-xs font-semibold text-primary tracking-wide">{subtitle}</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-2 tracking-tight">{title}</h2>
        </motion.div>
        {children}
      </div>
    </section>
  )
}


function Testimonial({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/75 p-6 sm:p-7 hover:border-primary/30 transition-colors duration-300 h-full flex flex-col">
      <div className="text-base font-medium leading-relaxed flex-1">&quot;{quote}&quot;</div>
      <div className="mt-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
          {name[0]}
        </div>
        <div>
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-[11px] text-muted-foreground">{role}</div>
        </div>
      </div>
    </div>
  )
}
