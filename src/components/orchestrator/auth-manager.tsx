'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chat-store'
import { getSavedGang, saveGang } from '@/app/auth/actions'
import { CHARACTERS } from '@/constants/characters'

export function AuthManager() {
    const {
        setUserId,
        setIsGuest,
        setActiveGang,
        activeGang,
        setUserName,
        setUserNickname,
        clearChat,
        setIsHydrated
    } = useChatStore()
    const supabase = createClient()
    const hadSessionRef = useRef(false)

    useEffect(() => {
        const syncSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                if (session?.user) {
                    setUserId(session.user.id)
                    setIsGuest(false)
                    hadSessionRef.current = true

                    const savedIds = await getSavedGang()
                    if (savedIds && savedIds.length > 0) {
                        const squad = CHARACTERS.filter(c => savedIds.includes(c.id))
                        setActiveGang(squad)
                    } else if (activeGang.length > 0) {
                        try {
                            await saveGang(activeGang.map((c) => c.id))
                        } catch (err) {
                            console.error('Error saving local gang:', err)
                        }
                    }

                    // Also sync username
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username')
                        .eq('id', session.user.id)
                        .single()

                    if (profile?.username) {
                        setUserName(profile.username)
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
                hadSessionRef.current = false
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [setUserId, setIsGuest, setActiveGang, activeGang.length, setUserName, setUserNickname, clearChat, setIsHydrated])

    return null
}
