const FAILED_ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const FAILED_ATTEMPT_LIMIT = 5
const LOCKOUT_MS = 15 * 60 * 1000

type LoginAttemptState = {
    failCount: number
    windowStartMs: number
    lockedUntilMs: number
}

const loginAttemptStore = new Map<string, LoginAttemptState>()

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

export function getLockoutRemainingSeconds(key: string) {
    const nowMs = Date.now()
    const state = loginAttemptStore.get(key)
    if (!state) return 0
    if (state.lockedUntilMs <= nowMs) {
        cleanupState(key, state, nowMs)
        return 0
    }
    return Math.max(1, Math.ceil((state.lockedUntilMs - nowMs) / 1000))
}

export function recordFailedAdminLoginAttempt(key: string) {
    const nowMs = Date.now()
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

export function clearAdminLoginAttempts(key: string) {
    loginAttemptStore.delete(key)
}

export async function applyFailedLoginDelay(isLocked: boolean) {
    const baseDelay = isLocked ? 1000 : 700
    const jitter = Math.floor(Math.random() * 220)
    await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter))
}
