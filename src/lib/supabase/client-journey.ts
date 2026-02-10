'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChatWallpaper } from '@/constants/wallpapers'

export type JourneyProfile = {
    username: string | null
    chat_mode: 'entourage' | 'ecosystem' | null
    low_cost_mode: boolean | null
    theme: 'light' | 'dark' | 'system' | null
    chat_wallpaper: ChatWallpaper | null
    preferred_squad: string[] | null
    onboarding_completed: boolean | null
}

type GangRow = { id: string }
type GangMemberRow = { character_id: string | null }

export async function fetchJourneyState(supabase: SupabaseClient, userId: string) {
    const { data: profile } = await supabase
        .from('profiles')
        .select('username, chat_mode, low_cost_mode, theme, chat_wallpaper, preferred_squad, onboarding_completed')
        .eq('id', userId)
        .single<JourneyProfile>()

    let gangIds: string[] = []
    const { data: gang } = await supabase
        .from('gangs')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle<GangRow>()

    if (gang?.id) {
        const { data: members } = await supabase
            .from('gang_members')
            .select('character_id')
            .eq('gang_id', gang.id)
            .returns<GangMemberRow[]>()
        gangIds = (members || [])
            .map((m) => m.character_id)
            .filter((id): id is string => typeof id === 'string')
    }

    if (gangIds.length !== 4 && Array.isArray(profile?.preferred_squad) && profile.preferred_squad.length === 4) {
        gangIds = profile.preferred_squad
    }

    return {
        profile: profile || null,
        gangIds: gangIds.slice(0, 4)
    }
}

export async function persistUserJourney(
    supabase: SupabaseClient,
    userId: string,
    payload: {
        username?: string
        gangIds?: string[]
        onboardingCompleted?: boolean
    }
) {
    const profileUpdate: {
        username?: string
        preferred_squad?: string[]
        onboarding_completed?: boolean
    } = {}

    if (typeof payload.username === 'string' && payload.username.trim()) {
        profileUpdate.username = payload.username.trim()
    }
    if (typeof payload.onboardingCompleted === 'boolean') {
        profileUpdate.onboarding_completed = payload.onboardingCompleted
    }
    if (payload.gangIds && payload.gangIds.length === 4) {
        profileUpdate.preferred_squad = payload.gangIds
    }

    if (Object.keys(profileUpdate).length > 0) {
        await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', userId)
    }

    if (payload.gangIds && payload.gangIds.length === 4) {
        const { data: gang } = await supabase
            .from('gangs')
            .upsert({ user_id: userId }, { onConflict: 'user_id' })
            .select('id')
            .single<GangRow>()

        if (!gang?.id) return

        await supabase.from('gang_members').delete().eq('gang_id', gang.id)
        const members = payload.gangIds.map((character_id) => ({ gang_id: gang.id, character_id }))
        await supabase.from('gang_members').insert(members)
    }
}
