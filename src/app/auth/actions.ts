'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

async function getOrigin() {
    const headerBag = await headers()
    return (headerBag.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'https://mygang.ai').replace(/\/$/, '')
}

export async function signInWithGoogle() {
    const supabase = await createClient()
    const origin = await getOrigin()

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${origin}/auth/callback`,
        },
    })

    if (error) {
        console.error('Auth error:', error.message)
        return redirect('/error')
    }

    if (data.url) {
        redirect(data.url)
    }
}

export async function signInOrSignUpWithPassword(email: string, password: string) {
    const supabase = await createClient()
    const origin = await getOrigin()

    const signInAttempt = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (!signInAttempt.error) {
        return { ok: true, action: 'signed_in' as const }
    }

    const signInMessage = signInAttempt.error.message?.toLowerCase() || ''
    const shouldTrySignUp = signInMessage.includes('invalid login') || signInMessage.includes('invalid') || signInMessage.includes('credentials')
    if (!shouldTrySignUp) {
        return { ok: false, error: signInAttempt.error.message }
    }

    const signUpAttempt = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${origin}/auth/callback`,
        },
    })

    if (signUpAttempt.error) {
        const message = signUpAttempt.error.message || 'Unable to sign in or sign up.'
        const normalized = message.toLowerCase()
        if (normalized.includes('already registered') || normalized.includes('already exists')) {
            return { ok: false, error: 'Incorrect password. Please try again.' }
        }
        return { ok: false, error: message }
    }

    if (signUpAttempt.data?.session) {
        return { ok: true, action: 'signed_up' as const }
    }

    const retrySignIn = await supabase.auth.signInWithPassword({ email, password })
    if (!retrySignIn.error) {
        return { ok: true, action: 'signed_in' as const }
    }

    return { ok: false, error: 'Check your email to confirm your account, then log in.' }
}

export async function signOut() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/')
}

export async function deleteAccount() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
        console.error('Delete account error:', error)
        throw error
    }

    await supabase.auth.signOut()
    redirect('/')
}

export async function saveGang(characterIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // 1. Ensure a gang exists for the user
    const { data: gang, error: gangError } = await supabase
        .from('gangs')
        .upsert({ user_id: user.id }, { onConflict: 'user_id' })
        .select()
        .single()

    if (gangError) {
        console.error('Error upserting gang:', gangError)
        return
    }

    // 2. Clear old members and insert new ones
    await supabase.from('gang_members').delete().eq('gang_id', gang.id)

    const members = characterIds.map(id => ({
        gang_id: gang.id,
        character_id: id
    }))

    const { error: memberError } = await supabase.from('gang_members').insert(members)
    if (memberError) console.error('Error inserting gang:', memberError)

    const { error: settingsError } = await supabase
        .from('profiles')
        .update({ preferred_squad: characterIds, onboarding_completed: true })
        .eq('id', user.id)
    if (settingsError) console.error('Error updating preferred gang:', settingsError)
}

export async function getSavedGang() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const { data, error } = await supabase
        .from('gang_members')
        .select(`
            character_id,
            gangs!inner(user_id)
        `)
        .eq('gangs.user_id', user.id)

    if (error) {
        console.error('Error fetching gang:', error)
        return null
    }

    return data
        .map((m) => m.character_id)
        .filter((id): id is string => typeof id === 'string')
}

export async function saveUsername(username: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    const { error } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', user.id)

    if (error) console.error('Error saving username:', error)
}

export async function getMemories() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('memories')
        .select('id, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching memories:', error)
        return []
    }

    return data
}

export async function deleteMemory(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
        .from('memories')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) console.error('Error deleting memory:', error)
}

export async function updateMemory(id: string, content: string) {
    const { generateEmbedding } = await import('@/lib/ai/memory')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let embedding: number[] = []
    try {
        embedding = await generateEmbedding(content)
    } catch (err) {
        console.error('Error generating embedding:', err)
        return
    }

    const { error } = await supabase
        .from('memories')
        .update({ content, embedding })
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) console.error('Error updating memory:', error)
}

export async function getUserSettings() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
        .from('profiles')
        .select('theme, chat_mode, preferred_squad, chat_wallpaper')
        .eq('id', user.id)
        .single()

    if (error) {
        console.error('Error fetching user settings:', error)
        return null
    }

    return data
}

export async function updateUserSettings(settings: { theme?: string; chat_mode?: string; preferred_squad?: string[]; chat_wallpaper?: string }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
        .from('profiles')
        .update(settings)
        .eq('id', user.id)

    if (error) console.error('Error updating user settings:', error)
}

export async function saveMemoryManual(content: string) {
    const { storeMemory } = await import('@/lib/ai/memory')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await storeMemory(user.id, content, {
        kind: 'episodic',
        tags: [],
        importance: 2,
        useEmbedding: false
    })
}
