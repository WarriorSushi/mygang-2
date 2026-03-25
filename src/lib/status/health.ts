import { createAdminClient } from '@/lib/supabase/admin'

export type HealthCheckStatus = 'pass' | 'warn' | 'fail'

export type HealthCheck = {
    id: string
    label: string
    status: HealthCheckStatus
    summary: string
    detail?: string
}

export type StatusSnapshot = {
    generatedAt: string
    siteUrl: string | null
    commitSha: string | null
    checks: HealthCheck[]
}

const CHECK_TIMEOUT_MS = 2500

function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null

    return Promise.race([
        Promise.resolve(promise).finally(() => {
            if (timer) clearTimeout(timer)
        }),
        new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${CHECK_TIMEOUT_MS}ms`)), CHECK_TIMEOUT_MS)
        }),
    ])
}

function hasEnv(name: string) {
    return Boolean(process.env[name]?.trim())
}

function summarizeOptionalProvider(name: string, configured: boolean, detail?: string): HealthCheck {
    return {
        id: name,
        label: name,
        status: configured ? 'pass' : 'warn',
        summary: configured ? 'Configured' : 'Not configured',
        detail,
    }
}

async function checkSupabase(): Promise<HealthCheck> {
    const hasUrl = hasEnv('NEXT_PUBLIC_SUPABASE_URL')
    const hasKey = hasEnv('SUPABASE_SERVICE_ROLE_KEY')

    if (!hasUrl || !hasKey) {
        return {
            id: 'supabase',
            label: 'Supabase database',
            status: 'fail',
            summary: 'Missing required env',
            detail: 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set for database health checks.',
        }
    }

    try {
        const admin = createAdminClient()
        const { error } = await withTimeout(
            admin.from('profiles').select('id').limit(1),
            'Supabase database check',
        )

        if (error) {
            return {
                id: 'supabase',
                label: 'Supabase database',
                status: 'fail',
                summary: 'Query failed',
                detail: error.message,
            }
        }

        return {
            id: 'supabase',
            label: 'Supabase database',
            status: 'pass',
            summary: 'Reachable',
            detail: 'Service-role read query succeeded.',
        }
    } catch (error) {
        return {
            id: 'supabase',
            label: 'Supabase database',
            status: 'fail',
            summary: 'Unreachable',
            detail: error instanceof Error ? error.message : 'Unknown Supabase error',
        }
    }
}

async function checkRedis(): Promise<HealthCheck> {
    const hasUrl = hasEnv('UPSTASH_REDIS_REST_URL')
    const hasToken = hasEnv('UPSTASH_REDIS_REST_TOKEN')

    if (!hasUrl && !hasToken) {
        return {
            id: 'redis',
            label: 'Upstash Redis',
            status: 'warn',
            summary: 'Not configured',
            detail: 'Production rate limiting fails closed without Redis. Configure both Upstash variables before launch.',
        }
    }

    if (!hasUrl || !hasToken) {
        return {
            id: 'redis',
            label: 'Upstash Redis',
            status: 'fail',
            summary: 'Partial config',
            detail: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be provided together.',
        }
    }

    try {
        const { Redis } = await import('@upstash/redis')
        const redis = Redis.fromEnv()
        const result = await withTimeout(redis.ping(), 'Redis check')
        return {
            id: 'redis',
            label: 'Upstash Redis',
            status: 'pass',
            summary: typeof result === 'string' ? result : 'Reachable',
            detail: 'Ping succeeded.',
        }
    } catch (error) {
        return {
            id: 'redis',
            label: 'Upstash Redis',
            status: 'fail',
            summary: 'Unreachable',
            detail: error instanceof Error ? error.message : 'Unknown Redis error',
        }
    }
}

function checkSiteUrl(): HealthCheck {
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || null

    return {
        id: 'site-url',
        label: 'Site URL',
        status: configuredSiteUrl ? 'pass' : 'warn',
        summary: configuredSiteUrl ? 'Configured' : 'Using fallback',
        detail: configuredSiteUrl
            ? configuredSiteUrl
            : 'NEXT_PUBLIC_SITE_URL is unset, so runtime falls back to https://mygang.ai.',
    }
}

function checkAdminAuth(): HealthCheck {
    const emailConfigured = hasEnv('ADMIN_PANEL_EMAIL')
    const hashConfigured = hasEnv('ADMIN_PANEL_PASSWORD_HASH')
    const sessionConfigured = hasEnv('ADMIN_PANEL_SESSION_SECRET')

    if (!emailConfigured || !hashConfigured || !sessionConfigured) {
        return {
            id: 'admin-auth',
            label: 'Admin auth config',
            status: 'fail',
            summary: 'Missing required env',
            detail: 'ADMIN_PANEL_EMAIL, ADMIN_PANEL_PASSWORD_HASH, and ADMIN_PANEL_SESSION_SECRET are all required.',
        }
    }

    const hash = process.env.ADMIN_PANEL_PASSWORD_HASH?.trim() || ''
    const isPbkdf2Format = hash.includes(':') && hash.split(':').length === 2

    return {
        id: 'admin-auth',
        label: 'Admin auth config',
        status: isPbkdf2Format ? 'pass' : 'fail',
        summary: isPbkdf2Format ? 'PBKDF2 hash format ready' : 'Invalid hash format',
        detail: isPbkdf2Format
            ? 'Runtime expects ADMIN_PANEL_PASSWORD_HASH to be salt_hex:derived_key_hex.'
            : 'Runtime only accepts PBKDF2 hashes in salt_hex:derived_key_hex format.',
    }
}

function checkCron(): HealthCheck {
    return {
        id: 'cron',
        label: 'CRON auth',
        status: hasEnv('CRON_SECRET') ? 'pass' : 'fail',
        summary: hasEnv('CRON_SECRET') ? 'Configured' : 'Missing CRON_SECRET',
        detail: 'Required for the internal WYWA route.',
    }
}

export async function getStatusSnapshot(): Promise<StatusSnapshot> {
    const [supabaseCheck, redisCheck] = await Promise.all([
        checkSupabase(),
        checkRedis(),
    ])

    const checks: HealthCheck[] = [
        checkSiteUrl(),
        supabaseCheck,
        redisCheck,
        summarizeOptionalProvider(
            'AI providers',
            hasEnv('GOOGLE_GENERATIVE_AI_API_KEY') && hasEnv('OPENROUTER_API_KEY'),
            'Google Gemini is required and OpenRouter is the configured fallback provider.',
        ),
        summarizeOptionalProvider(
            'Dodo Payments',
            hasEnv('DODO_PAYMENTS_API_KEY')
            && hasEnv('DODO_PAYMENTS_WEBHOOK_KEY')
            && hasEnv('DODO_PRODUCT_BASIC')
            && hasEnv('DODO_PRODUCT_PRO')
            && hasEnv('DODO_PAYMENTS_RETURN_URL'),
            'Status only checks config presence here; it does not perform a live billing API call.',
        ),
        checkAdminAuth(),
        checkCron(),
    ]

    return {
        generatedAt: new Date().toISOString(),
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || null,
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.trim()
            || process.env.GIT_COMMIT_SHA?.trim()
            || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim()
            || null,
        checks,
    }
}
