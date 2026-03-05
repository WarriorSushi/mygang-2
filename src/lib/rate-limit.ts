type RateLimitResult = {
  success: boolean
  remaining: number
  reset: number
}

const DEFAULT_LIMIT = 30
const DEFAULT_WINDOW_MS = 60_000

const memoryStore = new Map<string, { count: number; reset: number }>()

let warnedAboutMemoryFallback = false

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  if (process.env.NODE_ENV === 'production' && !warnedAboutMemoryFallback) {
    warnedAboutMemoryFallback = true
    console.warn(
      '[rate-limit] WARNING: Using in-memory rate limiting in production. ' +
      'This resets per serverless container and is ineffective at scale. ' +
      'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for persistent rate limiting.'
    )
  }
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

// Cache Redis singleton at module level to avoid re-instantiation per request
let _redisInstance: unknown = null
let _ratelimitCache = new Map<string, unknown>()

export async function rateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): Promise<RateLimitResult> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")

    if (!_redisInstance) {
      _redisInstance = Redis.fromEnv()
    }

    const cacheKey = `${limit}:${windowMs}`
    let ratelimit = _ratelimitCache.get(cacheKey) as InstanceType<typeof Ratelimit> | undefined
    if (!ratelimit) {
      ratelimit = new Ratelimit({
        redis: _redisInstance as InstanceType<typeof Redis>,
        limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.floor(windowMs / 1000))} s`),
        analytics: true
      })
      _ratelimitCache.set(cacheKey, ratelimit)
    }

    const result = await ratelimit.limit(key)
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset
    }
  }

  return memoryRateLimit(key, limit, windowMs)
}
