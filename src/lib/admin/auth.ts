import crypto from 'crypto'

type AdminConfigMode = 'hash' | 'missing'

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

    // Support PBKDF2 format (salt:derivedKey, both hex)
    if (configuredHash.includes(':')) {
        const [salt, key] = configuredHash.split(':')
        if (!salt || !key) return false
        const derivedKey = crypto.pbkdf2Sync(passwordInput, Buffer.from(salt, 'hex'), 100000, 64, 'sha512').toString('hex')
        return safeEqual(derivedKey, key)
    }

    // Legacy SHA-256 fallback
    const normalizedConfiguredHash = normalizeHash(configuredHash)
    if (!isSha256Hex(normalizedConfiguredHash)) return false
    const submittedHash = crypto.createHash('sha256').update(passwordInput).digest('hex')
    return safeEqual(submittedHash, normalizedConfiguredHash)
}

export function generateAdminPasswordHash(password: string): string {
    const salt = crypto.randomBytes(32).toString('hex')
    const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha512').toString('hex')
    return `${salt}:${key}`
}
