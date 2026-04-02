import { z } from 'zod'

const envSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
    OPENROUTER_API_KEY: z.string().min(1),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    DODO_PAYMENTS_API_KEY: z.string().min(1),
    DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1),
    DODO_PRODUCT_BASIC: z.string().min(1),
    DODO_PRODUCT_PRO: z.string().min(1),
    ADMIN_PANEL_SESSION_SECRET: z.string().min(32),
    DODO_PAYMENTS_ENVIRONMENT: z.enum(['live_mode', 'test_mode']),
    DODO_PAYMENTS_RETURN_URL: z.string().url(),
    CRON_SECRET: z.string().min(16),
    ADMIN_PANEL_EMAIL: z.string().email(),
    ADMIN_PANEL_PASSWORD_HASH: z.string().min(1),
    // Optional — Redis not required for dev
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

export function getEnv(): Env {
    if (!_env) {
        const result = envSchema.safeParse(process.env)
        if (!result.success) {
            const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
            throw new Error(`Missing or invalid environment variables:\n${missing}`)
        }
        _env = result.data
    }
    return _env
}

// Validate at import time in production
if (process.env.NODE_ENV === 'production') {
    getEnv()
}
