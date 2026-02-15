'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getAdminConfigMode, getConfiguredAdminEmail, verifyAdminCredentials } from '@/lib/admin/auth'
import { clearAdminSession, requireAdminSession, setAdminSession } from '@/lib/admin/session'
import { assertTrustedAdminRequest, getAdminRequestMeta } from '@/lib/admin/request-guard'
import {
    applyFailedLoginDelay,
    clearAdminLoginAttempts,
    getLockoutRemainingSeconds,
    recordFailedAdminLoginAttempt,
} from '@/lib/admin/login-security'
import { createAdminClient } from '@/lib/supabase/admin'

function buildLoginAttemptKey(email: string, ip: string) {
    return `admin-login:${email.trim().toLowerCase()}:${ip}`
}

function buildIpAttemptKey(ip: string) {
    return `admin-login-ip:${ip}`
}

function parseReturnTo(formData: FormData, fallback: '/admin/overview' | '/admin/users') {
    const raw = String(formData.get('returnTo') || fallback)
    if (raw === '/admin/overview' || raw === '/admin/users') return raw
    return fallback
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function sanitizeTier(value: string): 'free' | 'pro' | null {
    if (value === 'free' || value === 'pro') return value
    return null
}

async function insertAdminAudit(
    action: string,
    actorEmail: string,
    details: Record<string, string | number | boolean | null>,
    admin = createAdminClient()
) {
    const { error } = await admin
        .from('admin_audit_log')
        .insert({
            actor_email: actorEmail,
            action,
            details,
        })
    if (error) {
        console.error('Admin audit insert failed:', error)
    }
}

export async function adminSignIn(formData: FormData) {
    const trustedRequest = await assertTrustedAdminRequest()
    if (!trustedRequest) {
        redirect('/admin/login?error=origin')
    }

    const configMode = getAdminConfigMode()
    if (configMode === 'missing') {
        redirect('/admin/login?error=config')
    }

    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    const requestMeta = await getAdminRequestMeta()
    const ip = requestMeta.ip
    const attemptKey = buildLoginAttemptKey(email, ip)
    const ipAttemptKey = buildIpAttemptKey(ip)
    const userLockoutSeconds = getLockoutRemainingSeconds(attemptKey)
    const ipLockoutSeconds = getLockoutRemainingSeconds(ipAttemptKey)
    const lockoutSeconds = Math.max(userLockoutSeconds, ipLockoutSeconds)
    if (lockoutSeconds > 0) {
        await applyFailedLoginDelay(true)
        redirect(`/admin/login?error=locked&retry=${lockoutSeconds}`)
    }

    const valid = verifyAdminCredentials(email, password)
    if (!valid) {
        const userResult = recordFailedAdminLoginAttempt(attemptKey)
        const ipResult = recordFailedAdminLoginAttempt(ipAttemptKey)
        const locked = userResult.locked || ipResult.locked
        const retryAfterSeconds = Math.max(userResult.retryAfterSeconds, ipResult.retryAfterSeconds)
        await applyFailedLoginDelay(locked)
        if (locked) {
            redirect(`/admin/login?error=locked&retry=${retryAfterSeconds}`)
        }
        redirect('/admin/login?error=invalid')
    }

    const configuredEmail = getConfiguredAdminEmail()
    if (!configuredEmail) {
        redirect('/admin/login?error=config')
    }

    clearAdminLoginAttempts(attemptKey)
    clearAdminLoginAttempts(ipAttemptKey)
    try {
        await setAdminSession(configuredEmail)
    } catch (err) {
        console.error('Admin session setup failed:', err)
        redirect('/admin/login?error=config')
    }
    redirect('/admin/overview')
}

export async function adminSignOut() {
    const trustedRequest = await assertTrustedAdminRequest()
    if (!trustedRequest) {
        redirect('/admin/login?error=origin')
    }
    await clearAdminSession()
    redirect('/admin/login?message=signed_out')
}

export async function setGlobalLowCostOverride(formData: FormData) {
    const trustedRequest = await assertTrustedAdminRequest()
    if (!trustedRequest) {
        redirect('/admin/overview?error=invalid_request')
    }

    const session = await requireAdminSession()
    const requestMeta = await getAdminRequestMeta()
    const enabled = String(formData.get('enabled') || 'false') === 'true'
    const returnTo = parseReturnTo(formData, '/admin/overview')
    const admin = createAdminClient()

    let previousValue = false
    const { data: currentRow } = await admin
        .from('admin_runtime_settings')
        .select('global_low_cost_override')
        .eq('id', 'global')
        .maybeSingle()
    previousValue = !!currentRow?.global_low_cost_override

    const nowIso = new Date().toISOString()
    const { error: settingsError } = await admin
        .from('admin_runtime_settings')
        .upsert({
            id: 'global',
            global_low_cost_override: enabled,
            updated_by: session.email,
            updated_at: nowIso,
        }, { onConflict: 'id' })
    if (settingsError) {
        redirect('/admin/overview?error=settings_update_failed')
    }

    await insertAdminAudit('global_low_cost_override_set', session.email, {
        previous: previousValue,
        next: enabled,
        source: 'admin_overview',
        ip: requestMeta.ip,
        origin: requestMeta.origin,
        referer: requestMeta.referer,
        user_agent: requestMeta.userAgent?.slice(0, 220) || null,
    }, admin)

    revalidatePath('/admin/overview')
    redirect(`${returnTo}?message=override_saved`)
}

export async function resetAllUserDailyUsage(formData: FormData) {
    const trustedRequest = await assertTrustedAdminRequest()
    const returnTo = parseReturnTo(formData, '/admin/users')
    if (!trustedRequest) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const session = await requireAdminSession()
    const requestMeta = await getAdminRequestMeta()
    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    const { error } = await admin
        .from('profiles')
        .update({
            daily_msg_count: 0,
            last_msg_reset: nowIso,
        })
        .not('id', 'is', null)
    if (error) {
        console.error('Failed to reset all user daily usage:', error)
        redirect(`${returnTo}?error=bulk_reset_failed`)
    }

    await insertAdminAudit('all_users_daily_usage_reset', session.email, {
        source: returnTo,
        ip: requestMeta.ip,
        origin: requestMeta.origin,
        referer: requestMeta.referer,
        user_agent: requestMeta.userAgent?.slice(0, 220) || null,
    }, admin)

    revalidatePath('/admin/users')
    revalidatePath('/admin/overview')
    redirect(`${returnTo}?message=all_daily_reset_saved`)
}

export async function setAllUsersLowCostMode(formData: FormData) {
    const trustedRequest = await assertTrustedAdminRequest()
    const returnTo = parseReturnTo(formData, '/admin/users')
    if (!trustedRequest) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const session = await requireAdminSession()
    const requestMeta = await getAdminRequestMeta()
    const admin = createAdminClient()
    const enabled = String(formData.get('enabled') || 'false') === 'true'

    const { error } = await admin
        .from('profiles')
        .update({
            low_cost_mode: enabled,
        })
        .not('id', 'is', null)
    if (error) {
        console.error('Failed to toggle low cost mode for all users:', error)
        redirect(`${returnTo}?error=bulk_low_cost_failed`)
    }

    await insertAdminAudit('all_users_low_cost_mode_set', session.email, {
        next: enabled,
        source: returnTo,
        ip: requestMeta.ip,
        origin: requestMeta.origin,
        referer: requestMeta.referer,
        user_agent: requestMeta.userAgent?.slice(0, 220) || null,
    }, admin)

    revalidatePath('/admin/users')
    revalidatePath('/admin/overview')
    redirect(`${returnTo}?message=all_low_cost_saved`)
}

export async function setUserSubscriptionTier(formData: FormData) {
    const trustedRequest = await assertTrustedAdminRequest()
    const returnTo = parseReturnTo(formData, '/admin/users')
    if (!trustedRequest) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const session = await requireAdminSession()
    const requestMeta = await getAdminRequestMeta()
    const admin = createAdminClient()
    const userId = String(formData.get('userId') || '')
    const nextTier = sanitizeTier(String(formData.get('subscriptionTier') || ''))
    if (!isUuid(userId) || !nextTier) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const { data: current, error: currentError } = await admin
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .maybeSingle()
    if (currentError) {
        console.error('Failed reading current subscription tier:', currentError)
        redirect(`${returnTo}?error=user_update_failed`)
    }

    const { error } = await admin
        .from('profiles')
        .update({ subscription_tier: nextTier })
        .eq('id', userId)
    if (error) {
        console.error('Failed updating user subscription tier:', error)
        redirect(`${returnTo}?error=user_update_failed`)
    }

    await insertAdminAudit('user_subscription_tier_set', session.email, {
        user_id: userId,
        previous: current?.subscription_tier || null,
        next: nextTier,
        source: returnTo,
        ip: requestMeta.ip,
        origin: requestMeta.origin,
        referer: requestMeta.referer,
        user_agent: requestMeta.userAgent?.slice(0, 220) || null,
    }, admin)

    revalidatePath('/admin/users')
    revalidatePath('/admin/overview')
    redirect(`${returnTo}?message=user_tier_saved`)
}

export async function setUserLowCostMode(formData: FormData) {
    const trustedRequest = await assertTrustedAdminRequest()
    const returnTo = parseReturnTo(formData, '/admin/users')
    if (!trustedRequest) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const session = await requireAdminSession()
    const requestMeta = await getAdminRequestMeta()
    const admin = createAdminClient()
    const userId = String(formData.get('userId') || '')
    const enabled = String(formData.get('enabled') || 'false') === 'true'
    if (!isUuid(userId)) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const { data: current, error: currentError } = await admin
        .from('profiles')
        .select('low_cost_mode')
        .eq('id', userId)
        .maybeSingle()
    if (currentError) {
        console.error('Failed reading current low-cost mode:', currentError)
        redirect(`${returnTo}?error=user_update_failed`)
    }

    const { error } = await admin
        .from('profiles')
        .update({ low_cost_mode: enabled })
        .eq('id', userId)
    if (error) {
        console.error('Failed updating user low-cost mode:', error)
        redirect(`${returnTo}?error=user_update_failed`)
    }

    await insertAdminAudit('user_low_cost_mode_set', session.email, {
        user_id: userId,
        previous: current?.low_cost_mode ?? null,
        next: enabled,
        source: returnTo,
        ip: requestMeta.ip,
        origin: requestMeta.origin,
        referer: requestMeta.referer,
        user_agent: requestMeta.userAgent?.slice(0, 220) || null,
    }, admin)

    revalidatePath('/admin/users')
    revalidatePath('/admin/overview')
    redirect(`${returnTo}?message=user_low_cost_saved`)
}

export async function resetUserDailyUsage(formData: FormData) {
    const trustedRequest = await assertTrustedAdminRequest()
    const returnTo = parseReturnTo(formData, '/admin/users')
    if (!trustedRequest) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const session = await requireAdminSession()
    const requestMeta = await getAdminRequestMeta()
    const admin = createAdminClient()
    const userId = String(formData.get('userId') || '')
    if (!isUuid(userId)) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const { data: current, error: currentError } = await admin
        .from('profiles')
        .select('daily_msg_count, last_msg_reset')
        .eq('id', userId)
        .maybeSingle()
    if (currentError) {
        console.error('Failed reading current daily usage:', currentError)
        redirect(`${returnTo}?error=user_update_failed`)
    }

    const nowIso = new Date().toISOString()
    const { error } = await admin
        .from('profiles')
        .update({
            daily_msg_count: 0,
            last_msg_reset: nowIso,
        })
        .eq('id', userId)
    if (error) {
        console.error('Failed resetting user daily usage:', error)
        redirect(`${returnTo}?error=user_update_failed`)
    }

    await insertAdminAudit('user_daily_usage_reset', session.email, {
        user_id: userId,
        previous_count: current?.daily_msg_count ?? null,
        previous_reset_at: current?.last_msg_reset ?? null,
        next_count: 0,
        next_reset_at: nowIso,
        source: returnTo,
        ip: requestMeta.ip,
        origin: requestMeta.origin,
        referer: requestMeta.referer,
        user_agent: requestMeta.userAgent?.slice(0, 220) || null,
    }, admin)

    revalidatePath('/admin/users')
    revalidatePath('/admin/overview')
    redirect(`${returnTo}?message=user_daily_reset_saved`)
}

export async function clearUserChatHistory(formData: FormData) {
    const trustedRequest = await assertTrustedAdminRequest()
    const returnTo = parseReturnTo(formData, '/admin/users')
    if (!trustedRequest) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const session = await requireAdminSession()
    const requestMeta = await getAdminRequestMeta()
    const admin = createAdminClient()
    const userId = String(formData.get('userId') || '')
    if (!isUuid(userId)) {
        redirect(`${returnTo}?error=invalid_request`)
    }

    const { count: previousCount, error: countError } = await admin
        .from('chat_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
    if (countError) {
        console.error('Failed counting user chat history before delete:', countError)
    }

    const { error } = await admin
        .from('chat_history')
        .delete()
        .eq('user_id', userId)
    if (error) {
        console.error('Failed clearing user chat history:', error)
        redirect(`${returnTo}?error=user_history_delete_failed`)
    }

    await insertAdminAudit('user_chat_history_cleared', session.email, {
        user_id: userId,
        deleted_rows_estimate: previousCount ?? null,
        source: returnTo,
        ip: requestMeta.ip,
        origin: requestMeta.origin,
        referer: requestMeta.referer,
        user_agent: requestMeta.userAgent?.slice(0, 220) || null,
    }, admin)

    revalidatePath('/admin/users')
    revalidatePath('/admin/overview')
    redirect(`${returnTo}?message=user_history_deleted`)
}
