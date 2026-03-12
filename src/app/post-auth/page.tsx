'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { addSquadTierMembers } from '@/app/auth/actions'
import { createClient } from '@/lib/supabase/client'
import { fetchJourneyState, persistUserJourney } from '@/lib/supabase/client-journey'
import { CHARACTERS } from '@/constants/characters'
import { useChatStore } from '@/stores/chat-store'
import { trackOperationalError, trackOperationalEvent } from '@/lib/operational-telemetry'

export default function PostAuthPage() {
    const router = useRouter()
    const setUserId = useChatStore((s) => s.setUserId)
    const setUserName = useChatStore((s) => s.setUserName)
    const setActiveGang = useChatStore((s) => s.setActiveGang)
    const [retryNonce, setRetryNonce] = useState(0)
    const [showRetryState, setShowRetryState] = useState(false)
    const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        let isCancelled = false
        const supabase = createClient()
        setShowRetryState(false)
        setLastErrorMessage(null)

        router.prefetch('/chat')
        router.prefetch('/onboarding')

        const resolveJourney = async (userId: string) => {
            setUserId(userId)

            const localState = useChatStore.getState()
            const localGangIds = localState.activeGang.map((c) => c.id)
            const localName = localState.userName

            const remote = await fetchJourneyState(supabase, userId)
            const remoteGangIds = remote.gangIds
            const remoteGangNeedsRepair = remote.gangSource === 'preferred_squad_fallback'
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
                if (remoteGangNeedsRepair) {
                    trackOperationalEvent('preferred_squad_fallback_used', {
                        user_id: userId,
                        source_path: 'post-auth',
                        outcome: 'detected',
                        gang_size: remoteGangIds.length,
                    })
                    try {
                        await persistUserJourney(supabase, userId, {
                            gangIds: remoteGangIds,
                            onboardingCompleted: true
                        })
                    } catch (error) {
                        console.error('Failed to repair fallback squad during post-auth:', error)
                        trackOperationalError('squad_write_failed', {
                            user_id: userId,
                            source_path: 'post-auth.fallback-repair',
                            squad_size: remoteGangIds.length,
                        }, error)
                    }
                    if (remote.profile?.subscription_tier === 'basic' || remote.profile?.subscription_tier === 'pro') {
                        try {
                            await addSquadTierMembers(remoteGangIds)
                        } catch (error) {
                            console.error('Failed to repair paid squad tier rows during post-auth:', error)
                            trackOperationalError('squad_tier_write_failed', {
                                user_id: userId,
                                source_path: 'post-auth.fallback-tier-repair',
                                squad_size: remoteGangIds.length,
                            }, error)
                        }
                    }
                }
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
                    trackOperationalError('squad_write_failed', {
                        user_id: userId,
                        source_path: 'post-auth.local-squad',
                        squad_size: localGangIds.length,
                    }, error)
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
                setLastErrorMessage(err instanceof Error ? err.message : 'Could not finish syncing your account state.')
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
                supabase.auth.getUser().then(({ data: { user } }) => {
                    if (user) {
                        trackOperationalEvent('post_auth_timeout_fallback', {
                            user_id: user.id,
                            source_path: 'post-auth',
                            outcome: 'retry_state',
                            error_code: 'timeout',
                            error_message: 'Post-auth resolution timed out.',
                        })
                    }
                }).catch(() => {})
                setShowRetryState(true)
            }
        }, 8000)

        return () => {
            isCancelled = true
            subscription.unsubscribe()
            clearTimeout(retryTimer)
            clearTimeout(timeout)
        }
    }, [retryNonce, router, setActiveGang, setUserId, setUserName])

    const [showSlowHint, setShowSlowHint] = useState(false)
    useEffect(() => {
        setShowSlowHint(false)
        const timer = setTimeout(() => setShowSlowHint(true), 4000)
        return () => clearTimeout(timer)
    }, [retryNonce])

    return (
        <main id="main-content" className="min-h-dvh flex items-center justify-center bg-background text-foreground px-6">
            <div className="text-center space-y-4">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Syncing your journey...</h1>
                <p className="text-sm text-muted-foreground">
                    {showRetryState ? 'We could not finish automatically, but you can retry safely.' : 'Getting your gang, name, and settings ready.'}
                </p>
                {showRetryState ? (
                    <div className="space-y-3 rounded-3xl border border-border/50 bg-card/70 px-5 py-4 backdrop-blur-xl">
                        <p className="text-sm text-foreground/85">
                            Your session is still open. Try syncing again, or reload this page if the callback finished in another tab.
                        </p>
                        {lastErrorMessage && (
                            <p className="text-xs text-muted-foreground/70">
                                Last error: {lastErrorMessage}
                            </p>
                        )}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setRetryNonce((value) => value + 1)}
                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
                            >
                                Try again
                            </button>
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-border/60 px-5 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:bg-muted/50"
                            >
                                Reload page
                            </button>
                        </div>
                    </div>
                ) : showSlowHint && (
                    <p className="text-xs text-muted-foreground/60 animate-in fade-in duration-500">
                        Taking longer than expected. We&apos;ll stay here and keep listening for your session.
                    </p>
                )}
            </div>
        </main>
    )
}
