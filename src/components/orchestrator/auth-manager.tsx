'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useChatStore } from '@/stores/chat-store'
import { getSavedGang } from '@/app/auth/actions'
import { CHARACTERS } from '@/constants/characters'

export function AuthManager() {
    const { setUserId, setIsGuest, setActiveGang, activeGang, setUserName } = useChatStore()
    const supabase = createClient()

    useEffect(() => {
        const syncSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (session?.user) {
                setUserId(session.user.id)
                setIsGuest(false)

                if (activeGang.length === 0) {
                    const savedIds = await getSavedGang()
                    if (savedIds && savedIds.length > 0) {
                        const squad = CHARACTERS.filter(c => savedIds.includes(c.id))
                        setActiveGang(squad)
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
            }

            useChatStore.getState().setIsHydrated(true)
        }

        syncSession()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                setUserId(session.user.id)
                setIsGuest(false)
            } else {
                setUserId(null)
                setIsGuest(true)
                setActiveGang([]) // Clear on logout
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [setUserId, setIsGuest, setActiveGang, activeGang.length])

    return null
}
