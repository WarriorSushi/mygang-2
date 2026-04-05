import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, X, ChevronRight } from 'lucide-react'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Best Replika Alternative in 2026 — MyGang.ai Group AI Chat',
  description:
    'Looking for a Replika alternative? MyGang.ai gives you a whole AI friend group instead of one companion. Multiple personalities, group dynamics, and real conversations — free to try.',
  keywords: [
    'replika alternative',
    'replika alternative 2026',
    'ai companion alternative',
    'ai friend app',
    'ai friend group',
    'ai group chat',
    'best replika alternative',
    'apps like replika',
    'replika replacement',
    'MyGang.ai',
  ],
  alternates: {
    canonical: '/replika-alternative',
  },
  openGraph: {
    title: 'Best Replika Alternative in 2026 — MyGang.ai',
    description:
      'Why talk to one AI when you can have a whole friend group? MyGang is the Replika alternative built for people who want more social depth.',
    url: 'https://mygang.ai/replika-alternative',
  },
}

const comparisonRows = [
  { feature: 'Number of AI companions', replika: '1', mygang: '2–6' },
  { feature: 'Group chat dynamics', replika: false, mygang: true },
  { feature: 'Characters talk to each other', replika: false, mygang: true },
  { feature: 'Unique personalities per member', replika: 'Limited', mygang: '10+ distinct archetypes' },
  { feature: 'Long-term memory', replika: 'Yes (paid)', mygang: 'Yes (preview free, full on paid)' },
  { feature: 'Free tier available', replika: 'Limited', mygang: 'Yes — 2 members, 30 msgs/hr' },
  { feature: 'Romantic relationship mode', replika: 'Yes (paid)', mygang: false },
  { feature: 'Group banter & reactions', replika: false, mygang: true },
  { feature: 'Custom character nicknames', replika: false, mygang: 'Yes (Basic & Pro)' },
]

const reasons = [
  {
    title: 'One companion isn't enough',
    body: 'Replika is built around a single AI partner — one relationship, one voice. MyGang gives you 2 to 6 characters in the same conversation, all with different personalities, opinions, and vibes. It feels like a real group chat, not a chatbot.',
  },
  {
    title: 'Your gang talks to each other',
    body: 'On Replika, everything goes through you. On MyGang, your gang members react to each other — they banter, agree, call each other out, and create actual group dynamics. The conversation has a life of its own.',
  },
  {
    title: 'More personality variety',
    body: "Replika gives you one customizable companion. MyGang has 10+ distinct characters — the hype friend, the brutally honest one, the chill one, the chaotic one. You pick your squad based on your vibe.",
  },
  {
    title: 'Less dependence, more fun',
    body: "Replika is designed to be your one emotional anchor — which can create unhealthy attachment for some users. MyGang is designed to feel like a group of friends: lighter, more social, more balanced. It's company, not a crutch.",
  },
  {
    title: 'Free to actually try',
    body: "Replika's free tier severely limits what you can do. MyGang's free plan gives you real conversations with 2 gang members, 30 messages per hour, and a preview of the memory system — enough to know if you love it before paying anything.",
  },
]

const faqs = [
  {
    q: 'Is MyGang.ai a direct Replika replacement?',
    a: "MyGang is a different kind of app — it's social and group-focused, not a single companion. If you're looking for something with less emotional dependency and more dynamic group energy, MyGang is a great fit. If you specifically want a romantic AI partner, Replika may suit you better.",
  },
  {
    q: 'Does MyGang have long-term memory like Replika?',
    a: "Yes. Your gang remembers things you've shared across conversations. Free users get a light memory preview; paid users get the full Memory Vault where you can see and manage everything your gang knows about you.",
  },
  {
    q: 'How much does MyGang cost?',
    a: 'MyGang is free to start with 2 gang members and 30 messages/hour. Basic is $14.99/mo (4 members, 40 msgs/hr). Pro is $19.99/mo (6 members, unlimited messages). We\'re currently running launch pricing — much cheaper than Replika Pro.',
  },
  {
    q: 'Can I try MyGang before paying?',
    a: "Yes — sign up free, no credit card required. You'll get 2 gang members and real conversations immediately.",
  },
]

function CheckIcon() {
  return <Check className="w-4 h-4 text-emerald-500 shrink-0" />
}
function CrossIcon() {
  return <X className="w-4 h-4 text-muted-foreground/40 shrink-0" />
}

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <CheckIcon />
  if (value === false) return <CrossIcon />
  return <span className="text-sm text-foreground/80">{value}</span>
}

export default function ReplikaAlternativePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-4xl px-6 py-14">
        {/* Back */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to MyGang.ai
          </Link>
        </div>

        {/* Hero */}
        <header className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-6">
            Replika Alternative 2026
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-5">
            Why settle for one AI<br className="hidden sm:block" /> when you can have a whole gang?
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
            Replika gives you one AI companion. MyGang.ai gives you a full friend group — multiple personalities, group banter, and real social dynamics in a single chat.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try MyGang Free
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-border/60 px-7 py-3 text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
              See Pricing
            </Link>
          </div>
        </header>

        {/* Comparison table */}
        <section className="mb-20">
          <h2 className="text-2xl font-black tracking-tight text-center mb-8">
            Replika vs MyGang.ai — side by side
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="text-left p-4 font-semibold text-muted-foreground">Feature</th>
                  <th className="text-center p-4 font-semibold text-muted-foreground">Replika</th>
                  <th className="text-center p-4 font-bold text-primary">MyGang.ai</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={row.feature} className={`border-b border-border/20 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/[0.03]'}`}>
                    <td className="p-4 text-foreground/80">{row.feature}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center"><CellValue value={row.replika} /></div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center"><CellValue value={row.mygang} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Why switch */}
        <section className="mb-20">
          <h2 className="text-2xl font-black tracking-tight text-center mb-10">
            5 reasons Replika users love MyGang
          </h2>
          <div className="space-y-6">
            {reasons.map((r, i) => (
              <div key={r.title} className="flex gap-5 rounded-2xl border border-border/30 bg-card/20 p-5">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-bold mb-1">{r.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-20">
          <h2 className="text-2xl font-black tracking-tight text-center mb-8">Common questions</h2>
          <div className="space-y-5">
            {faqs.map((item) => (
              <div key={item.q} className="rounded-xl border border-border/30 p-5">
                <h3 className="font-bold mb-2">{item.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center">
          <h2 className="text-2xl font-black mb-3">Meet your gang today</h2>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed max-w-sm mx-auto">
            No credit card. No commitment. Just a whole group of AI friends waiting to chat.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get Started Free
            <ChevronRight className="w-4 h-4" />
          </Link>
        </section>

        {/* Internal links */}
        <div className="mt-10 text-center text-xs text-muted-foreground/60 space-x-4">
          <Link href="/alternative" className="underline hover:text-muted-foreground transition-colors">Character AI Alternative</Link>
          <Link href="/blog" className="underline hover:text-muted-foreground transition-colors">Blog</Link>
          <Link href="/faq" className="underline hover:text-muted-foreground transition-colors">FAQ</Link>
          <Link href="/pricing" className="underline hover:text-muted-foreground transition-colors">Pricing</Link>
        </div>
      </main>
    </div>
  )
}
