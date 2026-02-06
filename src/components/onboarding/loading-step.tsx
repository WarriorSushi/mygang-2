'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

const STATUS_MESSAGES = [
    "Waking up Rico...",
    "Nyx is loading her sarcasm module...",
    "Atlas is checking the parameter safety...",
    "Luna is aligning the vibes...",
    "Cleo is checking her makeup...",
    "Ezra is finding the right quote...",
    "Vee is calibrating the logic...",
    "Kael is prepping the lighting..."
]

export function LoadingStep() {
    const [status, setStatus] = useState(STATUS_MESSAGES[0])

    useEffect(() => {
        const interval = setInterval(() => {
            setStatus(current => {
                const currentIndex = STATUS_MESSAGES.indexOf(current)
                return STATUS_MESSAGES[(currentIndex + 1) % STATUS_MESSAGES.length]
            })
        }, 800)
        return () => clearInterval(interval)
    }, [])

    return (
        <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
        >
            <div className="relative w-24 h-24 mx-auto mb-10">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <Loader2 className="w-10 h-10 absolute inset-0 m-auto text-primary animate-pulse" />
            </div>

            <h2 className="text-4xl font-bold mb-6 tracking-tight">Summoning the gang...</h2>
            <div className="h-8 flex items-center justify-center">
                <p className="text-xl text-muted-foreground font-medium animate-pulse transition-all duration-300">
                    {status}
                </p>
            </div>
        </motion.div>
    )
}
