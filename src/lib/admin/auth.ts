import crypto from 'crypto'

type AdminConfigMode = 'hash' | 'plain' | 'missing'

function safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    if (leftBuffer.length !== rightBuffer.length) return false
    return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function normalizeHash(value: string) {
    return value.trim().toLowerCase().replace(/^sha256:/, '')
}

function isSha256Hex(value: string) {
    return /^[a-f0-9]{64}$/i.test(value)
}

export function getAdminConfigMode(): AdminConfigMode {
    const email = process.env.ADMIN_PANEL_EMAIL?.trim()
    const hash = process.env.ADMIN_PANEL_PASSWORD_HASH?.trim()
    const plain = process.env.ADMIN_PANEL_PASSWORD?.trim()
    if (!email) return 'missing'
    if (hash) return 'hash'
    if (plain) return 'plain'
    return 'missing'
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
    if (configuredHash) {
        const normalizedConfiguredHash = normalizeHash(configuredHash)
        if (!isSha256Hex(normalizedConfiguredHash)) return false

        const submittedHash = crypto.createHash('sha256').update(passwordInput).digest('hex')
        return safeEqual(submittedHash, normalizedConfiguredHash)
    }

    const configuredPlain = process.env.ADMIN_PANEL_PASSWORD?.trim() || ''
    return configuredPlain.length > 0 && safeEqual(passwordInput, configuredPlain)
}
