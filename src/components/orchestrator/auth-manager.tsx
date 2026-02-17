'use client'

import { useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chat-store'
import { CHARACTERS } from '@/constants/characters'
import { useTheme } from 'next-themes'
import type { Session } from '@supabase/supabase-js'
import { fetchJourneyState, persistUserJourney } from '@/lib/supabase/client-journey'

export function AuthManager() {
    const {
        setUserId,
        setIsGuest,
        setActiveGang,
        setUserName,
        setUserNickname,
        clearChat,
        setIsHydrated,
        setChatMode,
        setLowCostMode,
        setChatWallpaper,
        setSquadConflict,
        setCustomCharacterNames
    } = useChatStore()
    const supabase = useMemo(() => createClient(), [])
    const hadSessionRef = useRef(false)
    const { setTheme } = useTheme()

    useEffect(() => {
        const clearAuthState = () => {
            setUserId(null)
            setIsGuest(true)
            setActiveGang([])
            clearChat()
            setUserName(null)
            setUserNickname(null)
            setSquadConflict(null)
            setLowCostMode(false)
            hadSessionRef.current = false
        }

        const syncSession = async (incomingSession?: Session | null) => {
            try {
                setIsHydrated(false)
                const session = incomingSession ?? (await supabase.auth.getSession()).data.session

                if (!session?.user) {
                    const { userId: localUserId } = useChatStore.getState()
                    if (localUserId || hadSessionRef.current) {
                        clearAuthState()
                    }
                    return
                }

                setUserId(session.user.id)
                setIsGuest(false)
                hadSessionRef.current = true

                const { activeGang: localGang, userName: localName } = useChatStore.getState()
                const remote = await fetchJourneyState(supabase, session.user.id)
                const savedIds = remote.gangIds
                const localIds = localGang.map((c) => c.id)
                const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id))
                const profile = remote.profile
                const remoteIds = savedIds.length >= 2 && savedIds.length <= 4 ? savedIds : null

                if (remoteIds && remoteIds.length >= 2) {
                    const squad = CHARACTERS.filter(c => remoteIds.includes(c.id))
                    if (!sameSet(localIds, remoteIds)) {
                        setActiveGang(squad)
                    } else if (localGang.length === 0) {
                        setActiveGang(squad)
                    }
                    setSquadConflict(null)
                } else if (localIds.length >= 2 && localIds.length <= 4) {
                    try {
                        await persistUserJourney(supabase, session.user.id, {
                            gangIds: localIds,
                            onboardingCompleted: true
                        })
                    } catch (err) {
                        console.error('Error saving local gang:', err)
                    }
                }

                if (profile?.username) {
                    setUserName(profile.username)
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

                if (profile?.chat_mode) {
                    setChatMode(profile.chat_mode)
                }
                if (typeof profile?.low_cost_mode === 'boolean') {
                    setLowCostMode(profile.low_cost_mode)
                }
                if (profile?.theme) {
                    const localTheme = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null
                    // Respect an explicit local user choice and avoid server-driven theme flip-flop.
                    if (!localTheme || localTheme === 'system') {
                        setTheme(profile.theme)
                    }
                }
                if (profile?.chat_wallpaper) {
                    setChatWallpaper(profile.chat_wallpaper)
                }
                if (profile?.custom_character_names && typeof profile.custom_character_names === 'object') {
                    setCustomCharacterNames(profile.custom_character_names)
                }
            } catch (err) {
                console.error('Auth sync error:', err)
            } finally {
                setIsHydrated(true)
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
    }, [clearChat, setActiveGang, setChatMode, setChatWallpaper, setCustomCharacterNames, setIsGuest, setIsHydrated, setLowCostMode, setSquadConflict, setTheme, setUserId, setUserName, setUserNickname, supabase])

    return null
}
