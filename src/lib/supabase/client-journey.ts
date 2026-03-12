'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatWallpaper } from '@/constants/wallpapers'
import type { Database } from '@/lib/database.types'
import { persistGangMembership, SquadPersistenceError } from '@/lib/supabase/squad-persistence'

export type JourneyProfile = {
    username: string | null
    chat_mode: 'gang_focus' | 'ecosystem' | null
    low_cost_mode: boolean | null
    theme: 'light' | 'dark' | 'system' | null
    chat_wallpaper: ChatWallpaper | null
    preferred_squad: string[] | null
    onboarding_completed: boolean | null
    custom_character_names: Record<string, string> | null
    subscription_tier: 'free' | 'basic' | 'pro' | null
    pending_squad_downgrade: boolean | null
    restored_members_pending: string[] | null
    vibe_profile: Record<string, string> | null
}

type GangRow = { id: string }
type GangMemberRow = { character_id: string | null }

export async function fetchJourneyState(supabase: SupabaseClient, userId: string) {
    // I15: Parallelize profile and gang queries
    const [profileResult, gangResult] = await Promise.all([
        supabase
            .from('profiles')
            .select('username, chat_mode, low_cost_mode, theme, chat_wallpaper, preferred_squad, onboarding_completed, custom_character_names, subscription_tier, pending_squad_downgrade, restored_members_pending, vibe_profile')
            .eq('id', userId)
            .single<JourneyProfile>(),
        supabase
            .from('gangs')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle<GangRow>(),
    ])

    const profile = profileResult.data
    let gangIds: string[] = []

    if (gangResult.data?.id) {
        const { data: members } = await supabase
            .from('gang_members')
            .select('character_id')
            .eq('gang_id', gangResult.data.id)
            .returns<GangMemberRow[]>()
        gangIds = (members || [])
            .map((m) => m.character_id)
            .filter((id): id is string => typeof id === 'string')
    }

    if (gangIds.length < 2 && Array.isArray(profile?.preferred_squad) && profile.preferred_squad.length >= 2 && profile.preferred_squad.length <= 6) {
        gangIds = profile.preferred_squad
    }

    return {
        profile: profile || null,
        gangIds: gangIds.slice(0, 6)
    }
}

export async function persistUserJourney(
    supabase: SupabaseClient<Database>,
    userId: string,
    payload: {
        username?: string
        gangIds?: string[]
        onboardingCompleted?: boolean
        customCharacterNames?: Record<string, string>
        vibeProfile?: Record<string, string>
    }
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileUpdate: Record<string, any> = {}
    let persistedGangIds: string[] | null = null

    if (typeof payload.username === 'string' && payload.username.trim()) {
        profileUpdate.username = payload.username.trim()
    }
    if (payload.customCharacterNames) {
        profileUpdate.custom_character_names = payload.customCharacterNames
    }
    if (payload.vibeProfile) {
        profileUpdate.vibe_profile = payload.vibeProfile
    }

    if (payload.gangIds) {
        const persistedGang = await persistGangMembership(
            supabase,
            userId,
            payload.gangIds
        )
        persistedGangIds = persistedGang.characterIds
        profileUpdate.preferred_squad = persistedGang.characterIds
        if (typeof payload.onboardingCompleted === 'boolean') {
            profileUpdate.onboarding_completed = payload.onboardingCompleted
        }
    } else if (typeof payload.onboardingCompleted === 'boolean') {
        profileUpdate.onboarding_completed = payload.onboardingCompleted
    }

    if (Object.keys(profileUpdate).length > 0) {
        const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', userId)

        if (profileUpdateError) {
            throw new SquadPersistenceError(
                'profile_update_failed',
                'Could not update the cloud journey state.',
                { error: profileUpdateError.message, userId }
            )
        }
    }

    return {
        ok: true as const,
        profileUpdated: Object.keys(profileUpdate).length > 0,
        gangIds: persistedGangIds,
    }
}
