'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageCircle, LogIn, Mail, Loader2, Sparkles } from 'lucide-react'
import { signInWithGoogle, signInWithOTP } from "@/app/auth/actions"

interface AuthWallProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function AuthWall({ isOpen, onClose, onSuccess }: AuthWallProps) {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isSent, setIsSent] = useState(false)

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return

        setIsLoading(true)
        try {
            await signInWithOTP(email)
            setIsSent(true)
        } catch (err) {
            console.error(err)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-background/60 backdrop-blur-3xl border-white/10 shadow-2xl p-0 overflow-hidden rounded-[2rem]">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary animate-gradient" />

                <div className="p-8">
                    <DialogHeader className="flex flex-col items-center gap-5 py-6">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                            <div className="relative w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
                                <MessageCircle size={40} />
                            </div>
                            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg">
                                <Sparkles size={16} />
                            </div>
                        </div>
                        <DialogTitle className="text-4xl font-black text-center tracking-tight leading-tight">
                            WAIT! DON&apos;T <br />LOSE THE FLOW.
                        </DialogTitle>
                        <DialogDescription className="text-center text-lg text-muted-foreground/80 leading-relaxed max-w-[300px]">
                            Save your squad and this conversation forever. Most people regret not joining earlier.
                        </DialogDescription>
                    </DialogHeader>

                    {!isSent ? (
                        <div className="grid gap-6 py-4">
                            <form action={signInWithGoogle}>
                                <Button
                                    type="submit"
                                    className="w-full h-16 rounded-2xl text-xl font-black bg-[#4285F4] hover:bg-[#4285F4]/90 text-white shadow-lg shadow-[#4285F4]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <div className="flex items-center gap-3">
                                        <LogIn className="h-6 w-6" />
                                        Continue with Google
                                    </div>
                                </Button>
                            </form>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-white/5"></span>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-transparent px-2 text-muted-foreground/40 font-bold tracking-widest">or use email</span>
                                </div>
                            </div>

                            <form onSubmit={handleEmailSubmit} className="space-y-3">
                                <Input
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-14 rounded-xl bg-white/5 border-white/10 text-lg focus-visible:ring-primary/50"
                                    required
                                />
                                <Button
                                    type="submit"
                                    variant="outline"
                                    disabled={isLoading}
                                    className="w-full h-14 rounded-xl text-lg font-bold border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-[0.98]"
                                >
                                    {isLoading ? (
                                        <Loader2 className="animate-spin h-5 w-5" />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-5 w-5" />
                                            Send Magic Link
                                        </div>
                                    )}
                                </Button>
                            </form>
                        </div>
                    ) : (
                        <div className="py-12 text-center animate-in zoom-in duration-500">
                            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary mx-auto mb-6">
                                <Mail size={40} />
                            </div>
                            <h3 className="text-2xl font-bold mb-2">Check your email!</h3>
                            <p className="text-muted-foreground">We sent a magic link to <span className="text-foreground font-semibold">{email}</span>.</p>
                            <Button variant="link" onClick={() => setIsSent(false)} className="mt-4 text-primary">
                                Try another email
                            </Button>
                        </div>
                    )}

                    <p className="text-center text-[10px] text-muted-foreground/40 mt-6 uppercase tracking-widest font-bold">
                        Secure auth by Supabase
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
