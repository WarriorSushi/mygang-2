import crypto from 'crypto'

type AdminConfigMode = 'hash' | 'missing'

function safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    if (leftBuffer.length !== rightBuffer.length) return false
    return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function getAdminConfigMode(): AdminConfigMode {
    const email = process.env.ADMIN_PANEL_EMAIL?.trim()
    const hash = process.env.ADMIN_PANEL_PASSWORD_HASH?.trim()
    if (!email || !hash) return 'missing'
    return 'hash'
}

export function getConfiguredAdminEmail() {
    return process.env.ADMIN_PANEL_EMAIL?.trim().toLowerCase() || null
}

export function verifyAdminCredentials(emailInput: string, passwordInput: string) {
    const configuredEmail = getConfiguredAdminEmail()
    if (!configuredEmail) return false

    const emailMatches = safeEqual(emailInput.trim().toLowerCase(), configuredEmail)
    if (!emailMatches) return false

    const configuredHash = process.env.ADMIN_PANEL_PASSWORD_HASH?.trim()
    if (!configuredHash) return false

    // Only PBKDF2 format supported (salt:derivedKey, both hex)
    if (!configuredHash.includes(':')) return false

    const [salt, key] = configuredHash.split(':')
    if (!salt || !key) return false
    const derivedKey = crypto.pbkdf2Sync(passwordInput, Buffer.from(salt, 'hex'), 100000, 64, 'sha512').toString('hex')
    return safeEqual(derivedKey, key)
}
