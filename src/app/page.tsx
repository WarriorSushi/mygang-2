'use client'

import { BackgroundBlobs } from '@/components/holographic/background-blobs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Zap, MessageCircle } from 'lucide-react'
import { useChatStore } from '@/stores/chat-store'

export default function LandingPage() {
  const { userId, activeGang, isHydrated } = useChatStore()
  const hasSquad = activeGang.length > 0
  const ctaText = !isHydrated ? "Syncing..." : userId ? (hasSquad ? "Return to Gang" : "Pick Your Gang") : "Assemble Your Gang"
  const ctaLink = hasSquad ? "/chat" : "/onboarding"

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-background">
      <BackgroundBlobs />

      {/* Nav */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full z-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-bold flex items-center gap-2"
        >
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
            <MessageCircle size={22} />
          </div>
          <span className="tracking-tighter text-3xl">MyGang<span className="text-primary">.ai</span></span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          {userId && (
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              Logged In
            </span>
          )}
          <Link href={ctaLink}>
            <Button variant="ghost" className="rounded-full px-6 hover:bg-white/5 border border-transparent hover:border-white/10 transition-all">
              {userId ? "Dashboard" : "Launch App"}
            </Button>
          </Link>
        </motion.div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative">
        {/* Decorative elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 blur-[120px] rounded-full -z-10 animate-pulse" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-sm mb-10 backdrop-blur-md shadow-inner"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-white/90 font-medium">Meet your new digital entourage</span>
          </motion.div>

          <h1 className="text-8xl md:text-[10rem] font-black tracking-tighter mb-10 leading-[0.85] uppercase">
            YOUR <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-primary to-blue-600 animate-gradient">GANG</span><br />
            IS <span className="italic font-serif normal-case font-light text-muted-foreground/50">READY.</span>
          </h1>

          <p className="text-xl md:text-3xl text-muted-foreground/80 mb-14 max-w-2xl mx-auto leading-relaxed">
            The group chat that never sleeps. <span className="text-foreground font-semibold">8 personalities</span>, 1 user, infinite chaos.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-6 justify-center"
          >
            <Link href={ctaLink}>
              <Button size="xl" className="rounded-full px-16 py-10 text-2xl font-black group relative overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-primary/20">
                <span className="relative z-10 flex items-center gap-3">
                  {ctaText}
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-500" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-40 max-w-7xl w-full"
        >
          <FeatureCard
            icon={<Zap className="text-yellow-400 w-6 h-6" />}
            title="Instant Hype"
            desc="Need a win? Kael will blow up your notifications with purely positive vibes and elite validation."
          />
          <FeatureCard
            icon={<MessageCircle className="text-cyan-400 w-6 h-6" />}
            title="Banter Engine"
            desc="Detailed group personalities that talk to you and to each other. It's not a bot, it's an ensemble."
          />
          <FeatureCard
            icon={<Sparkles className="text-purple-400 w-6 h-6" />}
            title="Zero Friction"
            desc="No complex signups. Pick your friends and dive straight into the digital chaos in seconds."
          />
        </motion.div>
      </main>

      <footer className="p-12 text-center text-muted-foreground/40 text-sm border-t border-white/5 mt-20">
        © 2024 MyGang.ai — The premium AI group chat experience.
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-10 rounded-[2.5rem] bg-white/[0.03] border border-white/10 text-left hover:bg-white/[0.06] hover:border-white/20 transition-all duration-500 group backdrop-blur-sm">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 border border-white/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-inner">
        {icon}
      </div>
      <h3 className="text-3xl font-bold mb-5 tracking-tight">{title}</h3>
      <p className="text-muted-foreground/80 leading-relaxed text-lg">{desc}</p>
    </div>
  )
}
