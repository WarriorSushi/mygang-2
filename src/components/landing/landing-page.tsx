'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight,
  Users,
  Brain,
  Wand2,
  ChevronRight,
} from 'lucide-react'
import Image from 'next/image'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chat-store'
import { AuthWall } from '@/components/orchestrator/auth-wall'
import { useRouter } from 'next/navigation'

const stats = [
  { label: 'Active Personalities', value: '8' },
  { label: 'Avg. Response Time', value: '<2s' },
  { label: 'Daily Conversations', value: '24/7' },
  { label: 'Memory Layers', value: '3' },
]

const steps = [
  {
    title: 'Pick your gang',
    copy: 'Choose 4 unique personalities and build a balanced group dynamic.',
  },
  {
    title: 'Drop a message',
    copy: 'Your gang replies instantly with layered reactions and banter.',
  },
  {
    title: 'Watch the evolution',
    copy: 'Memory + relationship state make every session feel continuous.',
  },
]

const highlights = [
  {
    title: 'Memory Vault',
    copy: 'Long-term context without token bloat. Your story actually sticks.',
    icon: <Brain className="w-6 h-6 text-emerald-400" />,
  },
  {
    title: 'Gang Focus Mode',
    copy: 'When you want the gang centered on you, not side chatter.',
    icon: <Users className="w-6 h-6 text-cyan-400" />,
  },
  {
    title: 'Autonomous Banter',
    copy: 'Let them riff. It feels like a real group chat, not a single bot.',
    icon: <Wand2 className="w-6 h-6 text-purple-400" />,
  },
]

const testimonials = [
  {
    quote: 'It feels like checking in with an actual gang. Weirdly motivating.',
    name: 'Ava',
    role: 'Founder',
  },
  {
    quote: 'The banter is wild. The memory makes it feel alive.',
    name: 'Jay',
    role: 'Designer',
  },
  {
    quote: "It's the only AI chat that feels like a social space.",
    name: 'Mira',
    role: 'Creator',
  },
]

const faq = [
  {
    q: 'How does MyGang remember things?',
    a: 'We store lightweight memories and a rolling summary to keep context without heavy token usage.',
  },
  {
    q: 'Can I switch my gang later?',
    a: 'Yes. Swap members any time in Settings without losing your overall history.',
  },
  {
    q: 'Is this a single bot or multiple personas?',
    a: 'Multiple distinct personas with their own voice, timing, and relationship evolution.',
  },
]

export function LandingPage() {
    const [showAuthWall, setShowAuthWall] = useState(false)
    const router = useRouter()
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -120])
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.92])

  const { userId, activeGang, isHydrated } = useChatStore()
  const hasSquad = activeGang.length > 0
  const ctaText = !isHydrated ? 'Syncing...' : userId ? (hasSquad ? 'Return to Gang' : 'Pick Your Gang') : 'Assemble Your Gang'
  const ctaLink = hasSquad ? '/chat' : '/onboarding'
  const ctaDisabled = !isHydrated
  const safeCtaLink = ctaDisabled ? '#' : ctaLink

  const marqueeItems = useMemo(
    () => ['Chaos Energy', 'Deep Memory', 'Live Banter', 'Crew Focus', 'Auto Reactions', 'Late-night Mode', 'Drama', 'Hype'],
    []
  )

  useEffect(() => {
    if (!isHydrated) return
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
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
            <Image src="/logo.png" alt="MyGang" width={28} height={28} className="object-contain" priority />
          </div>
          <span className="tracking-tighter text-xl sm:text-3xl">
            MyGang<span className="text-primary">.ai</span>
          </span>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          {userId && (
            <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              Logged In
            </span>
          )}
          {userId ? (
            <Link href={safeCtaLink} prefetch aria-disabled={ctaDisabled} onClick={(e) => ctaDisabled && e.preventDefault()}>
              <Button variant="ghost" disabled={ctaDisabled} className="rounded-full px-4 sm:px-6 hover:bg-white/5 border border-transparent hover:border-white/10 transition-all">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Button
              variant="ghost"
              className="rounded-full px-4 sm:px-6 hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
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
                <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 rounded-full bg-white/5 border border-white/10 text-xs sm:text-sm mb-8 backdrop-blur-md shadow-inner">
                  <Users className="w-4 h-4 text-cyan-300" />
                  <span className="text-white/90 font-medium">Group chat with your AI friends.</span>
                </div>

                <h1 className="text-5xl sm:text-7xl lg:text-[8.5rem] font-black tracking-tighter mb-8 leading-[0.85] uppercase">
                  YOUR <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-primary to-blue-600 animate-gradient">GANG</span>
                  <br />
                  IS <span className="italic font-serif normal-case font-light text-muted-foreground/50">READY.</span>
                </h1>

                <p className="text-sm sm:text-base lg:text-xl text-muted-foreground/80 mb-10 sm:mb-12 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  Your personal group of AI friends. They&apos;ll chat, laugh, cry, roast, and connect with you.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center lg:justify-start items-center lg:items-start">
                  <Link href={safeCtaLink} prefetch aria-disabled={ctaDisabled} onClick={(e) => ctaDisabled && e.preventDefault()}>
                    <Button
                      size="xl"
                      disabled={ctaDisabled}
                      data-testid="landing-cta"
                      className="rounded-full px-10 sm:px-16 py-6 sm:py-10 text-lg sm:text-2xl font-black group relative overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-primary/20"
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        {ctaText}
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform duration-500" />
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Button>
                  </Link>
                  <a href="#how-it-works" className="inline-flex w-full sm:w-auto">
                    <Button variant="outline" size="xl" className="rounded-full px-10 sm:px-16 py-6 sm:py-10 text-lg sm:text-2xl font-black w-full sm:w-auto">
                      Watch It Flow
                    </Button>
                  </a>
                </div>
              </div>

              <div className="order-1 lg:order-2 flex-shrink-0">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                  className="relative w-48 h-48 sm:w-56 sm:h-56 lg:w-72 lg:h-72"
                >
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-3xl" />
                  <Image
                    src="/logo.png"
                    alt="MyGang logo"
                    width={288}
                    height={288}
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
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6 text-left">
                <div className="text-2xl sm:text-3xl font-black">{stat.value}</div>
                <div className="text-xs sm:text-sm text-muted-foreground uppercase tracking-widest mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full overflow-hidden border-y border-white/5 bg-white/5">
          <div className="flex items-center gap-8 whitespace-nowrap py-6 text-xs sm:text-sm uppercase tracking-[0.3em] text-muted-foreground/70">
            <div className="flex gap-8 animate-marquee">
              {[...marqueeItems, ...marqueeItems].map((item, idx) => (
                <span key={`${item}-${idx}`} className="px-6 py-2 rounded-full border border-white/10 bg-black/20">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <Section id="how-it-works" title="How it works" subtitle="Simple setup, deep immersion">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <GlowCard key={step.title} index={index + 1} title={step.title} copy={step.copy} />
            ))}
          </div>
        </Section>

        <Section id="why-it-feels-real" title="Why it feels real" subtitle="Memory, rhythm, and personality depth working together">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {highlights.map((item) => (
              <FeatureCard key={item.title} icon={item.icon} title={item.title} desc={item.copy} />
            ))}
          </div>
        </Section>

        <Section id="testimonials" title="Loved by night owls" subtitle="People who want a chat that feels alive">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <Testimonial key={item.name} {...item} />
            ))}
          </div>
        </Section>

        <Section id="faq" title="Questions, answered" subtitle="No long docs, just quick clarity">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {faq.map((item) => (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-base font-semibold">{item.q}</div>
                <p className="text-sm text-muted-foreground mt-2">{item.a}</p>
              </div>
            ))}
          </div>
        </Section>

        <section className="w-full px-6 sm:px-10 lg:px-14 pb-24">
          <div className="max-w-6xl mx-auto rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-primary/20 via-black/40 to-accent/20 p-8 sm:p-12 flex flex-col lg:flex-row gap-8 items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Ready to vibe?</div>
              <h3 className="text-3xl sm:text-4xl font-black mt-3">Summon your gang in under 60 seconds.</h3>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Build a gang, set the tone, and let the conversation evolve with you.
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

      <footer className="p-8 sm:p-12 text-center text-muted-foreground/40 text-xs sm:text-sm border-t border-white/5">
        &copy; 2024 MyGang.ai - The premium AI group chat experience.
      </footer>

      <AuthWall
        isOpen={showAuthWall}
        onClose={() => setShowAuthWall(false)}
        onSuccess={() => {
          setShowAuthWall(false)
          router.push('/chat')
        }}
      />
    </div>
  )
}

function Section({ id, title, subtitle, children }: { id?: string; title: string; subtitle: string; children: React.ReactNode }) {
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

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-6 sm:p-8 rounded-[2rem] bg-white/[0.04] border border-white/10 text-left hover:bg-white/[0.08] hover:border-white/20 transition-all duration-500 group backdrop-blur-sm">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-inner">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4 tracking-tight">{title}</h3>
      <p className="text-muted-foreground/80 leading-relaxed text-base">{desc}</p>
    </div>
  )
}

function GlowCard({ index, title, copy }: { index: number; title: string; copy: string }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8">
      <div className="absolute top-0 right-0 h-24 w-24 bg-primary/20 blur-[60px]" />
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Step {index}</div>
      <h3 className="text-2xl font-bold mt-3">{title}</h3>
      <p className="text-sm text-muted-foreground mt-3">{copy}</p>
    </div>
  )
}

function Testimonial({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 sm:p-8">
      <div className="text-base font-medium leading-relaxed">&quot;{quote}&quot;</div>
      <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
        {name} - {role}
      </div>
    </div>
  )
}
