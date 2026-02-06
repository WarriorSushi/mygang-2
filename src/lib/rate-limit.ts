type RateLimitResult = {
  success: boolean
  remaining: number
  reset: number
}

const DEFAULT_LIMIT = 30
const DEFAULT_WINDOW_MS = 60_000

const memoryStore = new Map<string, { count: number; reset: number }>()

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || now > entry.reset) {
    const reset = now + windowMs
    memoryStore.set(key, { count: 1, reset })
    return { success: true, remaining: limit - 1, reset }
  }

  const nextCount = entry.count + 1
  entry.count = nextCount
  memoryStore.set(key, entry)
  return { success: nextCount <= limit, remaining: Math.max(0, limit - nextCount), reset: entry.reset }
}

export async function rateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): Promise<RateLimitResult> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")
    const redis = Redis.fromEnv()
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.floor(windowMs / 1000))} s`),
      analytics: true
    })
    const result = await ratelimit.limit(key)
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset
    }
  }

  return memoryRateLimit(key, limit, windowMs)
}
