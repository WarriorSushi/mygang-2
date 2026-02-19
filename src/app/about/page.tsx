import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about MyGang.ai, the AI group chat where every friend is unique, every conversation is real, and your gang is always online.',
  alternates: {
    canonical: '/about',
  },
}

function SpinningLogo({ size = 40 }: { size?: number }) {
  return (
    <div className="animate-spin" style={{ animationDuration: '12s' }}>
      <Image
        src="/logo.png"
        alt="MyGang"
        width={size}
        height={size}
        className="object-contain"
      />
    </div>
  )
}

function SectionDivider() {
  return (
    <div className="flex justify-center py-8">
      <SpinningLogo size={36} />
    </div>
  )
}

export default function AboutPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Back nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to MyGang
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 lg:px-16">
        {/* ── Hero ── */}
        <section className="flex flex-col items-center text-center pt-16 pb-12 sm:pt-24 sm:pb-16">
          <div className="mb-8">
            <SpinningLogo size={120} />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              About MyGang
            </span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            The group chat that never sleeps, never judges, and always has your
            back.
          </p>
        </section>


        {/* ── What is MyGang? ── */}
        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              What is MyGang?
            </span>
          </h2>
          <div className="rounded-2xl border border-border/50 bg-muted/30 backdrop-blur-sm p-8 sm:p-12 space-y-5 text-base sm:text-lg leading-relaxed text-muted-foreground">
            <p>
              MyGang.ai is not another boring chatbot. It&apos;s a{' '}
              <span className="text-foreground font-medium">
                full-on group chat
              </span>{' '}
              with AI friends who have their own personalities, opinions, humor,
              and vibes. Think of it like having a gang of friends who are always
              online, always down to talk, and never leave you on read.
            </p>
            <p>
              You build your own gang. Pick your friends, name them, shape their
              personalities. They don&apos;t just respond to you, they
              talk to <em>each other</em>. They riff, they joke, they argue
              (sometimes), and they genuinely make the chat feel alive.
            </p>
            <p>
              It&apos;s companionship on your terms. No social pressure, no
              small talk you have to pretend to care about. Just a gang that
              vibes with you, whenever you need them.
            </p>
          </div>
        </section>

        <SectionDivider />

        {/* ── Why we built this ── */}
        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Why We Built This
            </span>
          </h2>
          <div className="rounded-2xl border border-border/50 bg-muted/30 backdrop-blur-sm p-8 sm:p-12 space-y-5 text-base sm:text-lg leading-relaxed text-muted-foreground">
            <p>
              Honestly? Because sometimes you just want company without all the{' '}
              <em>stuff</em> that comes with it. No need to be &quot;on,&quot; no
              pressure to reply at the right time, no worrying about being too
              much or not enough. Just... vibes.
            </p>
            <p>
              Most AI chat apps feel like talking to a customer service bot
              wearing a personality costume. We wanted something different.
              Something that feels like opening a group chat where your friends
              are already mid-conversation and you just jump in.
            </p>
            <p>
              MyGang started as a passion project, built by someone who
              genuinely loves the idea of AI that feels{' '}
              <span className="text-foreground font-medium">warm</span>, not
              clinical. AI that has character, not just capabilities. A gang that
              feels alive, not scripted.
            </p>
            <p>
              And honestly, it&apos;s been a blast to build. Every weird
              personality quirk, every moment where the AI friends surprise us
              with something unexpectedly funny or heartfelt, that&apos;s
              why we keep going.
            </p>
          </div>
        </section>

        <SectionDivider />

        {/* ── Values ── */}
        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              What We Care About
            </span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              {
                title: 'Always-On Companionship',
                body: "Your gang doesn't sleep, doesn't ghost, doesn't have \"bad signal.\" They're there when you need them, 3 AM existential crisis included.",
              },
              {
                title: 'Distinct Personalities',
                body: "No two friends are the same. They have their own voice, their own takes, their own energy. Because a group chat where everyone agrees is just boring.",
              },
              {
                title: 'Genuine Warmth',
                body: "We obsess over making interactions feel real and warm, not robotic. If a conversation doesn't make you smile at least once, we haven't done our job.",
              },
              {
                title: 'Privacy First',
                body: "Your conversations are yours. We're not mining your chats for ads or selling your data. Your gang is a safe space, full stop.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-border/50 bg-muted/30 backdrop-blur-sm p-6 sm:p-8 space-y-3"
              >
                <h3 className="text-lg font-semibold text-foreground">
                  {card.title}
                </h3>
                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <SectionDivider />

        {/* ── The crew behind the crew ── */}
        <section className="py-8 sm:py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              The Crew Behind the Crew
            </span>
          </h2>
          <div className="rounded-2xl border border-border/50 bg-muted/30 backdrop-blur-sm p-8 sm:p-12 max-w-2xl mx-auto space-y-5">
            <div className="flex justify-center">
              <SpinningLogo size={64} />
            </div>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Built with love (and way too much coffee) by{' '}
              <span className="text-foreground font-semibold">
                WarriorSushi
              </span>
              .
            </p>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              MyGang.ai is a passion project by{' '}
              <span className="text-foreground font-medium">Altcorp</span>.
              What started as a &quot;what if group chats could feel actually
              alive?&quot; experiment turned into something we genuinely love
              working on every single day. One developer, a mountain of ideas,
              and a stubborn refusal to ship anything that doesn&apos;t feel
              right.
            </p>
          </div>
        </section>

        <SectionDivider />

        {/* ── Get in touch ── */}
        <section className="py-8 sm:py-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Get in Touch
            </span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-base sm:text-lg">
            We&apos;d genuinely love to hear from you, feedback, ideas,
            bug reports, or even just to say hey.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            {[
              {
                label: 'Feedback',
                email: 'pashaseenainc@gmail.com',
                description: 'Ideas & suggestions',
              },
              {
                label: 'General',
                email: 'pashaseenainc@gmail.com',
                description: 'Say hello',
              },
              {
                label: 'Support',
                email: 'pashaseenainc@gmail.com',
                description: 'Need help?',
              },
            ].map((item) => (
              <a
                key={item.email}
                href={`mailto:${item.email}`}
                className="rounded-2xl border border-border/50 bg-muted/30 backdrop-blur-sm p-5 sm:p-6 hover:bg-muted/50 transition-colors group block"
              >
                <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  {item.label}
                </div>
                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors break-all">
                  {item.email}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {item.description}
                </div>
              </a>
            ))}
          </div>
        </section>

        <SectionDivider />

        {/* ── Footer / Legal links ── */}
        <footer className="py-10 sm:py-14 text-center space-y-4">
          <div className="flex justify-center">
            <SpinningLogo size={32} />
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            <span className="text-border">|</span>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors underline underline-offset-4"
            >
              Terms of Service
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Altcorp. All rights reserved.
          </p>
        </footer>
      </div>
    </main>
  )
}
