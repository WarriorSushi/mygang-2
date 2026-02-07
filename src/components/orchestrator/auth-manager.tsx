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
        setChatWallpaper,
        setSquadConflict
    } = useChatStore()
    const supabase = useMemo(() => createClient(), [])
    const hadSessionRef = useRef(false)
    const { setTheme } = useTheme()

    useEffect(() => {
        const syncSession = async (incomingSession?: Session | null) => {
            try {
                setIsHydrated(false)
                const session = incomingSession ?? (await supabase.auth.getSession()).data.session

                if (session?.user) {
                    setUserId(session.user.id)
                    setIsGuest(false)
                    hadSessionRef.current = true

                    const { activeGang: localGang, userName: localName } = useChatStore.getState()
                    const remote = await fetchJourneyState(supabase, session.user.id)
                    const savedIds = remote.gangIds
                    const localIds = localGang.map((c) => c.id)
                    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id))
                    const profile = remote.profile
                    const remoteIds = savedIds.length === 4 ? savedIds : null

                    if (remoteIds && remoteIds.length === 4) {
                        const squad = CHARACTERS.filter(c => remoteIds.includes(c.id))
                        if (!sameSet(localIds, remoteIds)) {
                            setActiveGang(squad)
                        } else if (localGang.length === 0) {
                            setActiveGang(squad)
                        }
                        setSquadConflict(null)
                    } else if (localIds.length === 4) {
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
                    if (profile?.theme) {
                        setTheme(profile.theme)
                    }
                    if (profile?.chat_wallpaper) {
                        setChatWallpaper(profile.chat_wallpaper)
                    }
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

            // Only clear state on explicit sign-out or after a real session existed.
            if (event === 'SIGNED_OUT' || hadSessionRef.current) {
                setUserId(null)
                setIsGuest(true)
                setActiveGang([]) // Clear on logout
                clearChat()
                setUserName(null)
                setUserNickname(null)
                setSquadConflict(null)
                hadSessionRef.current = false
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [clearChat, setActiveGang, setChatMode, setChatWallpaper, setIsGuest, setIsHydrated, setSquadConflict, setTheme, setUserId, setUserName, setUserNickname, supabase])

    return null
}
