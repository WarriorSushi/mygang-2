'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface IdentityStepProps {
    name: string
    setName: (name: string) => void
    onNext: () => void
}

export function IdentityStep({ name, setName, onNext }: IdentityStepProps) {
    return (
        <motion.div
            key="identity"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full max-w-md"
        >
            <h2 className="text-3xl font-bold mb-6 text-center">What should they call you?</h2>
            <div className="space-y-4">
                <Input
                    placeholder="Your nickname..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-lg py-7 px-6 bg-white/5 border-white/10 rounded-2xl focus-visible:ring-primary/50"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && name.length > 1 && onNext()}
                />
                <Button
                    className="w-full py-7 rounded-2xl text-lg font-bold shadow-lg shadow-primary/10 transition-all active:scale-[0.98]"
                    disabled={name.length < 2}
                    onClick={onNext}
                >
                    Next
                </Button>
            </div>
        </motion.div>
    )
}
