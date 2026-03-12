import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { CHARACTERS } from '@/constants/characters'

type AppSupabaseClient = SupabaseClient<Database>
type GangRow = Pick<Database['public']['Tables']['gangs']['Row'], 'id'>
type GangMemberRow = Pick<Database['public']['Tables']['gang_members']['Row'], 'character_id'>

const VALID_CHARACTER_IDS = new Set(CHARACTERS.map((character) => character.id))

export type SquadPersistenceErrorCode =
    | 'not_authenticated'
    | 'rate_limited'
    | 'tier_limit_exceeded'
    | 'invalid_squad_size'
    | 'duplicate_character_ids'
    | 'invalid_character_ids'
    | 'gang_upsert_failed'
    | 'gang_member_read_failed'
    | 'gang_member_upsert_failed'
    | 'gang_member_delete_failed'
    | 'profile_update_failed'

export class SquadPersistenceError extends Error {
    code: SquadPersistenceErrorCode
    details?: Record<string, unknown>

    constructor(code: SquadPersistenceErrorCode, message: string, details?: Record<string, unknown>) {
        super(message)
        this.name = 'SquadPersistenceError'
        this.code = code
        this.details = details
    }
}

function normalizeCharacterIds(characterIds: string[]) {
    const filtered = characterIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    const unique = [...new Set(filtered)]

    if (unique.length < 2 || unique.length > 6) {
        throw new SquadPersistenceError(
            'invalid_squad_size',
            'Squad selections must contain between 2 and 6 unique members.',
            { received: unique.length }
        )
    }

    if (unique.length !== filtered.length) {
        throw new SquadPersistenceError(
            'duplicate_character_ids',
            'Squad selections cannot contain duplicate members.',
            { received: filtered }
        )
    }

    const invalidCharacterIds = unique.filter((id) => !VALID_CHARACTER_IDS.has(id))
    if (invalidCharacterIds.length > 0) {
        throw new SquadPersistenceError(
            'invalid_character_ids',
            'Squad selections included unknown character IDs.',
            { invalidCharacterIds }
        )
    }

    return unique
}

export async function persistGangMembership(
    supabase: AppSupabaseClient,
    userId: string,
    characterIds: string[],
) {
    const normalizedIds = normalizeCharacterIds(characterIds)

    const { data: gang, error: gangError } = await supabase
        .from('gangs')
        .upsert({ user_id: userId }, { onConflict: 'user_id' })
        .select('id')
        .single<GangRow>()

    if (gangError || !gang?.id) {
        throw new SquadPersistenceError(
            'gang_upsert_failed',
            'Could not create or load the user gang.',
            { error: gangError?.message || 'Missing gang id after upsert' }
        )
    }

    const { data: existingMembers, error: existingMembersError } = await supabase
        .from('gang_members')
        .select('character_id')
        .eq('gang_id', gang.id)
        .returns<GangMemberRow[]>()

    if (existingMembersError) {
        throw new SquadPersistenceError(
            'gang_member_read_failed',
            'Could not load the existing squad members.',
            { error: existingMembersError.message, gangId: gang.id }
        )
    }

    const desiredMemberRows = normalizedIds.map((character_id) => ({
        gang_id: gang.id,
        character_id,
    }))

    const { error: upsertMembersError } = await supabase
        .from('gang_members')
        .upsert(desiredMemberRows, { onConflict: 'gang_id,character_id' })

    if (upsertMembersError) {
        throw new SquadPersistenceError(
            'gang_member_upsert_failed',
            'Could not save the selected squad members.',
            { error: upsertMembersError.message, gangId: gang.id }
        )
    }

    const existingIds = (existingMembers || [])
        .map((member) => member.character_id)
        .filter((id): id is string => typeof id === 'string')
    const staleIds = existingIds.filter((id) => !normalizedIds.includes(id))

    if (staleIds.length > 0) {
        const { error: deleteMembersError } = await supabase
            .from('gang_members')
            .delete()
            .eq('gang_id', gang.id)
            .in('character_id', staleIds)

        if (deleteMembersError) {
            throw new SquadPersistenceError(
                'gang_member_delete_failed',
                'Could not remove stale squad members.',
                { error: deleteMembersError.message, gangId: gang.id, staleIds }
            )
        }
    }

    return {
        gangId: gang.id,
        characterIds: normalizedIds,
    }
}
