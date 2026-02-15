import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

let adminClient: SupabaseClient<Database> | null = null

export function createAdminClient() {
    if (adminClient) return adminClient

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    adminClient = createClient<Database>(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    })
    return adminClient
}
