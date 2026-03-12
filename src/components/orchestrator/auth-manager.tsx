'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chat-store'
import { CHARACTERS } from '@/constants/characters'
import { useTheme } from 'next-themes'
import type { Session } from '@supabase/supabase-js'
import { addSquadTierMembers } from '@/app/auth/actions'
import { fetchJourneyState, persistUserJourney } from '@/lib/supabase/client-journey'
import { getSquadLimit, getTierFromProfile, type SubscriptionTier } from '@/lib/billing'
import { CHARACTER_WELCOME_BACK_MESSAGES } from '@/constants/character-messages'
import { trackOperationalError, trackOperationalEvent } from '@/lib/operational-telemetry'

export function AuthManager() {
    const setUserId = useChatStore((s) => s.setUserId)
    const setActiveGang = useChatStore((s) => s.setActiveGang)
    const setUserName = useChatStore((s) => s.setUserName)
    const clearChat = useChatStore((s) => s.clearChat)
    const setIsHydrated = useChatStore((s) => s.setIsHydrated)
    const setSquadConflict = useChatStore((s) => s.setSquadConflict)
    const setPendingUpgrade = useChatStore((s) => s.setPendingUpgrade)
    const setPendingDowngrade = useChatStore((s) => s.setPendingDowngrade)
    const addMessage = useChatStore((s) => s.addMessage)
    const supabase = useMemo(() => createClient(), [])
    const hadSessionRef = useRef(false)
    const initialSyncDoneRef = useRef(false)
    const syncInFlightRef = useRef(false)
    const { setTheme } = useTheme()

    useEffect(() => {
        const clearAuthState = () => {
            useChatStore.setState({
                userId: null,
                activeGang: [],
                userName: null,
                userNickname: null,
                subscriptionTier: 'free',
                chatMode: 'gang_focus',
                lowCostMode: false,
                chatWallpaper: 'default',
                customCharacterNames: {},
                squadConflict: null,
                pendingUpgrade: null,
                pendingDowngrade: null,
                messagesRemaining: null,
                cooldownSeconds: null,
            })
            clearChat()
            // UF-I8: Clear draft so next user doesn't see previous user's unsent message
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem('mygang-chat-draft')
            }
            hadSessionRef.current = false
        }

        const syncProfileState = (profile: Awaited<ReturnType<typeof fetchJourneyState>>['profile']) => {
            if (!profile) return

            const nextTier = getTierFromProfile(profile.subscription_tier ?? null)
            // UF-I7: Force gang_focus if free tier (ecosystem is paid-only)
            const safeChatMode = nextTier === 'free' ? 'gang_focus' : (profile.chat_mode ?? undefined)
            useChatStore.setState((state) => ({
                ...state,
                subscriptionTier: nextTier,
                chatMode: safeChatMode ?? state.chatMode,
                lowCostMode: typeof profile.low_cost_mode === 'boolean' ? profile.low_cost_mode : state.lowCostMode,
                chatWallpaper: profile.chat_wallpaper ?? state.chatWallpaper,
                customCharacterNames: profile.custom_character_names && typeof profile.custom_character_names === 'object'
                    ? profile.custom_character_names
                    : state.customCharacterNames,
            }))
        }

        const syncSession = async (incomingSession?: Session | null) => {
            if (syncInFlightRef.current) return
            syncInFlightRef.current = true
            try {
                const previousUserId = useChatStore.getState().userId
                const incomingUserId = incomingSession?.user?.id ?? null
                const shouldBlockUntilProfileSync = (
                    !initialSyncDoneRef.current
                    || (incomingUserId !== null && incomingUserId !== previousUserId)
                    || (!incomingUserId && (hadSessionRef.current || !!previousUserId))
                )
                if (shouldBlockUntilProfileSync) {
                    setIsHydrated(false)
                }
                const session = incomingSession ?? (await supabase.auth.getSession()).data.session

                if (!session?.user) {
                    const { userId: localUserId } = useChatStore.getState()
                    if (localUserId || hadSessionRef.current) {
                        clearAuthState()
                    }
                    return
                }

                setUserId(session.user.id)
                hadSessionRef.current = true

                const { activeGang: localGang, userName: localName } = useChatStore.getState()
                const remote = await fetchJourneyState(supabase, session.user.id)
                const savedIds = remote.gangIds
                const remoteGangSource = remote.gangSource
                const localIds = localGang.map((c) => c.id)
                const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id))
                const profile = remote.profile
                syncProfileState(profile)

                const remoteTier = getTierFromProfile(profile?.subscription_tier ?? null)
                const maxSquad = getSquadLimit(remoteTier)
                const remoteIds = savedIds.length >= 2 && savedIds.length <= maxSquad ? savedIds : null
                const remoteGangNeedsRepair = remoteGangSource === 'preferred_squad_fallback' && !!remoteIds

                const hasLocalGang = localIds.length >= 2 && localIds.length <= maxSquad
                const hasRemoteGang = remoteIds && remoteIds.length >= 2
                const remoteSquad = hasRemoteGang ? CHARACTERS.filter(c => remoteIds!.includes(c.id)) : []
                const remoteName = profile?.username || null
                const gangsDiffer = hasLocalGang && hasRemoteGang && !sameSet(localIds, remoteIds!)
                const namesDiffer = !!localName && !!remoteName && localName !== remoteName

                if (gangsDiffer || namesDiffer) {
                    // Both sides have data and they differ — let user choose
                    setSquadConflict({
                        local: localGang,
                        remote: remoteSquad,
                        localName: namesDiffer ? localName : null,
                        remoteName: namesDiffer ? remoteName : null
                    })
                } else {
                    // No conflict — merge silently
                    setSquadConflict(null)

                    if (hasRemoteGang) {
                        if (localGang.length === 0 || !sameSet(localIds, remoteIds!)) {
                            setActiveGang(remoteSquad)
                        }
                        if (remoteGangNeedsRepair) {
                            trackOperationalEvent('preferred_squad_fallback_used', {
                                user_id: session.user.id,
                                source_path: 'auth-manager',
                                outcome: 'detected',
                                gang_size: remoteIds!.length,
                            })
                            try {
                                await persistUserJourney(supabase, session.user.id, {
                                    gangIds: remoteIds!,
                                    onboardingCompleted: true,
                                })
                            } catch (err) {
                                console.error('Error repairing fallback squad during auth sync:', err)
                                trackOperationalError('squad_write_failed', {
                                    user_id: session.user.id,
                                    source_path: 'auth-manager.fallback-repair',
                                    squad_size: remoteIds!.length,
                                }, err)
                            }
                            if (remoteTier !== 'free') {
                                try {
                                    await addSquadTierMembers(remoteIds!)
                                } catch (err) {
                                    console.error('Error repairing paid squad tier rows during auth sync:', err)
                                    trackOperationalError('squad_tier_write_failed', {
                                        user_id: session.user.id,
                                        source_path: 'auth-manager.fallback-tier-repair',
                                        squad_size: remoteIds!.length,
                                    }, err)
                                }
                            }
                        }
                    } else if (hasLocalGang) {
                        try {
                            await persistUserJourney(supabase, session.user.id, {
                                gangIds: localIds,
                                onboardingCompleted: true
                            })
                        } catch (err) {
                            console.error('Error saving local gang:', err)
                            trackOperationalError('squad_write_failed', {
                                user_id: session.user.id,
                                source_path: 'auth-manager.local-repair',
                                squad_size: localIds.length,
                            }, err)
                        }
                    }

                    if (remoteName) {
                        setUserName(remoteName)
                    } else if (localName) {
                        try {
                            await persistUserJourney(supabase, session.user.id, {
                                username: localName
                            })
                        } catch (err) {
                            console.error('Error saving username:', err)
                        }
                    } else {
                        const fallbackName = session.user.user_metadata?.full_name
                            || session.user.user_metadata?.name
                            || session.user.email?.split('@')[0]
                        if (fallbackName) {
                            setUserName(fallbackName)
                            try {
                                await persistUserJourney(supabase, session.user.id, {
                                    username: fallbackName
                                })
                            } catch (err) {
                                console.error('Error saving fallback username:', err)
                            }
                        }
                    }
                }

                if (profile?.theme) {
                    const localTheme = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null
                    // Respect an explicit local user choice and avoid server-driven theme flip-flop.
                    if (!localTheme || localTheme === 'system') {
                        setTheme(profile.theme)
                    }
                }
                if (profile?.subscription_tier) {
                    const previousTier = useChatStore.getState().subscriptionTier
                    const newTier = getTierFromProfile(profile.subscription_tier)

                    // Detect tier transitions for squad changes
                    if (initialSyncDoneRef.current && newTier !== previousTier) {
                        const oldLimit = getSquadLimit(previousTier as SubscriptionTier)
                        const newLimit = getSquadLimit(newTier)
                        const currentSquadSize = useChatStore.getState().activeGang.length

                        if (newLimit > oldLimit && currentSquadSize < newLimit && currentSquadSize >= 2) {
                            // UPGRADE — show picker for new slots
                            setPendingUpgrade({
                                newTier: newTier as 'basic' | 'pro',
                                newSlots: newLimit - currentSquadSize,
                            })
                        } else if (newLimit < oldLimit && currentSquadSize > newLimit) {
                            // DOWNGRADE — fetch auto-removable members and show keeper
                            let autoRemovableIds: string[] = []
                            try {
                                const { data: autoRemovable } = await supabase
                                    .from('squad_tier_members')
                                    .select('character_id')
                                    .eq('user_id', session.user.id)
                                    .eq('is_active', true)
                                    .order('created_at', { ascending: false })
                                    .limit(currentSquadSize - newLimit)
                                autoRemovableIds = autoRemovable?.map(r => r.character_id) ?? []
                            } catch (err) {
                                console.error('Failed to fetch auto-removable members:', err)
                            }

                            setPendingDowngrade({
                                newLimit,
                                autoRemovableIds,
                            })
                        }
                    }

                    // Handle pending downgrade flag from webhook
                    if (profile?.pending_squad_downgrade) {
                        const currentSquadSize = useChatStore.getState().activeGang.length
                        const newLimit = getSquadLimit(profile.subscription_tier as SubscriptionTier)
                        if (currentSquadSize > newLimit) {
                            let autoRemovableIds: string[] = []
                            try {
                                const { data: autoRemovable } = await supabase
                                    .from('squad_tier_members')
                                    .select('character_id')
                                    .eq('user_id', session.user.id)
                                    .eq('is_active', true)
                                    .order('created_at', { ascending: false })
                                    .limit(currentSquadSize - newLimit)
                                autoRemovableIds = autoRemovable?.map(r => r.character_id) ?? []
                            } catch (err) {
                                console.error('Failed to fetch auto-removable members:', err)
                            }

                            setPendingDowngrade({
                                newLimit,
                                autoRemovableIds,
                            })
                        }
                        // Clear the flag
                        await supabase.from('profiles').update({ pending_squad_downgrade: false }).eq('id', session.user.id)
                    }

                    // Handle restored members (welcome-back messages)
                    if (profile?.restored_members_pending?.length) {
                        for (const charId of profile.restored_members_pending) {
                            const msg = CHARACTER_WELCOME_BACK_MESSAGES[charId]
                            if (msg) {
                                addMessage({
                                    id: `wb-${charId}-${Date.now()}`,
                                    speaker: charId,
                                    content: msg,
                                    created_at: new Date().toISOString(),
                                })
                            }
                        }
                        // Clear the flag
                        await supabase.from('profiles').update({ restored_members_pending: [] }).eq('id', session.user.id)
                    }
                }
            } catch (err) {
                console.error('Auth sync error:', err)
            } finally {
                syncInFlightRef.current = false
                setIsHydrated(true)
                initialSyncDoneRef.current = true
            }
        }

        syncSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                syncSession(session)
                return
            }

            // Clear stale local auth state on sign out or missing session.
            const { userId: localUserId } = useChatStore.getState()
            if (event === 'SIGNED_OUT' || hadSessionRef.current || !!localUserId) {
                clearAuthState()
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [addMessage, clearChat, setActiveGang, setIsHydrated, setPendingDowngrade, setPendingUpgrade, setSquadConflict, setTheme, setUserId, setUserName, supabase])

    return null
}
