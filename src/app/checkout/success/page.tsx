'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { useChatStore } from '@/stores/chat-store'

function SuccessContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [status, setStatus] = useState<'activating' | 'success' | 'error'>('activating')

    useEffect(() => {
        const subscriptionId = searchParams.get('subscription_id')
        const paymentStatus = searchParams.get('status')

        if (paymentStatus === 'succeeded' || subscriptionId) {
            // Activate subscription immediately via API
            fetch('/api/checkout/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription_id: subscriptionId }),
            })
                .then(async (res) => {
                    if (res.ok) {
                        const data = await res.json()
                        const plan = data.plan as 'basic' | 'pro' | undefined
                        if (plan) {
                            // Update store immediately so badge shows without refresh
                            useChatStore.getState().setSubscriptionTier(plan)
                            // Signal that a purchase just happened (for greeting)
                            if (typeof window !== 'undefined') {
                                window.sessionStorage.setItem('mygang_just_purchased', plan)
                            }
                        }
                    }
                    setStatus('success')
                    setTimeout(() => router.push('/chat'), 3000)
                })
                .catch(() => {
                    // Webhook will handle activation
                    setStatus('success')
                    setTimeout(() => router.push('/chat'), 3000)
                })
        } else {
            setStatus('error')
        }
    }, [searchParams, router])

    if (status === 'activating') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950">
                <div className="text-center space-y-4">
                    <div className="text-4xl animate-pulse">⚡</div>
                    <h1 className="text-2xl font-bold text-white">Activating your plan...</h1>
                    <p className="text-gray-400">Just a moment while we power up your gang</p>
                </div>
            </div>
        )
    }

    if (status === 'error') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950">
                <div className="text-center space-y-4">
                    <div className="text-4xl">😕</div>
                    <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
                    <p className="text-gray-400">If you were charged, your plan will activate automatically shortly.</p>
                    <button
                        onClick={() => router.push('/chat')}
                        className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
                    >
                        Back to Chat
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950">
            <div className="text-center space-y-4">
                <div className="text-6xl">🎉</div>
                <h1 className="text-3xl font-bold text-white">Your gang is HYPED!</h1>
                <p className="text-gray-400 text-lg">
                    Welcome to the crew. Unlimited vibes, unlocked.
                </p>
                <p className="text-gray-500 text-sm">Redirecting to chat in 3 seconds...</p>
                <button
                    onClick={() => router.push('/chat')}
                    className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
                >
                    Go to Chat
                </button>
            </div>
        </div>
    )
}

export default function CheckoutSuccessPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-purple-950/30 to-gray-950">
                <div className="text-4xl animate-pulse">⚡</div>
            </div>
        }>
            <SuccessContent />
        </Suspense>
    )
}
