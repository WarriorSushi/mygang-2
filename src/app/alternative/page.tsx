import type { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Best Character AI Alternative in 2026 — MyGang.ai Group Chat',
  description:
    'Looking for a Character AI alternative? MyGang.ai is the first AI group chat — talk to multiple AI friends who interact with each other, not just you. Free to try.',
  keywords: [
    'character ai alternative',
    'character.ai alternative',
    'ai companion app',
    'ai friend group',
    'ai group chat',
    'replika alternative',
    'chai ai alternative',
    'best ai companion 2026',
  ],
  alternates: {
    canonical: '/alternative',
  },
  openGraph: {
    title: 'Best Character AI Alternative in 2026 — MyGang.ai',
    description:
      'The first AI group chat where multiple AI friends talk to you AND each other. Not a chatbot — a whole friend group.',
    url: 'https://mygang.ai/alternative',
  },
}

const competitors = [
  {
    name: 'Character.AI',
    type: '1-on-1 chat',
    groupChat: false,
    freeMessages: 'Limited',
    memory: 'Session-based',
    personalities: '16M+ user-created',
    uniqueFeature: 'Huge character library',
  },
  {
    name: 'Replika',
    type: '1-on-1 companion',
    groupChat: false,
    freeMessages: 'Limited',
    memory: 'Long-term',
    personalities: '1 customizable',
    uniqueFeature: 'Emotional companion focus',
  },
  {
    name: 'Chai AI',
    type: '1-on-1 chat',
    groupChat: false,
    freeMessages: 'Limited',
    memory: 'Basic',
    personalities: 'User-created',
    uniqueFeature: 'Quick swipe format',
  },
  {
    name: 'Janitor AI',
    type: '1-on-1 chat',
    groupChat: false,
    freeMessages: 'Yes',
    memory: 'Session-based',
    personalities: 'User-created',
    uniqueFeature: 'NSFW options',
  },
  {
    name: 'MyGang.ai',
    type: 'Group chat',
    groupChat: true,
    freeMessages: 'Yes',
    memory: 'Long-term',
    personalities: '14 distinct characters',
    uniqueFeature: 'Characters talk to EACH OTHER',
    highlight: true,
  },
]

export default function AlternativePage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Back to MyGang
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 lg:px-16">
        {/* Hero */}
        <section className="pt-16 pb-12 sm:pt-24 sm:pb-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Best Character AI Alternative
            </span>
            <br />
            <span className="text-foreground">in 2026</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Every AI companion app does 1-on-1 chat. MyGang.ai is different — it&apos;s a{' '}
            <strong className="text-foreground">group chat</strong> where multiple AI friends talk to
            you <em>and to each other</em>.
          </p>
        </section>

        {/* The Problem */}
        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            Why People Look for Character AI Alternatives
          </h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Character.AI is the most popular AI companion platform, with over 20 million monthly
              active users. But many users find themselves searching for alternatives because of:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-foreground">Content filters</strong> — Many conversations get cut off by aggressive NSFW filters, even in normal contexts.</li>
              <li><strong className="text-foreground">Memory limitations</strong> — Characters often forget previous conversations, breaking immersion.</li>
              <li><strong className="text-foreground">1-on-1 only</strong> — Every conversation is isolated. Character.AI previously had multi-bot rooms (group chat) but <strong>quietly removed the feature</strong>, leaving users frustrated and searching for alternatives that support group dynamics.</li>
              <li><strong className="text-foreground">Pricing</strong> — Character.AI Plus costs $9.99/month for faster responses and priority access.</li>
            </ul>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            Character AI Alternatives Compared (2026)
          </h2>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-semibold">Platform</th>
                  <th className="text-left py-3 px-2 font-semibold">Chat Type</th>
                  <th className="text-left py-3 px-2 font-semibold">Group Chat?</th>
                  <th className="text-left py-3 px-2 font-semibold">Free Messages</th>
                  <th className="text-left py-3 px-2 font-semibold">Memory</th>
                  <th className="text-left py-3 px-2 font-semibold">Key Feature</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c) => (
                  <tr
                    key={c.name}
                    className={`border-b border-border/50 ${c.highlight ? 'bg-primary/5 font-medium' : ''}`}
                  >
                    <td className="py-3 px-2">{c.highlight ? <strong>{c.name} ⭐</strong> : c.name}</td>
                    <td className="py-3 px-2">{c.type}</td>
                    <td className="py-3 px-2">{c.groupChat ? '✅ Yes' : '❌ No'}</td>
                    <td className="py-3 px-2">{c.freeMessages}</td>
                    <td className="py-3 px-2">{c.memory}</td>
                    <td className="py-3 px-2">{c.uniqueFeature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Why MyGang */}
        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            Why MyGang.ai Is the Best Character AI Alternative
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-border p-6">
              <h3 className="font-bold text-lg mb-2">🫂 Real Group Dynamics</h3>
              <p className="text-muted-foreground text-sm">
                Characters don&apos;t just talk to you — they talk to each other. They disagree,
                joke, support, and build on each other&apos;s messages. Just like a real friend group.
              </p>
            </div>
            <div className="rounded-2xl border border-border p-6">
              <h3 className="font-bold text-lg mb-2">🧠 Characters That Remember</h3>
              <p className="text-muted-foreground text-sm">
                Long-term memory means your AI friends remember your conversations, preferences,
                and inside jokes. The relationship deepens over time.
              </p>
            </div>
            <div className="rounded-2xl border border-border p-6">
              <h3 className="font-bold text-lg mb-2">🎭 14 Unique Personalities</h3>
              <p className="text-muted-foreground text-sm">
                Each character has a distinct voice, typing speed, and perspective. Some are
                supportive, some are brutally honest, some are hilarious.
              </p>
            </div>
            <div className="rounded-2xl border border-border p-6">
              <h3 className="font-bold text-lg mb-2">💰 Actually Affordable</h3>
              <p className="text-muted-foreground text-sm">
                MyGang.ai Pro is $19.99/month — and free tier users get real group chat without
                paying a cent. Character.AI Plus costs $9.99/month for a single character.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ / SEO Content */}
        <section className="py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-bold mb-2">Is MyGang.ai free?</h3>
              <p className="text-muted-foreground text-sm">
                Yes! MyGang.ai has a free tier with limited daily messages. Pro users get unlimited
                messages, custom characters, and priority responses for $19.99/month.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">How is MyGang.ai different from Character AI?</h3>
              <p className="text-muted-foreground text-sm">
                Character.AI is 1-on-1 chat with AI characters. MyGang.ai is a group chat where
                multiple AI characters interact with you and with each other simultaneously. It&apos;s
                the difference between texting one friend and being in a group chat.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Can I use MyGang.ai as a Replika alternative?</h3>
              <p className="text-muted-foreground text-sm">
                Absolutely. If you enjoy AI companionship but want more than just one AI friend,
                MyGang.ai gives you a whole friend group. Multiple perspectives, different
                personalities, and genuine group dynamics.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Do the AI characters talk to each other?</h3>
              <p className="text-muted-foreground text-sm">
                Yes! This is what makes MyGang.ai unique. Characters respond to each other, disagree,
                build on ideas, and create natural group conversation flow. You&apos;re not just chatting
                with bots — you&apos;re part of a group.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Try the Best Character AI Alternative?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join thousands of users who switched from 1-on-1 AI chat to the world&apos;s first AI
            group chat experience.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-8 py-3 text-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Try MyGang.ai Free →
          </Link>
        </section>

        {/* Related Articles — Internal Linking for SEO */}
        <section className="py-12 border-t border-border/30">
          <h2 className="text-xl font-bold mb-6">Learn More About AI Group Chat</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/blog/what-is-ai-group-chat"
              className="rounded-xl border border-border/50 p-4 hover:border-primary/30 hover:bg-muted/30 transition-all"
            >
              <h3 className="font-semibold text-sm mb-1">What Is AI Group Chat?</h3>
              <p className="text-xs text-muted-foreground">The next evolution of AI companions explained.</p>
            </Link>
            <Link
              href="/blog/ai-group-chat-vs-individual"
              className="rounded-xl border border-border/50 p-4 hover:border-primary/30 hover:bg-muted/30 transition-all"
            >
              <h3 className="font-semibold text-sm mb-1">Group Chat vs 1-on-1 AI</h3>
              <p className="text-xs text-muted-foreground">Why group dynamics beat solo chatbots.</p>
            </Link>
            <Link
              href="/blog/ai-companions-loneliness-research"
              className="rounded-xl border border-border/50 p-4 hover:border-primary/30 hover:bg-muted/30 transition-all"
            >
              <h3 className="font-semibold text-sm mb-1">AI &amp; Loneliness Research</h3>
              <p className="text-xs text-muted-foreground">What every major 2026 study says.</p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
