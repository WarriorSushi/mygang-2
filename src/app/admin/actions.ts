'use server'

import { redirect } from 'next/navigation'
import { getAdminConfigMode, getConfiguredAdminEmail, verifyAdminCredentials } from '@/lib/admin/auth'
import { clearAdminSession, setAdminSession } from '@/lib/admin/session'

export async function adminSignIn(formData: FormData) {
    const configMode = getAdminConfigMode()
    if (configMode === 'missing') {
        redirect('/admin/login?error=config')
    }

    const email = String(formData.get('email') || '').trim()
    const password = String(formData.get('password') || '')
    const valid = verifyAdminCredentials(email, password)
    if (!valid) {
        redirect('/admin/login?error=invalid')
    }

    const configuredEmail = getConfiguredAdminEmail()
    if (!configuredEmail) {
        redirect('/admin/login?error=config')
    }

    await setAdminSession(configuredEmail)
    redirect('/admin/overview')
}

export async function adminSignOut() {
    await clearAdminSession()
    redirect('/admin/login?message=signed_out')
}
