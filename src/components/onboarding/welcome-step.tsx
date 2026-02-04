'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

interface WelcomeStepProps {
    onNext: () => void
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
    return (
        <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center max-w-2xl"
        >
            <h1 className="text-6xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                Stop texting into the void.
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
                Your personal hype squad is waiting. 24/7, no drama (mostly), just vibes.
            </p>
            <Button size="lg" onClick={onNext} className="rounded-full px-8 py-6 text-lg group">
                Assemble the Gang
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
        </motion.div>
    )
}
