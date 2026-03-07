'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { useChatStore } from '@/stores/chat-store'

type ActivationResponse = {
    state: 'activated' | 'pending' | 'invalid'
    plan?: 'basic' | 'pro'
    subscriptionStatus?: string | null
    reason?: string
}

async function checkProfileTier(expectedPlan: 'basic' | 'pro') {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .single()

    return data?.subscription_tier === expectedPlan
}

function SuccessContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [status, setStatus] = useState<'activating' | 'pending' | 'success' | 'error'>('activating')
    const [resolvedPlan, setResolvedPlan] = useState<'basic' | 'pro' | null>(null)
    const [statusHint, setStatusHint] = useState('Just a moment while we power up your gang')

    useEffect(() => {
        const subscriptionId = searchParams.get('subscription_id')
        const expectedPlan = searchParams.get('plan')
        const normalizedPlan = expectedPlan === 'pro' || expectedPlan === 'basic'
            ? expectedPlan
            : null

        const finalizeActivation = (plan: 'basic' | 'pro') => {
            setResolvedPlan(plan)
            useChatStore.getState().setSubscriptionTier(plan)
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('mygang_just_purchased', plan)
            }
            setStatus('success')
            setTimeout(() => router.push('/chat'), 3000)
        }

        const pollActivation = async () => {
            const startedAt = Date.now()
            const timeoutMs = 45_000

            if (!subscriptionId && !normalizedPlan) {
                setStatus('error')
                setStatusHint('We could not confirm your upgrade yet.')
                return
            }

            while (Date.now() - startedAt < timeoutMs) {
                try {
                    if (subscriptionId) {
                        const res = await fetch('/api/checkout/activate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ subscription_id: subscriptionId }),
                        })
                        const data = await res.json().catch(() => null) as ActivationResponse | null
                        if (res.ok && data?.state === 'activated' && data.plan) {
                            finalizeActivation(data.plan)
                            return
                        }
                        if (data?.state === 'invalid') {
                            setStatus('error')
                            setStatusHint('We could not verify your plan yet.')
                            return
                        }
                        setStatus('pending')
                        setResolvedPlan(data?.plan ?? normalizedPlan)
                        setStatusHint('Payment received. Waiting for your plan to finish activating.')
                    } else if (normalizedPlan) {
                        if (await checkProfileTier(normalizedPlan)) {
                            finalizeActivation(normalizedPlan)
                            return
                        }
                        setStatus('pending')
                        setResolvedPlan(normalizedPlan)
                        setStatusHint('Payment received. Waiting for your plan to finish activating.')
                    }
                } catch {
                    setStatus('pending')
                    setResolvedPlan(normalizedPlan)
                    setStatusHint('Payment received. Waiting for your plan to finish activating.')
                }

                await new Promise((resolve) => setTimeout(resolve, 2500))
            }

            setStatus('error')
            setStatusHint('Your payment was received, but activation is still processing.')
        }

        if (subscriptionId || normalizedPlan) {
            pollActivation().catch(() => {
                setStatus('error')
                setStatusHint('Your payment was received, but activation is still processing.')
            })
        } else {
            setStatus('error')
        }
    }, [searchParams, router])

    if (status === 'activating') {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                <div className="text-center space-y-4">
                    <div className="text-4xl animate-pulse">⚡</div>
                    <h1 className="text-2xl font-bold text-foreground">Activating your plan...</h1>
                    <p className="text-muted-foreground">{statusHint}</p>
                </div>
            </div>
        )
    }

    if (status === 'pending') {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                <div className="text-center space-y-4 max-w-md px-6">
                    <div className="text-4xl animate-pulse">⏳</div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Finishing your {resolvedPlan ? resolvedPlan.toUpperCase() : 'new'} upgrade...
                    </h1>
                    <p className="text-muted-foreground">{statusHint}</p>
                    <p className="text-xs text-muted-foreground/70">We’ll send you into chat as soon as your plan is confirmed.</p>
                </div>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                <div className="text-center space-y-4 max-w-md px-6">
                    <div className="text-4xl">😕</div>
                    <h1 className="text-2xl font-bold text-foreground">We&apos;re still checking your upgrade</h1>
                    <p className="text-muted-foreground">{statusHint}</p>
                    <button
                        onClick={() => router.push('/chat')}
                        className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Go to Chat
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-background pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
            <div className="text-center space-y-4">
                <div className="text-6xl">🎉</div>
                <h1 className="text-3xl font-bold text-foreground">Your gang is HYPED!</h1>
                <p className="text-muted-foreground text-lg">
                    {resolvedPlan === 'pro'
                        ? 'Welcome to Pro. Unlimited vibes, unlocked.'
                        : 'Welcome to Basic. Your gang can finally keep up with you.'}
                </p>
                <p className="text-muted-foreground/70 text-sm">Redirecting to chat in 3 seconds...</p>
                <button
                    onClick={() => router.push('/chat')}
                    className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    Go to Chat
                </button>
            </div>
        </div>
    )
}

export default function CheckoutSuccessPage() {
    return (
        <main id="main-content">
            <Suspense fallback={
                <div className="flex min-h-dvh items-center justify-center bg-background pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                    <div className="text-4xl animate-pulse">⚡</div>
                </div>
            }>
                <SuccessContent />
            </Suspense>
        </main>
    )
}
