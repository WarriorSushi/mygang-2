'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchJourneyState, persistUserJourney } from '@/lib/supabase/client-journey'
import { CHARACTERS } from '@/constants/characters'
import { useChatStore } from '@/stores/chat-store'

export default function PostAuthPage() {
    const router = useRouter()
    const setUserId = useChatStore((s) => s.setUserId)
    const setUserName = useChatStore((s) => s.setUserName)
    const setActiveGang = useChatStore((s) => s.setActiveGang)

    useEffect(() => {
        let isCancelled = false
        const supabase = createClient()

        router.prefetch('/chat')
        router.prefetch('/onboarding')

        const resolveJourney = async (userId: string) => {
            setUserId(userId)

            const localState = useChatStore.getState()
            const localGangIds = localState.activeGang.map((c) => c.id)
            const localName = localState.userName

            const remote = await fetchJourneyState(supabase, userId)
            const remoteGangIds = remote.gangIds
            const hasRemoteGang = remoteGangIds.length >= 2 && remoteGangIds.length <= 6
            const hasLocalGang = localGangIds.length >= 2 && localGangIds.length <= 6

            if (remote.profile?.username) {
                setUserName(remote.profile.username)
            } else if (localName) {
                try {
                    await persistUserJourney(supabase, userId, { username: localName })
                } catch (error) {
                    console.error('Failed to persist local username during post-auth:', error)
                }
            }

            if (hasRemoteGang) {
                const squad = CHARACTERS.filter((c) => remoteGangIds.includes(c.id))
                setActiveGang(squad)
                if (!isCancelled) router.replace('/chat')
                return
            }

            if (hasLocalGang) {
                try {
                    await persistUserJourney(supabase, userId, {
                        gangIds: localGangIds,
                        onboardingCompleted: true
                    })
                } catch (error) {
                    console.error('Failed to persist local squad during post-auth:', error)
                }
                if (!isCancelled) router.replace('/chat')
                return
            }

            if (!isCancelled) router.replace('/onboarding')
        }

        // Try getUser first, and also listen for auth state changes (OAuth sessions
        // may not be available immediately on the client after the callback redirect)
        let resolved = false

        const tryResolve = async (userId: string) => {
            if (resolved || isCancelled) return
            resolved = true
            try {
                await resolveJourney(userId)
            } catch (err) {
                console.error('Failed to resolve journey:', err)
                resolved = false
            }
        }

        const attemptGetUser = () => {
            supabase.auth.getUser().then(({ data: { user } }) => {
                if (user) {
                    tryResolve(user.id)
                }
            })
        }

        // Try immediately, then retry after a short delay in case cookies haven't propagated
        attemptGetUser()
        const retryTimer = setTimeout(() => {
            if (!resolved && !isCancelled) attemptGetUser()
        }, 1500)

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                tryResolve(session.user.id)
            }
        })

        // Fallback: if no session after 8 seconds, redirect to landing
        const timeout = setTimeout(() => {
            if (!resolved && !isCancelled) {
                router.replace('/')
            }
        }, 8000)

        return () => {
            isCancelled = true
            subscription.unsubscribe()
            clearTimeout(retryTimer)
            clearTimeout(timeout)
        }
    }, [router, setActiveGang, setUserId, setUserName])

    const [showSlowHint, setShowSlowHint] = useState(false)
    useEffect(() => {
        const timer = setTimeout(() => setShowSlowHint(true), 4000)
        return () => clearTimeout(timer)
    }, [])

    return (
        <main id="main-content" className="min-h-dvh flex items-center justify-center bg-background text-foreground px-6">
            <div className="text-center space-y-4">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Syncing your journey...</h1>
                <p className="text-sm text-muted-foreground">Getting your gang, name, and settings ready.</p>
                {showSlowHint && (
                    <p className="text-xs text-muted-foreground/60 animate-in fade-in duration-500">
                        Taking longer than expected. You&apos;ll be redirected shortly.
                    </p>
                )}
            </div>
        </main>
    )
}
