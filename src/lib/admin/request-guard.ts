import { headers } from 'next/headers'

function extractHost(value: string | null) {
    if (!value) return null
    try {
        const parsed = new URL(value)
        return parsed.host.toLowerCase()
    } catch {
        return null
    }
}

export type AdminRequestMeta = {
    ip: string
    origin: string | null
    referer: string | null
    host: string | null
    userAgent: string | null
}

export async function getAdminRequestMeta(): Promise<AdminRequestMeta> {
    const headerBag = await headers()
    return {
        ip: headerBag.get('x-forwarded-for')?.split(',')[0]?.trim()
            || headerBag.get('x-real-ip')
            || 'unknown',
        origin: headerBag.get('origin'),
        referer: headerBag.get('referer'),
        host: (headerBag.get('x-forwarded-host') || headerBag.get('host'))?.toLowerCase() || null,
        userAgent: headerBag.get('user-agent'),
    }
}

export async function assertTrustedAdminRequest() {
    const meta = await getAdminRequestMeta()
    if (!meta.host) return false

    const originHost = extractHost(meta.origin)
    const refererHost = extractHost(meta.referer)

    if (originHost && originHost !== meta.host) return false
    if (!originHost && refererHost && refererHost !== meta.host) return false

    return true
}
