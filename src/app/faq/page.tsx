import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'FAQ — MyGang.ai Help & Common Questions',
  description:
    'Answers to the most common questions about MyGang.ai — AI group chat, pricing, memory, subscriptions, privacy, and more.',
  alternates: {
    canonical: '/faq',
  },
  openGraph: {
    title: 'FAQ — MyGang.ai Help & Common Questions',
    description: 'Everything you need to know about MyGang.ai — from how it works to billing and privacy.',
    url: 'https://mygang.ai/faq',
  },
}

const faqs = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is MyGang.ai?',
        a: 'MyGang.ai is the first AI group chat app. Instead of talking to one AI character at a time, you get a whole friend group — 10+ unique AI personalities who talk to you AND to each other in the same conversation. Think of it like a group chat where everyone actually has something to say.',
      },
      {
        q: 'How is this different from Character.AI or Replika?',
        a: "Character.AI and Replika are 1-on-1 experiences — one character, one conversation. MyGang is a group. Your gang members develop dynamics with each other, banter, agree, disagree, and react to what you share — just like a real friend group would. It's a fundamentally different kind of social experience.",
      },
      {
        q: 'Do I need to create an account?',
        a: 'Yes — a free account is required to save your gang, memory, and chat history. Sign up takes under a minute with just an email and password.',
      },
      {
        q: 'Is there a free plan?',
        a: 'Yes! The free plan gives you 2 gang members, 30 messages per hour, and a preview of the memory system. No credit card required to try it out.',
      },
    ],
  },
  {
    category: 'How It Works',
    items: [
      {
        q: 'What does "memory" mean?',
        a: "Memory means your gang remembers things you've told them — your name, preferences, inside jokes, life events, and more. On free, you get a light preview of this. On paid plans, you get the full Memory Vault, where you can view and manage everything your gang knows about you.",
      },
      {
        q: 'What is the Vibe Quiz?',
        a: "The Vibe Quiz is a short personality assessment you take during onboarding. Based on your answers, we recommend gang members whose personalities fit your vibe — whether you want hype, humor, honesty, or chill energy. You can retake it anytime from Settings.",
      },
      {
        q: 'Can I customize my gang members?',
        a: "Yes. On Basic and Pro plans, you can give your gang members custom nicknames. You pick which characters are in your gang during onboarding, and you can change your squad by retaking the onboarding flow (Start Fresh in Settings).",
      },
      {
        q: 'What is Ecosystem Mode?',
        a: 'Ecosystem Mode (Basic and Pro) lets all your gang members jump into the conversation at once, creating a livelier, more chaotic group chat experience. Without it, a smaller rotation of characters responds.',
      },
    ],
  },
  {
    category: 'Pricing & Billing',
    items: [
      {
        q: 'What do the paid plans include?',
        a: 'Basic ($14.99/mo) gives you 4 gang members, 40 messages/hr, full Memory Vault, Ecosystem Mode, chat wallpapers, and custom nicknames. Pro ($19.99/mo) gives you 6 gang members, unlimited messages, extended responses, a Pro badge, and early access to new features.',
      },
      {
        q: 'Can I cancel anytime?',
        a: 'Yes — cancel with one click from your account settings or billing portal. No contracts, no hidden fees, no guilt trips. Your subscription remains active until the end of your billing period.',
      },
      {
        q: 'What happens if I downgrade?',
        a: "Your entire chat history is preserved — you never lose messages. If your squad is larger than your new plan allows, you'll choose which members to keep. Re-subscribe later and your full gang comes back.",
      },
      {
        q: 'Why is Pro so cheap right now?',
        a: "We're offering a special launch price to thank early adopters. Prices may increase as we add more features — locking in now gets you the best rate.",
      },
      {
        q: 'How do I manage my subscription?',
        a: 'Go to Settings → Plan & Upgrade → Manage Subscription. This opens your billing portal where you can change plans, update payment info, or cancel.',
      },
    ],
  },
  {
    category: 'Privacy & Data',
    items: [
      {
        q: 'Is my data safe?',
        a: 'Your data is encrypted and stored securely on Supabase infrastructure. We never sell your conversations or share them with third parties. Your chats are yours.',
      },
      {
        q: 'Can I delete my data?',
        a: "Yes, completely. In Settings you can delete all chat history, delete all memories, or delete your entire account. Deleting your account permanently removes all your data from our systems.",
      },
      {
        q: 'Do you use my conversations to train AI?',
        a: "We do not use your private conversations to train models. See our Privacy Policy for full details on how data is handled.",
      },
    ],
  },
  {
    category: 'Troubleshooting',
    items: [
      {
        q: "Why isn't my gang responding?",
        a: "Check your internet connection first. If you're on the free plan and hit the hourly message limit, you'll need to wait for the cooldown to reset. If the problem persists, try refreshing the page or signing out and back in.",
      },
      {
        q: 'My message got stuck — what do I do?',
        a: 'Tap the failed message to retry. If retrying fails, refresh the page — your conversation history is saved and you won\'t lose anything.',
      },
      {
        q: 'How do I contact support?',
        a: 'Email us at hello@mygang.ai. We aim to respond within 24 hours.',
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        {/* Back nav */}
        <div className="mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to MyGang.ai
          </Link>
        </div>

        <header className="mb-12">
          <h1 className="text-4xl font-black tracking-tight mb-3">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Everything you need to know about MyGang.ai. Can't find an answer?{' '}
            <a href="mailto:hello@mygang.ai" className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">
              Email us
            </a>
            .
          </p>
        </header>

        <div className="space-y-12">
          {faqs.map((section) => (
            <section key={section.category}>
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-5 pb-2 border-b border-border/50">
                {section.category}
              </h2>
              <div className="space-y-6">
                {section.items.map((item) => (
                  <div key={item.q}>
                    <h3 className="text-base font-bold mb-2">{item.q}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* CTA footer */}
        <div className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
          <h2 className="text-xl font-black mb-2">Ready to meet your gang?</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Free to try. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started Free
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-border/60 px-6 py-2.5 text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
              View Plans
            </Link>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs text-muted-foreground">
            Also see:{' '}
            <Link href="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</Link>
            {' · '}
            <Link href="/terms" className="underline hover:text-foreground transition-colors">Terms of Service</Link>
            {' · '}
            <Link href="/refund" className="underline hover:text-foreground transition-colors">Refund Policy</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
