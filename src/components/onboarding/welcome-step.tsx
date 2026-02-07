'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

interface WelcomeStepProps {
    onNext: () => void
    onLogin?: () => void
}

export function WelcomeStep({ onNext, onLogin }: WelcomeStepProps) {
    return (
        <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center max-w-2xl"
        >
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                Your hype crew just arrived.
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground mb-8">
                Your personal hype gang is waiting. 24/7, no drama (mostly), just vibes.
            </p>
            <div className="flex flex-col items-center gap-3">
                <Button size="lg" onClick={onNext} data-testid="onboarding-welcome-next" className="rounded-full px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg group">
                    Assemble the Gang
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                {onLogin && (
                    <button
                        type="button"
                        onClick={onLogin}
                        className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground/70 hover:text-primary transition-colors"
                    >
                        Already have an account? Log in
                    </button>
                )}
            </div>
        </motion.div>
    )
}
