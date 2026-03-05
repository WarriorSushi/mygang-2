const FAILED_ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const FAILED_ATTEMPT_LIMIT = 5
const LOCKOUT_MS = 15 * 60 * 1000

type LoginAttemptState = {
    failCount: number
    windowStartMs: number
    lockedUntilMs: number
}

const loginAttemptStore = new Map<string, LoginAttemptState>()

let warnedAboutMemoryFallback = false
const useRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

function warnIfProductionMemory() {
    if (process.env.NODE_ENV === 'production' && !useRedis && !warnedAboutMemoryFallback) {
        warnedAboutMemoryFallback = true
        console.warn(
            '[login-security] WARNING: Using in-memory lockout store in production. ' +
            'This resets per serverless container, allowing brute-force bypass. ' +
            'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistent lockout state.'
        )
    }
}

const REDIS_KEY_PREFIX = 'admin:login:'
const REDIS_TTL_S = Math.ceil(Math.max(FAILED_ATTEMPT_WINDOW_MS, LOCKOUT_MS) / 1000) + 60

async function getRedis() {
    const { Redis } = await import('@upstash/redis')
    return Redis.fromEnv()
}

async function getStateFromRedis(key: string): Promise<LoginAttemptState | null> {
    try {
        const redis = await getRedis()
        const data = await redis.get<LoginAttemptState>(REDIS_KEY_PREFIX + key)
        return data ?? null
    } catch (err) {
        console.error('[login-security] Redis read error:', err)
        return null
    }
}

async function setStateToRedis(key: string, state: LoginAttemptState): Promise<void> {
    try {
        const redis = await getRedis()
        await redis.set(REDIS_KEY_PREFIX + key, state, { ex: REDIS_TTL_S })
    } catch (err) {
        console.error('[login-security] Redis write error:', err)
    }
}

async function deleteStateFromRedis(key: string): Promise<void> {
    try {
        const redis = await getRedis()
        await redis.del(REDIS_KEY_PREFIX + key)
    } catch (err) {
        console.error('[login-security] Redis delete error:', err)
    }
}

function getInitialState(nowMs: number): LoginAttemptState {
    return {
        failCount: 0,
        windowStartMs: nowMs,
        lockedUntilMs: 0,
    }
}

function cleanupState(key: string, state: LoginAttemptState, nowMs: number) {
    if (state.lockedUntilMs > nowMs) return
    const windowExpired = nowMs - state.windowStartMs > FAILED_ATTEMPT_WINDOW_MS
    if (windowExpired && state.failCount === 0) {
        loginAttemptStore.delete(key)
    }
}

export async function getLockoutRemainingSeconds(key: string) {
    warnIfProductionMemory()
    const nowMs = Date.now()

    if (useRedis) {
        const state = await getStateFromRedis(key)
        if (!state) return 0
        if (state.lockedUntilMs <= nowMs) return 0
        return Math.max(1, Math.ceil((state.lockedUntilMs - nowMs) / 1000))
    }

    const state = loginAttemptStore.get(key)
    if (!state) return 0
    if (state.lockedUntilMs <= nowMs) {
        cleanupState(key, state, nowMs)
        return 0
    }
    return Math.max(1, Math.ceil((state.lockedUntilMs - nowMs) / 1000))
}

export async function recordFailedAdminLoginAttempt(key: string) {
    warnIfProductionMemory()
    const nowMs = Date.now()

    if (useRedis) {
        const state = (await getStateFromRedis(key)) || getInitialState(nowMs)
        const windowExpired = nowMs - state.windowStartMs > FAILED_ATTEMPT_WINDOW_MS
        if (windowExpired) {
            state.windowStartMs = nowMs
            state.failCount = 0
        }

        state.failCount += 1
        if (state.failCount >= FAILED_ATTEMPT_LIMIT) {
            state.lockedUntilMs = nowMs + LOCKOUT_MS
            state.failCount = 0
            state.windowStartMs = nowMs
        }
        await setStateToRedis(key, state)

        return {
            locked: state.lockedUntilMs > nowMs,
            retryAfterSeconds: state.lockedUntilMs > nowMs
                ? Math.max(1, Math.ceil((state.lockedUntilMs - nowMs) / 1000))
                : 0,
        }
    }

    const state = loginAttemptStore.get(key) || getInitialState(nowMs)
    const windowExpired = nowMs - state.windowStartMs > FAILED_ATTEMPT_WINDOW_MS
    if (windowExpired) {
        state.windowStartMs = nowMs
        state.failCount = 0
    }

    state.failCount += 1
    if (state.failCount >= FAILED_ATTEMPT_LIMIT) {
        state.lockedUntilMs = nowMs + LOCKOUT_MS
        state.failCount = 0
        state.windowStartMs = nowMs
    }
    loginAttemptStore.set(key, state)

    return {
        locked: state.lockedUntilMs > nowMs,
        retryAfterSeconds: state.lockedUntilMs > nowMs
            ? Math.max(1, Math.ceil((state.lockedUntilMs - nowMs) / 1000))
            : 0,
    }
}

export async function clearAdminLoginAttempts(key: string) {
    if (useRedis) {
        await deleteStateFromRedis(key)
    }
    loginAttemptStore.delete(key)
}

export async function applyFailedLoginDelay(isLocked: boolean) {
    const baseDelay = isLocked ? 1000 : 700
    const jitter = Math.floor(Math.random() * 220)
    await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter))
}
