/**
 * Run: pnpm exec tsx tests/squad-persistence.test.ts
 */

import { persistGangMembership, SquadPersistenceError } from '@/lib/supabase/squad-persistence'

function assert(condition: boolean, label: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${label}`)
    }
    console.log(`PASS ${label}`)
}

function createMockSupabase(options?: {
    existingMembers?: string[]
    gangUpsertError?: string
    memberReadError?: string
    memberUpsertError?: string
    memberDeleteError?: string
}) {
    const upsertedRows: Array<{ gang_id: string; character_id: string }> = []
    const deletedIds: string[] = []
    const gangId = 'gang-1'
    let pendingDeleteIds: string[] = []

    return {
        upsertedRows,
        deletedIds,
        from(table: string) {
            if (table === 'gangs') {
                return {
                    upsert() {
                        return {
                            select() {
                                return {
                                    async single() {
                                        if (options?.gangUpsertError) {
                                            return { data: null, error: { message: options.gangUpsertError } }
                                        }
                                        return { data: { id: gangId }, error: null }
                                    },
                                }
                            },
                        }
                    },
                }
            }

            if (table === 'gang_members') {
                return {
                    select() {
                        return {
                            eq() {
                                return {
                                    async returns() {
                                        if (options?.memberReadError) {
                                            return { data: null, error: { message: options.memberReadError } }
                                        }
                                        return {
                                            data: (options?.existingMembers || []).map((character_id) => ({ character_id })),
                                            error: null,
                                        }
                                    },
                                }
                            },
                        }
                    },
                    async upsert(rows: Array<{ gang_id: string; character_id: string }>) {
                        if (options?.memberUpsertError) {
                            return { error: { message: options.memberUpsertError } }
                        }
                        upsertedRows.push(...rows)
                        return { error: null }
                    },
                    delete() {
                        return {
                            eq() {
                                return {
                                    async in(_column: string, ids: string[]) {
                                        pendingDeleteIds = ids
                                        if (options?.memberDeleteError) {
                                            return { error: { message: options.memberDeleteError } }
                                        }
                                        deletedIds.push(...pendingDeleteIds)
                                        return { error: null }
                                    },
                                }
                            },
                        }
                    },
                }
            }

            throw new Error(`Unexpected table: ${table}`)
        },
    }
}

async function run() {
    {
        const supabase = createMockSupabase({ memberUpsertError: 'boom' })
        let caught: unknown = null
        try {
            await persistGangMembership(supabase as never, 'user-1', ['kael', 'nyx'])
        } catch (error) {
            caught = error
        }

        assert(caught instanceof SquadPersistenceError, 'throws structured error on gang member upsert failure')
        assert((caught as SquadPersistenceError).code === 'gang_member_upsert_failed', 'returns gang_member_upsert_failed code')
    }

    {
        const supabase = createMockSupabase({ existingMembers: ['kael', 'rico'] })
        const result = await persistGangMembership(supabase as never, 'user-1', ['nyx', 'kael'])

        assert(result.gangId === 'gang-1', 'returns gang id')
        assert(JSON.stringify(result.characterIds) === JSON.stringify(['nyx', 'kael']), 'keeps requested squad ordering')
        assert(supabase.upsertedRows.length === 2, 'upserts desired members')
        assert(JSON.stringify(supabase.deletedIds) === JSON.stringify(['rico']), 'deletes stale members')
    }
}

run().catch((error) => {
    console.error(error)
    process.exit(1)
})
