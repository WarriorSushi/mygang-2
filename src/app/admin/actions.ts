'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getAdminConfigMode, getConfiguredAdminEmail, verifyAdminCredentials } from '@/lib/admin/auth'
import { clearAdminSession, requireAdminSession, setAdminSession } from '@/lib/admin/session'
import {
    applyFailedLoginDelay,
    clearAdminLoginAttempts,
    getLockoutRemainingSeconds,
    recordFailedAdminLoginAttempt,
} from '@/lib/admin/login-security'
import { createAdminClient } from '@/lib/supabase/admin'

function getRequestIp(headerBag: Headers) {
    return headerBag.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headerBag.get('x-real-ip')
        || 'unknown'
}

function buildLoginAttemptKey(email: string, ip: string) {
    return `admin-login:${email.trim().toLowerCase()}:${ip}`
}

function buildIpAttemptKey(ip: string) {
    return `admin-login-ip:${ip}`
}

export async function adminSignIn(formData: FormData) {
    const configMode = getAdminConfigMode()
    if (configMode === 'missing') {
        redirect('/admin/login?error=config')
    }

    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    const headerBag = await headers()
    const ip = getRequestIp(headerBag)
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
    await clearAdminSession()
    redirect('/admin/login?message=signed_out')
}

export async function setGlobalLowCostOverride(formData: FormData) {
    const session = await requireAdminSession()
    const enabled = String(formData.get('enabled') || 'false') === 'true'
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

    const { error: auditError } = await admin
        .from('admin_audit_log')
        .insert({
            actor_email: session.email,
            action: 'global_low_cost_override_set',
            details: {
                previous: previousValue,
                next: enabled,
            },
        })
    if (auditError) {
        console.error('Admin audit insert failed:', auditError)
    }

    revalidatePath('/admin/overview')
    redirect('/admin/overview?message=override_saved')
}
