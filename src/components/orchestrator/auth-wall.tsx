'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { signInOrSignUpWithPassword } from "@/app/auth/actions"
import { trackEvent } from '@/lib/analytics'

interface AuthWallProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function AuthWall({ isOpen, onClose, onSuccess }: AuthWallProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            trackEvent('auth_wall_shown', { metadata: { source: 'auth_wall' } })
        }
    }, [isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email || !password) return

        setIsLoading(true)
        setErrorMessage(null)
        try {
            if (password.length < 6) {
                setErrorMessage('Password must be at least 6 characters.')
                return
            }
            trackEvent('auth_wall_action', { metadata: { provider: 'password' } })
            const result = await signInOrSignUpWithPassword(email, password)
            if (result?.ok) {
                setEmail('')
                setPassword('')
                onSuccess()
                return
            }
            setErrorMessage(result?.error || 'Unable to sign in. Please try again.')
        } catch (err) {
            console.error(err)
            setErrorMessage('Unable to sign in. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent data-testid="auth-wall" className="sm:max-w-md bg-background/60 backdrop-blur-3xl border-white/10 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary animate-gradient" />

                <div className="p-8">
                    <DialogHeader className="flex flex-col items-center gap-5 py-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-[2.5rem] bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                                <Image src="/logo.png" alt="MyGang" width={72} height={72} className="object-contain" priority />
                            </div>
                        </div>
                        <DialogTitle className="text-2xl sm:text-4xl font-black text-center tracking-tight leading-tight">
                            Sign up / log in to continue
                        </DialogTitle>
                        <DialogDescription className="text-center text-base sm:text-lg text-muted-foreground/80 leading-relaxed max-w-[320px]">
                            Use email + password. We’ll sign you in or create your account automatically.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <Input
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-12 sm:h-14 rounded-xl bg-white/5 border-white/10 text-base sm:text-lg focus-visible:ring-primary/50"
                                required
                            />
                            <Input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 sm:h-14 rounded-xl bg-white/5 border-white/10 text-base sm:text-lg focus-visible:ring-primary/50"
                                required
                            />
                            {errorMessage && (
                                <div className="text-xs text-red-400">{errorMessage}</div>
                            )}
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={isLoading}
                                className="w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-bold border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.98]"
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin h-5 w-5" />
                                ) : (
                                    <span>Continue</span>
                                )}
                            </Button>
                        </form>
                        <p className="text-center text-[11px] text-muted-foreground/60">
                            Your session stays signed in on this device until you log out.
                        </p>
                    </div>

                    <p className="text-center text-[10px] text-muted-foreground/40 mt-6 uppercase tracking-widest font-bold">
                        Secure auth by Supabase
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
