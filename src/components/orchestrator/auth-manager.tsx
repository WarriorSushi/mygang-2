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
        activeGang,
        setUserName,
        setUserNickname,
        clearChat,
        setIsHydrated,
        setChatMode,
        setChatWallpaper,
        setSquadConflict,
        userName
    } = useChatStore()
    const supabase = createClient()
    const hadSessionRef = useRef(false)
    const { setTheme } = useTheme()

    useEffect(() => {
        const syncSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                if (session?.user) {
                    setUserId(session.user.id)
                    setIsGuest(false)
                    hadSessionRef.current = true

                    const savedIds = await getSavedGang()
                    const localIds = activeGang.map((c) => c.id)
                    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((id) => b.includes(id))

                    if (savedIds && savedIds.length === 4) {
                        const squad = CHARACTERS.filter(c => savedIds.includes(c.id))
                        if (activeGang.length === 0) {
                            setActiveGang(squad)
                        } else if (!sameSet(localIds, savedIds)) {
                            setSquadConflict({ local: activeGang, remote: squad })
                        }
                    } else if (activeGang.length > 0) {
                        try {
                            await saveGang(activeGang.map((c) => c.id))
                        } catch (err) {
                            console.error('Error saving local gang:', err)
                        }
                    }

                    // Also sync username and settings
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username, chat_mode, theme, chat_wallpaper')
                        .eq('id', session.user.id)
                        .single()

                    if (profile?.username) {
                        setUserName(profile.username)
                    } else if (userName) {
                        try {
                            await saveUsername(userName)
                        } catch (err) {
                            console.error('Error saving username:', err)
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
                setUserId(session.user.id)
                setIsGuest(false)
                hadSessionRef.current = true
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
    }, [setUserId, setIsGuest, setActiveGang, activeGang, setUserName, setUserNickname, clearChat, setIsHydrated, setChatMode, setChatWallpaper, setSquadConflict, setTheme, userName])

    return null
}
