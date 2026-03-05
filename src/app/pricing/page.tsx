'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Check, X, Zap, Crown, MessageCircle, Brain,
  Infinity, Clock, Shield, Sparkles, ArrowRight, ChevronDown,
  Lock, CreditCard, RefreshCw, Star, Users, Heart, Gauge,
  Palette, Volume2, BellRing, Layers
} from 'lucide-react'
import { useChatStore } from '@/stores/chat-store'
import { createClient } from '@/lib/supabase/client'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { motion, AnimatePresence } from 'framer-motion'

/* ══════════════════════════════════════════════════════
   TYPES & DATA
   ══════════════════════════════════════════════════════ */

type Tier = 'free' | 'basic' | 'pro'

interface Feature {
  text: string
  free: boolean | string
  basic: boolean | string
  pro: boolean | string
}

const features: Feature[] = [
  { text: 'Messages per month', free: '~20/hr', basic: '1,000', pro: 'Unlimited' },
  { text: 'Gang members in chat', free: 'Up to 4', basic: 'Up to 4', pro: 'Up to 4' },
  { text: 'Hourly cooldowns', free: '60 min when capped', basic: 'None', pro: 'None' },
  { text: 'Memory — gang remembers you', free: false, basic: true, pro: true },
  { text: 'Priority response speed', free: false, basic: false, pro: true },
  { text: 'Chat wallpapers', free: false, basic: true, pro: true },
  { text: 'Custom character nicknames', free: false, basic: true, pro: true },
  { text: 'Ecosystem chat mode', free: false, basic: true, pro: true },
  { text: 'Dark & light themes', free: true, basic: true, pro: true },
  { text: 'Memory vault access', free: false, basic: true, pro: true },
  { text: 'Pro badge in chat', free: false, basic: false, pro: true },
]

const faqs = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, absolutely. Cancel with one click from your account settings. No contracts, no hidden fees, no guilt trips. Your subscription stays active until the end of your billing period.',
  },
  {
    q: 'What happens to my messages if I downgrade?',
    a: 'Your chat history stays exactly where it is. You never lose messages. If you downgrade from a plan with memory, your gang will stop forming new memories but everything already saved remains.',
  },
  {
    q: 'What does "memory" actually mean?',
    a: 'Memory means your gang members remember details about you across conversations — your name, preferences, inside jokes, and things you\'ve told them. Without memory, each conversation starts fresh.',
  },
  {
    q: 'Is my data safe?',
    a: 'Your data is encrypted and stored securely on Supabase infrastructure. We never sell your data or share your conversations with third parties. Your chats are yours.',
  },
  {
    q: 'Why is Pro so cheap right now?',
    a: 'We\'re running a launch special to thank early adopters. The regular price will be $99/mo once we exit the launch period. Lock in the $19.99/mo price now and keep it forever.',
  },
]

/* ══════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════ */

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm font-semibold text-foreground">{value}</span>
  }
  if (value) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/15">
        <Check className="w-4 h-4 text-emerald-400" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/5">
      <X className="w-4 h-4 text-muted-foreground/30" />
    </span>
  )
}

function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 sm:py-6 text-left gap-4 group cursor-pointer"
      >
        <span className="text-[15px] sm:text-base font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
          {q}
        </span>
        <ChevronDown className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-[15px] leading-relaxed text-muted-foreground/70 max-w-2xl">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════ */

export default function PricingPage() {
  const { userId, isHydrated, subscriptionTier, setSubscriptionTier } = useChatStore()
  const [tierLoaded, setTierLoaded] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  // Fetch current tier
  useEffect(() => {
    if (!isHydrated || !userId) {
      setTierLoaded(true)
      return
    }
    let cancelled = false
    const fetchTier = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', userId)
          .single()
        if (!cancelled && data) {
          const tier = data.subscription_tier
          if (tier === 'pro') setSubscriptionTier('pro')
          else if (tier === 'basic') setSubscriptionTier('basic')
          else setSubscriptionTier('free')
        }
      } catch { /* fallback to free */ }
      finally { if (!cancelled) setTierLoaded(true) }
    }
    fetchTier()
    return () => { cancelled = true }
  }, [isHydrated, userId, setSubscriptionTier])

  // Init DodoPayments SDK
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const { DodoPayments } = await import('dodopayments-checkout')
        DodoPayments.Initialize({
          mode: process.env.NEXT_PUBLIC_DODO_ENV === 'live_mode' ? 'live' : 'test',
          displayType: 'overlay',
        })
        if (!cancelled) setSdkReady(true)
      } catch (err) {
        console.error('[pricing] Failed to init DodoPayments SDK:', err)
      }
    }
    init()
    return () => { cancelled = true }
  }, [])

  const currentTier: Tier = userId ? subscriptionTier : 'free'

  const handleCheckout = useCallback(async (plan: 'basic' | 'pro') => {
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to start checkout. Please try again.')
        return
      }
      const { checkout_url } = await res.json()
      if (sdkReady) {
        const { DodoPayments } = await import('dodopayments-checkout')
        await DodoPayments.Checkout.open({ checkoutUrl: checkout_url })
      } else {
        window.location.href = checkout_url
      }
    } catch (err) {
      console.error('[pricing] Checkout error:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }, [sdkReady])

  const isCurrentPlan = (tier: Tier) => tierLoaded && !!userId && currentTier === tier
  const isDowngrade = (tier: Tier) => tierLoaded && !!userId && (
    (currentTier === 'pro' && tier !== 'pro') ||
    (currentTier === 'basic' && tier === 'free')
  )

  return (
    <div className="relative min-h-dvh bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
      <BackgroundBlobs />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to chat</span>
          </Link>
          <span className="text-sm font-bold tracking-tight">MyGang<span className="text-primary">.ai</span></span>
        </div>
      </nav>

      <main className="relative z-10">

        {/* ══════════ HERO ══════════ */}
        <section className="pt-16 sm:pt-24 pb-4 text-center px-5 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">Launch pricing — save 80%</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] max-w-3xl mx-auto">
              Choose your
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-accent"> vibe </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-muted-foreground/70 max-w-xl mx-auto leading-relaxed">
              From casual hangs to unlimited chaos. Pick the plan that matches how hard you go.
            </p>
          </motion.div>
        </section>

        {/* ══════════ PRICING CARDS ══════════ */}
        <section className="px-5 sm:px-8 pb-20 sm:pb-28 pt-10 sm:pt-14">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">

            {/* ── FREE ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative rounded-3xl border border-white/8 bg-card/50 backdrop-blur-sm px-7 py-7 sm:px-9 sm:py-9 flex flex-col"
            >
              <div className="flex items-center gap-3.5 mb-7">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Free</h3>
                  <p className="text-sm text-muted-foreground">Dip your toes in</p>
                </div>
              </div>

              <div className="mb-9">
                <div className="flex items-baseline">
                  <span className="text-6xl font-black tracking-tighter">$0</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Free forever, no card needed</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {[
                  { text: '20 messages per hour', icon: MessageCircle },
                  { text: 'Pick up to 4 gang members', icon: Users },
                  { text: 'Gang Focus chat mode', icon: Volume2 },
                  { text: 'Dark & light themes', icon: Palette },
                  { text: '60 min cooldown when capped', icon: Clock, muted: true },
                  { text: 'No memory — fresh each time', icon: Brain, muted: true },
                  { text: 'No wallpapers or nicknames', icon: Star, muted: true },
                  { text: 'No Ecosystem mode', icon: Sparkles, muted: true },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3.5">
                    <span className={`mt-0.5 shrink-0 ${f.muted ? 'text-muted-foreground/30' : 'text-muted-foreground/60'}`}>
                      {f.muted ? <X className="w-4.5 h-4.5" /> : <Check className="w-4.5 h-4.5 text-emerald-400/70" />}
                    </span>
                    <span className={`text-[15px] leading-snug ${f.muted ? 'text-muted-foreground/40 line-through' : 'text-foreground/80'}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan('free') ? (
                <div className="w-full py-4 sm:py-5 rounded-2xl text-[15px] font-semibold text-center bg-muted/30 text-muted-foreground/50 border border-white/5">
                  Current plan
                </div>
              ) : (
                <div className="w-full py-4 sm:py-5 rounded-2xl text-[15px] font-semibold text-center bg-muted/20 text-muted-foreground/40 border border-white/5">
                  Free forever
                </div>
              )}
            </motion.div>

            {/* ── BASIC ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative rounded-3xl border border-blue-500/20 bg-card/50 backdrop-blur-sm px-7 py-7 sm:px-9 sm:py-9 flex flex-col"
            >
              <div className="flex items-center gap-3.5 mb-7">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Basic</h3>
                  <p className="text-sm text-muted-foreground">For the daily hangs</p>
                </div>
              </div>

              <div className="mb-9">
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black tracking-tighter">$14.99</span>
                  <span className="text-xl text-muted-foreground font-medium">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Billed monthly, cancel anytime</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {[
                  { text: '1,000 messages per month', icon: MessageCircle },
                  { text: 'Memory enabled — they know you', icon: Brain, highlight: true },
                  { text: 'Ecosystem mode — real group chat', icon: Sparkles, highlight: true },
                  { text: 'Zero hourly cooldowns', icon: Clock },
                  { text: 'Chat wallpapers', icon: Palette },
                  { text: 'Custom character nicknames', icon: Star },
                  { text: 'Memory vault — review & manage', icon: Lock },
                  { text: 'Pick up to 4 gang members', icon: Users },
                  { text: 'All themes included', icon: Palette },
                  { text: 'Everything in Free', icon: Sparkles },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3.5">
                    <Check className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${f.highlight ? 'text-blue-400' : 'text-emerald-400/70'}`} />
                    <span className={`text-[15px] leading-snug ${f.highlight ? 'text-foreground font-semibold' : 'text-foreground/80'}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan('basic') ? (
                <div className="w-full py-4 sm:py-5 rounded-2xl text-[15px] font-semibold text-center bg-blue-500/10 text-blue-400/60 border border-blue-500/15">
                  Current plan
                </div>
              ) : isDowngrade('basic') ? (
                <div className="w-full py-4 sm:py-5 rounded-2xl text-[15px] font-semibold text-center bg-muted/20 text-muted-foreground/30 border border-white/5">
                  Included in your plan
                </div>
              ) : (
                <button
                  onClick={() => handleCheckout('basic')}
                  disabled={loadingPlan !== null}
                  className="w-full py-4 sm:py-5 rounded-2xl text-[15px] font-bold text-center bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 hover:border-blue-500/40 transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2.5"
                >
                  {loadingPlan === 'basic' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Get Basic</>
                  )}
                </button>
              )}
            </motion.div>

            {/* ── PRO (highlighted) ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="relative rounded-3xl border-2 border-primary/40 bg-card/60 backdrop-blur-sm px-7 py-7 sm:px-9 sm:py-9 flex flex-col shadow-[0_0_80px_-20px] shadow-primary/15"
            >
              {/* Most Popular badge */}
              <div className="absolute -top-4 left-6 sm:left-8">
                <span className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest whitespace-nowrap shadow-lg shadow-primary/30">
                  Most Popular
                </span>
              </div>

              <div className="flex items-center gap-3.5 mb-7 mt-5">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl">Pro</h3>
                  <p className="text-sm text-muted-foreground">Your gang, unhinged</p>
                </div>
              </div>

              <div className="mb-9">
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-black tracking-tighter">$19.99</span>
                  <span className="text-xl text-muted-foreground font-medium">/mo</span>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-sm text-muted-foreground line-through">$99/mo</span>
                  <span className="px-3 py-1 rounded-lg bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider border border-primary/25">
                    Save 80%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Lock in forever at launch price</p>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {[
                  { text: 'Unlimited messages — no caps ever', icon: Infinity, highlight: true },
                  { text: 'Full memory — they remember everything', icon: Brain, highlight: true },
                  { text: 'Priority response speed', icon: Gauge, highlight: true },
                  { text: 'Ecosystem mode — real group chat', icon: Sparkles, highlight: true },
                  { text: 'Zero cooldowns, always', icon: Clock },
                  { text: 'Pro badge in your chat', icon: Crown },
                  { text: 'Chat wallpapers', icon: Palette },
                  { text: 'Custom character nicknames', icon: Star },
                  { text: 'Memory vault — review & manage', icon: Lock },
                  { text: 'Pick up to 4 gang members', icon: Users },
                  { text: 'All themes included', icon: Palette },
                  { text: 'Everything in Basic + Free', icon: Sparkles },
                  { text: 'Early access to new features', icon: BellRing },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3.5">
                    <Check className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${f.highlight ? 'text-primary' : 'text-emerald-400/70'}`} />
                    <span className={`text-[15px] leading-snug ${f.highlight ? 'text-foreground font-semibold' : 'text-foreground/80'}`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan('pro') ? (
                <div className="w-full py-4 sm:py-5 rounded-2xl text-[15px] font-bold text-center bg-primary/10 text-primary/60 border border-primary/20">
                  Current plan
                </div>
              ) : (
                <button
                  onClick={() => handleCheckout('pro')}
                  disabled={loadingPlan !== null}
                  className="w-full py-4 sm:py-5 rounded-2xl text-[15px] font-bold text-center bg-primary text-primary-foreground hover:brightness-110 transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2.5"
                >
                  {loadingPlan === 'pro' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Get Pro
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              )}
            </motion.div>
          </div>
        </section>

        {/* ══════════ COMPARISON TABLE (desktop) ══════════ */}
        <section className="px-5 sm:px-8 pb-20 sm:pb-28 hidden md:block">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-center mb-14">
              Compare plans side by side
            </h2>

            <div className="rounded-3xl border border-white/8 bg-card/30 backdrop-blur-sm overflow-hidden">
              {/* Header row */}
              <div
                className="border-b border-white/8 bg-white/[0.02]"
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr' }}
              >
                <div className="p-6 text-[15px] font-semibold text-muted-foreground">Feature</div>
                <div className="p-6 text-[15px] font-semibold text-center text-muted-foreground">Free</div>
                <div className="p-6 text-[15px] font-semibold text-center text-blue-400">Basic</div>
                <div className="p-6 text-[15px] font-semibold text-center text-primary">Pro</div>
              </div>

              {/* Feature rows */}
              {features.map((f, i) => (
                <div
                  key={f.text}
                  className={`border-b border-white/5 last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                  style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr' }}
                >
                  <div className="p-5 sm:p-6 text-[15px] text-foreground/70">{f.text}</div>
                  <div className="p-5 sm:p-6 flex justify-center items-center"><FeatureValue value={f.free} /></div>
                  <div className="p-5 sm:p-6 flex justify-center items-center"><FeatureValue value={f.basic} /></div>
                  <div className="p-5 sm:p-6 flex justify-center items-center"><FeatureValue value={f.pro} /></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ SOCIAL PROOF ══════════ */}
        <section className="px-5 sm:px-8 pb-20 sm:pb-28">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-16 text-muted-foreground/50">
              <div>
                <div className="text-4xl sm:text-5xl font-black text-foreground">24/7</div>
                <div className="text-sm uppercase tracking-widest mt-2">Always online</div>
              </div>
              <div className="w-px h-12 bg-white/10 hidden sm:block" />
              <div>
                <div className="text-4xl sm:text-5xl font-black text-foreground">4</div>
                <div className="text-sm uppercase tracking-widest mt-2">Unique characters</div>
              </div>
              <div className="w-px h-12 bg-white/10 hidden sm:block" />
              <div>
                <div className="text-4xl sm:text-5xl font-black text-foreground">0</div>
                <div className="text-sm uppercase tracking-widest mt-2">Boring replies</div>
              </div>
              <div className="w-px h-12 bg-white/10 hidden sm:block" />
              <div>
                <div className="text-4xl sm:text-5xl font-black text-foreground flex items-center gap-1.5">
                  <Heart className="w-6 h-6 text-red-400" />
                  100%
                </div>
                <div className="text-sm uppercase tracking-widest mt-2">Personality</div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ FAQ ══════════ */}
        <section className="px-5 sm:px-8 pb-20 sm:pb-28">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-center mb-12">
              Frequently asked questions
            </h2>
            <div className="rounded-3xl border border-white/8 bg-card/30 backdrop-blur-sm px-7 sm:px-10">
              {faqs.map((faq, i) => (
                <FAQItem
                  key={i}
                  q={faq.q}
                  a={faq.a}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ BOTTOM CTA ══════════ */}
        <section className="px-5 sm:px-8 pb-24 sm:pb-32">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-5">
              Ready to unlock the full experience?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
              Get unlimited messages, full memory, and priority speed. Your gang is waiting.
            </p>

            {!isCurrentPlan('pro') && (
              <button
                onClick={() => handleCheckout('pro')}
                disabled={loadingPlan !== null}
                className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl text-base font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-xl shadow-primary/30 disabled:opacity-50 disabled:cursor-wait"
              >
                {loadingPlan === 'pro' ? (
                  <>
                    <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Get Pro — $19.99/mo
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-12 text-xs uppercase tracking-widest text-muted-foreground/40 font-medium">
              <span className="inline-flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Secure checkout
              </span>
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Cancel anytime
              </span>
              <span className="inline-flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                No hidden fees
              </span>
              <span className="inline-flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Price locked forever
              </span>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
