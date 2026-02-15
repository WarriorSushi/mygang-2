'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchJourneyState, persistUserJourney } from '@/lib/supabase/client-journey'
import { CHARACTERS } from '@/constants/characters'
import { useChatStore } from '@/stores/chat-store'

export default function PostAuthPage() {
    const router = useRouter()
    const {
        setUserId,
        setIsGuest,
        setUserName,
        setActiveGang
    } = useChatStore()

    useEffect(() => {
        let isCancelled = false
        const supabase = createClient()

        const resolveJourney = async () => {
            router.prefetch('/chat')
            router.prefetch('/onboarding')

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                if (!isCancelled) router.replace('/')
                return
            }

            const userId = user.id
            setUserId(userId)
            setIsGuest(false)

            const localState = useChatStore.getState()
            const localGangIds = localState.activeGang.map((c) => c.id)
            const localName = localState.userName

            const remote = await fetchJourneyState(supabase, userId)
            const remoteGangIds = remote.gangIds
            const hasRemoteGang = remoteGangIds.length === 4
            const hasLocalGang = localGangIds.length === 4

            if (remote.profile?.username) {
                setUserName(remote.profile.username)
            } else if (localName) {
                await persistUserJourney(supabase, userId, { username: localName })
            }

            if (hasRemoteGang) {
                const squad = CHARACTERS.filter((c) => remoteGangIds.includes(c.id))
                setActiveGang(squad)
                if (!isCancelled) router.replace('/chat')
                return
            }

            if (hasLocalGang) {
                await persistUserJourney(supabase, userId, {
                    gangIds: localGangIds,
                    onboardingCompleted: true
                })
                if (!isCancelled) router.replace('/chat')
                return
            }

            if (!isCancelled) router.replace('/onboarding')
        }

        resolveJourney()
        return () => {
            isCancelled = true
        }
    }, [router, setActiveGang, setIsGuest, setUserId, setUserName])

    return (
        <main className="min-h-dvh flex items-center justify-center bg-background text-foreground px-6">
            <div className="text-center space-y-4">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Syncing your journey...</h1>
                <p className="text-sm text-muted-foreground">Getting your gang, name, and settings ready.</p>
            </div>
        </main>
    )
}
