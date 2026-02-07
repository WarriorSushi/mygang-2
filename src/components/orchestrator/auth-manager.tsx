'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chat-store'
import { getSavedGang, saveGang, saveUsername } from '@/app/auth/actions'
import { CHARACTERS } from '@/constants/characters'
import { useTheme } from 'next-themes'

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
    const supabase = createClient()
    const hadSessionRef = useRef(false)
    const { setTheme } = useTheme()

    useEffect(() => {
        const syncSession = async (incomingSession?: any) => {
            try {
                setIsHydrated(false)
                const session = incomingSession ?? (await supabase.auth.getSession()).data.session

                if (session?.user) {
                    setUserId(session.user.id)
                    setIsGuest(false)
                    hadSessionRef.current = true

                    const { activeGang: localGang, userName: localName } = useChatStore.getState()
                    const savedIds = await getSavedGang()
                    const localIds = localGang.map((c) => c.id)
                    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id))

                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username, chat_mode, theme, chat_wallpaper, preferred_squad')
                        .eq('id', session.user.id)
                        .single()

                    const preferredSquad = Array.isArray(profile?.preferred_squad) ? profile?.preferred_squad : null
                    const remoteIds = savedIds && savedIds.length === 4
                        ? savedIds
                        : (preferredSquad && preferredSquad.length === 4 ? preferredSquad : null)

                    if (remoteIds && remoteIds.length === 4) {
                        const squad = CHARACTERS.filter(c => remoteIds.includes(c.id))
                        if (!sameSet(localIds, remoteIds)) {
                            setActiveGang(squad)
                        } else if (localGang.length === 0) {
                            setActiveGang(squad)
                        }
                        setSquadConflict(null)
                        if (!savedIds?.length && preferredSquad?.length === 4) {
                            try {
                                await saveGang(preferredSquad)
                            } catch (err) {
                                console.error('Error restoring preferred gang:', err)
                            }
                        }
                    } else if (localIds.length === 4) {
                        try {
                            await saveGang(localIds)
                        } catch (err) {
                            console.error('Error saving local gang:', err)
                        }
                    }

                    if (profile?.username) {
                        setUserName(profile.username)
                    } else if (localName) {
                        try {
                            await saveUsername(localName)
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
                                await saveUsername(fallbackName)
                            } catch (err) {
                                console.error('Error saving fallback username:', err)
                            }
                        }
                    }
                    if (profile?.chat_mode) {
                        setChatMode(profile.chat_mode as any)
                    }
                    if (profile?.theme) {
                        setTheme(profile.theme)
                    }
                    if (profile?.chat_wallpaper) {
                        setChatWallpaper(profile.chat_wallpaper as any)
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
    }, [setUserId, setIsGuest, setActiveGang, setUserName, setUserNickname, clearChat, setIsHydrated, setChatMode, setChatWallpaper, setSquadConflict, setTheme])

    return null
}
