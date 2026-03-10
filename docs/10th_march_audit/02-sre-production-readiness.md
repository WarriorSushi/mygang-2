# SRE & Production Readiness Review

## Summary

Solid foundation — rate limiting fails closed, webhook idempotency works, error handling is consistent. Key gaps: no startup-time env var validation (missing vars pass build, crash at runtime), no explicit LLM timeout (relies solely on Vercel's 45s hard kill), and all logging is unstructured `console.*` that's hard to query or alert on. These are fixable without major refactoring.

---

## Findings

### [HIGH] No Startup-Time Environment Variable Validation

**File(s):** All files — no validation layer exists

**Issue:** Env vars accessed via `process.env.X!` (non-null assertion) or `process.env.X || ''` everywhere. No centralized validation at build or startup time. Supabase client factories throw lazily (only on first request, not at startup).

Dangerous patterns:
- `webhook/dodo-payments/route.ts`: `webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!` — if missing, webhook verification fails with a cryptic runtime error on the revenue-critical path
- `checkout/route.ts`: `PRODUCT_IDS` set at module level with `|| ''` — missing product ID returns 500 to every checkout user
- `customer-portal/route.ts`: `bearerToken: process.env.DODO_PAYMENTS_API_KEY!` — evaluated at module load
- `openrouter.ts`: `apiKey: process.env.OPENROUTER_API_KEY` — missing = unhelpful auth error from OpenRouter
- `proxy.ts`: `NEXT_PUBLIC_SUPABASE_URL!` and `ANON_KEY!` — missing = every page request crashes

**Impact:** Deployment with missing/renamed env var passes build, appears healthy, fails on first user request.

**Recommendation:** Create `src/lib/env.ts` with Zod schema validating all required env vars. Import in layout or next.config for build-time validation.

```typescript
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  DODO_PAYMENTS_API_KEY: z.string().min(1),
  DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1),
  DODO_PRODUCT_BASIC: z.string().min(1),
  DODO_PRODUCT_PRO: z.string().min(1),
  DODO_PAYMENTS_RETURN_URL: z.string().url(),
  ADMIN_PANEL_SESSION_SECRET: z.string().min(32),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
})

export const env = envSchema.parse(process.env)
```

---

### [HIGH] No Explicit Timeout on LLM API Calls

**File:** `src/app/api/chat/route.ts` (line 1132)

**Issue:** `generateObject()` has `maxRetries: 2` but no timeout. Only Vercel's `maxDuration = 45` protects — a hard kill with no cleanup, no user-facing error, no logging. A slow OpenRouter response could hang 40+ seconds across retries.

**Impact:** During provider degradation, function slots fill with hanging requests. Users see loading spinners for 45s then get nothing.

**Recommendation:** Add `AbortController` with 25s timeout:

```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 25_000)
try {
  const result = await generateObject({
    // ...existing params
    abortSignal: controller.signal,
  })
} finally {
  clearTimeout(timeout)
}
```

---

### [MEDIUM] Module-Level Clients in Webhook and Customer Portal Routes

**File(s):** `src/app/api/webhook/dodo-payments/route.ts` (line 6), `src/app/api/customer-portal/route.ts` (line 8)

**Issue:** Both routes create clients at module scope:
- Webhook: `const supabase = createAdminClient()` — throws on missing env vars before any handler runs
- Customer portal: `new DodoPayments({ bearerToken: process.env.DODO_PAYMENTS_API_KEY! })` — same risk

Missing env vars crash the entire module on cold start with opaque 500 errors and no request context.

**Recommendation:** Move client creation inside handler functions. Both already have singleton caching internally so no performance impact.

---

### [MEDIUM] All Logging is Unstructured console.* Calls

**File(s):** All API routes (~45 console.error, ~6 console.warn calls)

**Issue:** No structured logging, no request correlation IDs, no machine-readable severity. Stack traces systematically discarded — nearly every catch block does `err instanceof Error ? err.message : 'Unknown error'`, losing the `.stack`.

**Impact:** Can't filter by severity in Vercel logs, can't correlate same-request logs, can't set up alerts on structured error codes, can't debug without stack traces.

**Recommendation:** Create `src/lib/logger.ts` with JSON output. Replace key sites (webhook, chat, rate-limit) first. Include `.stack` on errors.

---

### [MEDIUM] No Degradation Signal When Embedding Service Fails

**File:** `src/lib/ai/memory.ts`

**Issue:** When Google AI embedding fails, `storeMemories()` catches per-memory and stores with `embedding: null`. Retrieval degrades to recency-only (good). But there's no log indicating how many memories were stored without embeddings — silent failure with no operator signal.

**Recommendation:** Add a warning log with count when embeddings fail. Consider a `needs_embedding` flag for backfill.

---

### [LOW] Webhook Route Has No Request Body Size Limit

**File:** `src/app/api/webhook/dodo-payments/route.ts`

**Issue:** No application-level body size check before processing. Vercel's 4.5MB default protects, but an oversized webhook payload gets stored directly in `billing_events` JSON column.

**Recommendation:** Add `rawBody.length > 100_000` check before processing.

---

### [LOW] Chat Route Body Not Size-Checked Before JSON.parse

**File:** `src/app/api/chat/route.ts` (line 618)

**Issue:** `req.json()` called before any size check. Zod validates structure after parsing, but parsing itself is unprotected against oversized payloads.

**Recommendation:** Read as text first, check `rawBody.length > 200_000`.

---

### [LOW] In-Memory Caches Have No Size Bounds

**File(s):** `src/lib/rate-limit.ts`, `src/lib/admin/login-security.ts`

**Issue:** Fallback `Map` stores grow unbounded. Production uses Redis (fail-closed), so this is mainly a dev concern. Login security cleanup only runs on access, never proactively.

**Recommendation:** Add MAX_SIZE cap with simple eviction. Low priority.

---

### [LOW] Error Stack Traces Systematically Discarded

**File(s):** All API routes

**Issue:** Every catch block logs `.message` only. Stack traces lost for third-party SDK errors where the trace is essential for debugging.

**Recommendation:** Log `err` directly (`console.error('...:', err)`) or include `.stack` in structured logs.

---

### [LOW] No Health Check Endpoint

**Issue:** No `/api/health` for external monitoring. Can't detect partial failures (app serves pages but Supabase unreachable).

**Recommendation:** Create minimal health endpoint checking Supabase connectivity.

---

## What's Done Well

1. **Rate limiting fails closed** — Redis down in production = requests denied, not allowed
2. **Webhook idempotency via DB constraint** — `INSERT` with unique constraint detection, no TOCTOU race
3. **Orphaned payment tracking** — unmatched webhooks logged as `subscription.active.orphaned`
4. **Graceful LLM failure fallback** — 429 vs 502 distinction, fallback empty-events handler
5. **Fire-and-forget with `waitUntil`** — correct Vercel serverless pattern
6. **Memory compaction crash recovery** — `compacting` kind as lock, reverts on failure
7. **Admin audit logging** — full actor context (email, IP, UA, before/after values)
8. **Zod validation on every route** — consistent, thorough
9. **Supabase admin client singleton** — cached, `autoRefreshToken: false`, `persistSession: false`
10. **Comprehensive security headers** — CSP, HSTS, Permissions-Policy, X-Frame-Options DENY
