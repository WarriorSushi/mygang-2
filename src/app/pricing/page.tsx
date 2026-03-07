'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Check, Crown, MessageCircle, Brain,
  Infinity, Clock, Shield, Sparkles, ArrowRight, ChevronDown,
  CreditCard, RefreshCw, Users, Heart, Gauge,
  Palette, Volume2, BellRing, Layers, X
} from 'lucide-react'
import { useChatStore } from '@/stores/chat-store'
import { createClient } from '@/lib/supabase/client'
import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { motion, AnimatePresence } from 'framer-motion'
import { TIER_LIMITS, getTierCopy } from '@/lib/billing'

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
  { text: 'Gang members in chat', free: `Up to ${TIER_LIMITS.free.squadLimit}`, basic: `Up to ${TIER_LIMITS.basic.squadLimit}`, pro: `Up to ${TIER_LIMITS.pro.squadLimit}` },
  { text: 'Messages', free: getTierCopy('free').comparisonMessagesLabel, basic: getTierCopy('basic').comparisonMessagesLabel, pro: getTierCopy('pro').comparisonMessagesLabel },
  { text: 'Chat memory', free: getTierCopy('free').memoryLabel, basic: getTierCopy('basic').memoryLabel, pro: getTierCopy('pro').memoryLabel },
  { text: 'Cooldowns', free: getTierCopy('free').cooldownLabel, basic: getTierCopy('basic').cooldownLabel, pro: getTierCopy('pro').cooldownLabel },
  { text: 'Priority response speed', free: false, basic: false, pro: true },
  { text: 'Ecosystem chat mode', free: false, basic: true, pro: true },
  { text: 'Chat wallpapers', free: false, basic: true, pro: true },
  { text: 'Custom character nicknames', free: false, basic: true, pro: true },
  { text: 'Memory vault access', free: false, basic: true, pro: true },
  { text: 'Dark & light themes', free: true, basic: true, pro: true },
  { text: 'Pro badge in chat', free: false, basic: false, pro: true },
]

const faqs = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, absolutely. Cancel with one click from your account settings. No contracts, no hidden fees, no guilt trips. Your subscription stays active until the end of your billing period.',
  },
  {
    q: 'What happens to my gang if I downgrade?',
    a: "Your chat history stays exactly where it is — you never lose messages. If your squad is larger than your new plan allows, you'll get to choose which members to keep. If you re-subscribe later, your removed members come right back.",
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
    a: 'We\'re offering a special launch price to thank early adopters. Prices may increase as we add more features, so now is the best time to get in.',
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
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/15" role="img" aria-label="Included">
        <Check className="w-4 h-4 text-emerald-400" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-muted/30 dark:bg-white/5" role="img" aria-label="Not included">
      <X className="w-4 h-4 text-muted-foreground/50 dark:text-muted-foreground/30" />
    </span>
  )
}

function FAQItem({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border/20 last:border-0">
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
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
  const userId = useChatStore((s) => s.userId)
  const isHydrated = useChatStore((s) => s.isHydrated)
  const subscriptionTier = useChatStore((s) => s.subscriptionTier)
  const setSubscriptionTier = useChatStore((s) => s.setSubscriptionTier)
  const [tierLoaded, setTierLoaded] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [tierFetchError, setTierFetchError] = useState(false)

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
      } catch { setTierFetchError(true) }
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
    if (!userId) {
      setCheckoutError('sign_in_required')
      return
    }
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setCheckoutError(err.error || 'Failed to start checkout. Please try again.')
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
      setCheckoutError('Something went wrong. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }, [sdkReady, userId])

  // Auto-dismiss checkout error
  useEffect(() => {
    if (checkoutError) {
      const t = setTimeout(() => setCheckoutError(null), 5000)
      return () => clearTimeout(t)
    }
  }, [checkoutError])

  const isCurrentPlan = (tier: Tier) => tierLoaded && !!userId && currentTier === tier
  const isDowngrade = (tier: Tier) => tierLoaded && !!userId && (
    (currentTier === 'pro' && tier !== 'pro') ||
    (currentTier === 'basic' && tier === 'free')
  )
  const freeCopy = getTierCopy('free')
  const basicCopy = getTierCopy('basic')
  const proCopy = getTierCopy('pro')

  return (
    <div className="relative min-h-dvh bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
      <BackgroundBlobs />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/30 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link
            href={userId ? '/chat' : '/'}
            className="inline-flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{userId ? 'Back to chat' : 'Back to home'}</span>
          </Link>
          <span className="text-sm font-bold tracking-tight">MyGang<span className="text-primary">.ai</span></span>
        </div>
      </nav>

      <main id="main-content" className="relative z-10">

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

        {/* Checkout error banner */}
        {checkoutError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-xl text-sm shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
            {checkoutError === 'sign_in_required' ? (
              <>
                <span>Please sign in before upgrading.</span>
                <Link href="/" className="underline font-bold whitespace-nowrap hover:text-white/80">
                  Sign in
                </Link>
              </>
            ) : (
              checkoutError
            )}
          </div>
        )}

        {/* Tier fetch error warning */}
        {tierFetchError && (
          <div className="max-w-6xl mx-auto px-5 sm:px-8 mt-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-700 dark:text-amber-300 text-center">
              Could not verify your current plan. Displayed tiers may not reflect your subscription.
            </div>
          </div>
        )}

        {/* ══════════ PRICING CARDS ══════════ */}
        <section className="px-5 sm:px-8 pb-20 sm:pb-28 pt-10 sm:pt-14">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">

            {/* ── FREE ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative rounded-3xl border border-border/30 bg-card/50 backdrop-blur-sm p-8 sm:p-10 flex flex-col"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Free</p>
              <h3 className="text-3xl sm:text-4xl font-black tracking-tight">$0</h3>
              <p className="text-sm text-muted-foreground mt-2 mb-8">Free forever, no card needed</p>

              <ul className="space-y-3.5 mb-8 flex-1">
                {[
                  { text: `Up to ${TIER_LIMITS.free.squadLimit} gang members`, icon: Users },
                  { text: freeCopy.messagesLabel, icon: MessageCircle },
                  { text: freeCopy.memoryLabel, icon: Brain },
                  { text: 'Gang Focus chat mode', icon: Volume2 },
                  { text: 'Dark & light themes', icon: Palette },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3">
                    <Check className="w-4.5 h-4.5 mt-0.5 shrink-0 text-emerald-400/70" />
                    <span className="text-[15px] leading-snug text-foreground/80">
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrentPlan('free') ? (
                <div className="w-full py-3.5 sm:py-4 rounded-2xl text-[15px] font-semibold text-center bg-muted/40 dark:bg-muted/30 text-muted-foreground/70 dark:text-muted-foreground/50 border border-border/40 dark:border-border/20">
                  Current plan
                </div>
              ) : (
                <div className="w-full py-3.5 sm:py-4 rounded-2xl text-[15px] font-semibold text-center bg-muted/30 dark:bg-muted/20 text-muted-foreground/60 dark:text-muted-foreground/40 border border-border/40 dark:border-border/20">
                  Free forever
                </div>
              )}
            </motion.div>

            {/* ── BASIC ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative rounded-3xl border border-blue-500/20 bg-card/50 backdrop-blur-sm p-8 sm:p-10 flex flex-col"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">Basic</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-3xl sm:text-4xl font-black tracking-tight">$14.99</h3>
                <span className="text-base text-muted-foreground font-medium">/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 mb-8">Billed monthly, cancel anytime</p>

              <ul className="space-y-3.5 mb-8 flex-1">
                {[
                  { text: `Up to ${TIER_LIMITS.basic.squadLimit} gang members`, icon: Users, highlight: true },
                  { text: basicCopy.messagesLabel, icon: MessageCircle },
                  { text: basicCopy.memoryLabel, icon: Brain, highlight: true },
                  { text: 'Ecosystem mode — real group chat', icon: Sparkles, highlight: true },
                  { text: 'No hourly cooldowns', icon: Clock },
                  { text: 'Wallpapers & custom nicknames', icon: Palette },
                  { text: 'Memory vault access', icon: Brain },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3.5">
                    <Check className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${f.highlight ? 'text-blue-400' : 'text-emerald-400/70'}`} />
                    <span className={`text-[15px] leading-snug ${f.highlight ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
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
                  className="btn-gradient-border w-full py-4 sm:py-5 rounded-2xl text-[15px] font-bold text-center bg-card/90 text-blue-400 cursor-pointer disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2.5 active:scale-[0.97]"
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
              className="relative rounded-3xl border-2 border-primary/40 bg-card/60 backdrop-blur-sm p-8 sm:p-10 flex flex-col shadow-[0_0_80px_-20px] shadow-primary/15"
            >
              {/* Most Popular badge — centered on the top border */}
              <div className="absolute left-6 sm:left-8 z-10" style={{ top: '-14px' }}>
                <span className="px-5 py-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest whitespace-nowrap shadow-lg shadow-primary/30">
                  Most Popular
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <h3 className="text-3xl sm:text-4xl font-black tracking-tight">$19.99</h3>
                <span className="text-base text-muted-foreground font-medium">/mo</span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-muted-foreground/60" style={{ textDecoration: 'line-through', textDecorationColor: '#f87171', textDecorationThickness: '2px' }}>$99/mo</span>
                <span className="px-2.5 py-0.5 rounded-md bg-red-500/15 text-red-400 text-xs font-bold uppercase tracking-wider border border-red-500/25">
                  Save 80%
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 mb-8">Early adopter launch price</p>

              <ul className="space-y-3.5 mb-8 flex-1">
                {[
                  { text: `Up to ${TIER_LIMITS.pro.squadLimit} gang members`, icon: Users, highlight: true },
                  { text: `${proCopy.messagesLabel} — no caps`, icon: Infinity, highlight: true },
                  { text: proCopy.memoryLabel, icon: Brain, highlight: true },
                  { text: 'Priority response speed', icon: Gauge, highlight: true },
                  { text: 'Pro badge in chat', icon: Crown },
                  { text: 'Early access to new features', icon: BellRing },
                  { text: 'Everything in Basic', icon: Layers },
                ].map((f) => (
                  <li key={f.text} className="flex items-start gap-3">
                    <Check className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${f.highlight ? 'text-primary' : 'text-emerald-400/70'}`} />
                    <span className={`text-[15px] leading-snug ${f.highlight ? 'text-foreground font-medium' : 'text-foreground/80'}`}>
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
                  className="btn-gradient-border btn-gradient-border-pro w-full py-4 sm:py-5 rounded-2xl text-[15px] font-bold text-center bg-card/90 text-emerald-400 cursor-pointer disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2.5 active:scale-[0.97]"
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

        {/* ══════════ COMPARISON TABLE ══════════ */}
        <section className="px-5 sm:px-8 pt-4 sm:pt-8 pb-20 sm:pb-28">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-center mb-10 sm:mb-14">
              Compare plans side by side
            </h2>

            <p className="mb-4 text-center text-xs uppercase tracking-widest text-muted-foreground/60 md:hidden">
              Swipe sideways to compare every plan
            </p>

            <div className="rounded-3xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-x-auto overscroll-x-contain relative pb-2">
              <div className="min-w-[640px] sm:min-w-[720px] pr-2 sm:pr-4" role="table" aria-label="Plan comparison">
              <div
                role="row"
                className="grid grid-cols-[minmax(132px,1.35fr)_repeat(3,minmax(108px,1fr))] sm:grid-cols-[1.6fr_repeat(3,1fr)] border-b border-border/20 bg-muted/5"
              >
                <div role="columnheader" className="p-3 sm:p-6 text-[11px] sm:text-[15px] font-semibold text-muted-foreground">Feature</div>
                <div role="columnheader" className="p-3 sm:p-6 text-[11px] sm:text-[15px] font-semibold text-center text-muted-foreground">Free</div>
                <div role="columnheader" className="p-3 sm:p-6 text-[11px] sm:text-[15px] font-semibold text-center text-blue-400">Basic</div>
                <div role="columnheader" className="p-3 sm:p-6 text-[11px] sm:text-[15px] font-semibold text-center text-primary">Pro</div>
              </div>

              {features.map((f, i) => (
                <div
                  key={f.text}
                  role="row"
                  className={`grid grid-cols-[minmax(132px,1.35fr)_repeat(3,minmax(108px,1fr))] sm:grid-cols-[1.6fr_repeat(3,1fr)] border-b border-border/10 last:border-0 ${i % 2 === 0 ? '' : 'bg-muted/[0.03]'}`}
                >
                  <div role="cell" className="p-3 sm:p-6 text-[11px] sm:text-[15px] text-foreground/70">{f.text}</div>
                  <div role="cell" className="p-3 sm:p-6 flex justify-center items-center"><FeatureValue value={f.free} /></div>
                  <div role="cell" className="p-3 sm:p-6 flex justify-center items-center"><FeatureValue value={f.basic} /></div>
                  <div role="cell" className="p-3 sm:p-6 flex justify-center items-center"><FeatureValue value={f.pro} /></div>
                </div>
              ))}
            </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background via-background/85 to-transparent md:hidden" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* ══════════ CONVERSION HEADLINE + STATS ══════════ */}
        <section className="px-5 sm:px-8 pb-20 sm:pb-28">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-14 leading-tight">
              Your personal group of friends,{' '}
              <span
                className="inline-block bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #10b981, #06b6d4, #8b5cf6, #ec4899, #10b981)',
                  backgroundSize: '200% 100%',
                  animation: 'gradient-slide 4s linear infinite',
                }}
              >
                always with you
              </span>
            </h2>
            <style>{`
              @keyframes gradient-slide { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
              @keyframes border-spin { 0% { --border-angle: 0deg; } 100% { --border-angle: 360deg; } }
              @property --border-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

              .btn-gradient-border {
                position: relative;
                background: transparent;
                isolation: isolate;
                border: none;
                transition: transform 0.3s, box-shadow 0.3s;
                box-shadow: 0 4px 20px -4px rgba(59, 130, 246, 0.25), 0 2px 8px -2px rgba(0, 0, 0, 0.08);
              }
              :is(.dark) .btn-gradient-border {
                box-shadow: 0 4px 24px -4px rgba(59, 130, 246, 0.3), 0 2px 8px -2px rgba(0, 0, 0, 0.4);
              }
              .btn-gradient-border::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: inherit;
                padding: 1.5px;
                background: conic-gradient(from var(--border-angle), transparent 30%, #3b82f6 50%, #06b6d4 60%, transparent 70%);
                animation: border-spin 3.5s linear infinite;
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                z-index: -1;
              }
              .btn-gradient-border:hover {
                transform: scale(1.03);
                box-shadow: 0 6px 28px -4px rgba(59, 130, 246, 0.35), 0 4px 12px -2px rgba(0, 0, 0, 0.1);
              }
              :is(.dark) .btn-gradient-border:hover {
                box-shadow: 0 6px 32px -4px rgba(59, 130, 246, 0.45), 0 4px 12px -2px rgba(0, 0, 0, 0.5);
              }

              .btn-gradient-border-pro {
                box-shadow: 0 4px 24px -4px rgba(16, 185, 129, 0.3), 0 2px 10px -2px rgba(0, 0, 0, 0.08);
              }
              :is(.dark) .btn-gradient-border-pro {
                box-shadow: 0 4px 28px -4px rgba(16, 185, 129, 0.35), 0 2px 10px -2px rgba(0, 0, 0, 0.4);
              }
              .btn-gradient-border-pro::before {
                padding: 2px;
                background: conic-gradient(from var(--border-angle), #10b981 0%, #06b6d4 25%, #8b5cf6 50%, #ec4899 75%, #10b981 100%);
                animation: border-spin 2.5s linear infinite;
              }
              .btn-gradient-border-pro::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: inherit;
                background: conic-gradient(from var(--border-angle), transparent 0%, rgba(16,185,129,0.12) 25%, transparent 50%, rgba(6,182,212,0.12) 75%, transparent 100%);
                animation: border-spin 2.5s linear infinite;
                z-index: -1;
                filter: blur(12px);
              }
              .btn-gradient-border-pro:hover {
                transform: scale(1.04);
                box-shadow: 0 0 40px -8px rgba(16,185,129,0.4), 0 0 20px -4px rgba(6,182,212,0.3);
              }
              :is(.dark) .btn-gradient-border-pro:hover {
                box-shadow: 0 0 48px -8px rgba(16,185,129,0.5), 0 0 24px -4px rgba(6,182,212,0.4);
              }

              @media (prefers-reduced-motion: reduce) {
                .btn-gradient-border::before,
                .btn-gradient-border-pro::before,
                .btn-gradient-border-pro::after {
                  animation: none !important;
                }
              }
            `}</style>

            <div className="flex flex-wrap items-center justify-center gap-10 sm:gap-16 text-muted-foreground/50">
              <div>
                <div className="text-4xl sm:text-5xl font-black text-foreground">24/7</div>
                <div className="text-sm uppercase tracking-widest mt-2">Always online</div>
              </div>
              <div className="w-px h-12 bg-border/30 hidden sm:block" />
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
            <div className="rounded-3xl border border-border/30 bg-card/30 backdrop-blur-sm px-7 sm:px-10">
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
                className="rounded-2xl px-12 py-5 text-lg font-bold border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/70 hover:scale-[1.03] transition-all shadow-[0_0_30px_-8px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_-4px_rgba(16,185,129,0.45)] cursor-pointer disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-3"
              >
                {loadingPlan === 'pro' ? (
                  <>
                    <span className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Get Pro $19.99/mo
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mt-16 text-xs uppercase tracking-widest text-muted-foreground/40 font-medium">
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
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
