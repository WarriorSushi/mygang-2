# Backend Security & API Review

**Project:** MyGang by Antig
**Date:** 2026-02-18
**Reviewer Role:** Senior Backend Security Engineer
**Scope:** All API routes, authentication flows, admin panel, AI integrations, Supabase clients, rate limiting, and middleware

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [File-by-File Analysis](#file-by-file-analysis)
3. [Cross-Cutting Concerns](#cross-cutting-concerns)
4. [What Is Great About the Security Posture](#what-is-great)
5. [Prioritized Recommendations](#prioritized-recommendations)

---

## Executive Summary

The project demonstrates a **strong security-conscious design** for an indie/startup-stage application. Notable positives include consistent Zod validation on API inputs, timing-safe credential comparison for admin auth, HMAC-signed session cookies, brute-force lockout on admin login, comprehensive audit logging, abuse scoring, content safety filtering, and proper use of Supabase RLS via the anon key for user-scoped operations.

However, several findings range from **CRITICAL** to **LOW** severity. The most important are:

- **CRITICAL:** The admin middleware (`proxy.ts`) performs a non-constant-time signature comparison (line 36), which is a timing side-channel vulnerability that could allow session token forgery.
- **HIGH:** The admin password hashing uses raw SHA-256 (no salt, no key stretching), making it vulnerable to rainbow tables and brute-force attacks if the hash leaks.
- **HIGH:** In-memory rate limiting and login lockout state is lost on server restart/redeploy, and is per-instance in multi-process/serverless deployments.
- **MEDIUM:** The chat route allows unauthenticated (guest) usage with only IP-based rate limiting, which is trivially spoofable behind proxies.
- **MEDIUM:** No CSRF token validation on server action forms -- relies solely on origin/referer header checks.

---

## File-by-File Analysis

---

### 1. `src/app/api/chat/route.ts`

**Purpose:** Main chat API endpoint. Accepts user messages, invokes LLM via OpenRouter, returns AI-generated group chat responses, persists history and memory.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| MEDIUM | **Unauthenticated access permitted.** The route does not require authentication; guests get IP-based rate limiting only (line 584-586). IP headers (`x-forwarded-for`, `x-real-ip`) are trivially spoofable unless the hosting platform strips them. An attacker can rotate IPs or forge headers to bypass the 20-req/min guest limit. | 581-586 |
| LOW | **Mock AI bypass in non-production.** The `x-mock-ai` header (line 550-571) skips all LLM processing. While gated by `NODE_ENV !== 'production'`, if a staging environment accidentally exposes this, it leaks character data structure without auth. | 550-571 |
| LOW | **Fire-and-forget persistence errors silently dropped.** Background persistence (line 1321) catches errors but only logs them. A persistent DB failure could silently lose user data without alerting the user. | 1059-1321 |

#### API Design Issues

| Severity | Finding | Lines |
|----------|---------|-------|
| MEDIUM | **No authentication requirement for a stateful operation.** Guests trigger LLM calls that cost money. While rate-limited, the lack of any identity verification means anonymous cost abuse is possible. | 492-596 |
| LOW | **Usage metadata exposed in response.** The `usage` block (line 1048-1054) returns `promptChars`, `responseChars`, `historyCount`, and `provider`. This leaks internal operational details to the client. While not directly exploitable, it reveals infrastructure information. | 1048-1054 |

#### Data Exposure

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **LLM prompt contains full user profile and memory.** If an LLM provider logs prompts, user PII (profile facts, relationship states, memories) would be stored in a third-party system. This is an inherent risk of LLM-based systems but should be documented and mitigated by policy. | 709-722 |

#### Input Validation -- GOOD

- **Zod schema validation** on the entire request body (lines 387-407). Message content limited to 2000 chars, arrays capped, enums enforced.
- **Character ID whitelist** against `CHARACTERS` constant (lines 523-524).
- **Content safety filtering** via `HARD_BLOCK_PATTERNS` and `SOFT_BLOCK_PATTERNS` (lines 245-259).
- **Abuse scoring** tracks repeated/suspicious messages (lines 261-269).
- **Message ID sanitization** via `sanitizeMessageId` throughout.
- **Event output sanitization** -- all LLM output is re-validated, trimmed, and capped (lines 913-963).

#### What Is Great

- Extremely thorough output sanitization of LLM responses before returning to client.
- Abuse scoring system with progressive blocking.
- Dual-check on `client_message_id` to prevent duplicate history insertion.
- Rate limiting on both authenticated and unauthenticated paths.
- Content safety hard/soft block with appropriate user-facing messages.
- Daily message limits per subscription tier.
- Atomic counter increments via RPC to avoid race conditions (line 1116).

---

### 2. `src/app/api/analytics/route.ts`

**Purpose:** Receives analytics events from the client.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **Unauthenticated analytics insertion.** Anyone can POST analytics events, even without a session. The `user_id` is set from the session if available, otherwise null. This allows anonymous analytics injection/pollution. | 37-48 |

#### API Design -- GOOD

- Zod validation on input (lines 6-11).
- Metadata size limit of 2000 chars (line 32).
- IP-based rate limiting at 60 req/min (line 18).
- Does not leak internal error details to the client.

#### What Is Great

- Clean, minimal surface area.
- Proper error suppression for missing tables (`PGRST205`).

---

### 3. `src/app/auth/callback/route.ts`

**Purpose:** OAuth callback handler for Supabase auth.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| **HIGH** | **Open redirect partially mitigated but still risky.** The `next` parameter is checked to start with `/` (line 9), which prevents `https://evil.com` redirects. However, it does NOT prevent protocol-relative URLs like `//evil.com` or paths like `/\evil.com` on some browsers. The redirect uses `${origin}${next}` (line 15) where `origin` comes from `request.url`, which could be manipulated in certain proxy configurations. | 8-15 |

#### Recommendation

- Additionally reject values starting with `//` or containing backslashes.
- Consider an allowlist of valid redirect paths (e.g., `/post-auth`, `/chat`, `/settings`).

#### What Is Great

- Default fallback to `/post-auth` when `next` is missing or invalid.
- Uses `origin` from the request URL rather than a user-supplied value.

---

### 4. `src/app/auth/actions.ts`

**Purpose:** Server actions for user auth (Google OAuth, email/password sign-in/up), profile management, memory CRUD, chat history, settings.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| MEDIUM | **Sign-in/sign-up combined flow leaks user existence.** The `signInOrSignUpWithPassword` function (lines 64-110) attempts sign-in first, then sign-up on failure. If sign-up returns "already registered", it returns "Incorrect password" (line 95). While this normalizes the message, the different code paths and timing could still leak whether an email exists. | 64-110 |
| LOW | **`deleteAccount` has no confirmation step.** A single server action call deletes the user account permanently using the admin client (line 124). If CSRF protections are bypassed, this is a destructive action with no second factor. | 118-132 |

#### Input Validation -- GOOD

- Zod schemas for `username` (line 23), `memoryContent` (line 24), `characterIds` (line 25-28), and `userSettings` (lines 29-36) with `.strict()`.
- All database operations scoped to `user.id` from the authenticated session.
- Memory operations include `user_id` equality checks (lines 240-243, 265-269).

#### Authorization -- GOOD

- Every function calls `supabase.auth.getUser()` and returns early if no user.
- `deleteAccount` uses admin client only for the actual deletion, with user identity verified via the session.
- `updateUserSettings` validates with strict Zod schema preventing extra fields.

#### What Is Great

- The `userSettingsSchema` uses `.strict()` mode, preventing injection of unexpected fields.
- Pagination functions (`getMemoriesPage`, `getChatHistoryPage`) properly bound limits.
- Memory deletion checks both `id` and `user_id` preventing IDOR.

---

### 5. `src/app/admin/actions.ts`

**Purpose:** Server actions for the admin panel (sign-in, sign-out, user management, global settings).

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **`returnTo` whitelist is narrow but uses string concatenation in redirect.** The `parseReturnTo` function (lines 24-28) whitelists only `/admin/overview` and `/admin/users`, which is safe. However, if the whitelist were ever expanded carelessly, it could become an open redirect. | 24-28 |

#### Authorization -- EXCELLENT

- Every action calls `assertTrustedAdminRequest()` first (origin/referer validation).
- Every mutating action calls `requireAdminSession()` to verify the HMAC-signed session cookie.
- Input validation: `isUuid()` check on user IDs (line 30-32), `sanitizeTier()` for subscription tiers (line 34-36).
- Full audit logging for every admin action with actor email, IP, origin, referer, and user-agent (lines 39-55).

#### What Is Great

- **Comprehensive audit trail.** Every single admin action is logged with rich metadata. This is production-grade auditability.
- **Least-privilege design.** User IDs are validated as UUIDs. Subscription tiers are whitelisted to exact values.
- **Separation of concerns.** Admin operations use `createAdminClient()` (service role key) only where needed.
- **Return-to whitelist** prevents redirect manipulation.

---

### 6. `src/lib/admin/auth.ts`

**Purpose:** Admin credential verification (email + password/hash comparison).

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| **HIGH** | **SHA-256 without salt or key stretching.** The password hash is a raw SHA-256 hex digest (line 46). SHA-256 is a fast hash -- an attacker with the hash can brute-force it at billions of attempts per second. Industry standard is bcrypt, scrypt, or Argon2 with per-credential salts. | 41-47 |
| MEDIUM | **Plaintext password fallback.** If `ADMIN_PANEL_PASSWORD_HASH` is not set, the system falls back to comparing against `ADMIN_PANEL_PASSWORD` in plaintext (lines 50-51). This is a configuration weakness -- if the env var is logged or exposed, the password is immediately compromised. | 50-51 |

#### What Is Great

- **Timing-safe comparison** via `crypto.timingSafeEqual` for both email and password/hash (lines 5-9, 38, 47, 51).
- **Normalized email comparison** (lowercased, trimmed) prevents case-sensitivity bypass.
- **Hash format validation** (`isSha256Hex`) prevents invalid hash configs from silently passing.
- **Config mode detection** distinguishes between hash, plain, and missing configurations.

---

### 7. `src/lib/admin/session.ts`

**Purpose:** HMAC-SHA256 signed admin session cookie management.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **12-hour session TTL with no sliding window.** The session expires exactly 12 hours after creation (line 6). There is no mechanism to extend the session on activity, meaning admins are forced to re-login every 12 hours regardless of activity. Conversely, a stolen session token is valid for up to 12 hours. | 6 |
| LOW | **No session revocation mechanism.** There is no way to invalidate a specific session token without changing the `ADMIN_PANEL_SESSION_SECRET` (which invalidates ALL sessions). If a session is compromised, there is no targeted revocation. | -- |
| LOW | **Cookie `secure` flag only in production.** In development, the cookie is not marked `secure` (line 63). This is expected but should be documented. | 62-63 |

#### What Is Great

- **HMAC-SHA256 signature** with a secret key prevents token tampering.
- **Timing-safe signature verification** (line 42).
- **`httpOnly`** prevents JavaScript access to the cookie.
- **`sameSite: 'lax'`** provides partial CSRF protection.
- **`path: '/admin'`** restricts cookie scope to admin routes only.
- **Expiration validation** in both encoding and decoding.
- **Null-safe secret handling** -- returns null if secret is missing.

---

### 8. `src/lib/admin/login-security.ts`

**Purpose:** Brute-force protection for admin login with progressive lockout.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| **HIGH** | **In-memory storage.** The `loginAttemptStore` is a `Map` in server memory (line 11). In serverless environments (Vercel, etc.), each function invocation may be a separate process/container. This means: (1) lockout state is not shared across instances, (2) state is lost on restart/redeploy, (3) an attacker can exploit cold starts to reset their attempt counter. | 11 |
| MEDIUM | **No cleanup of stale entries.** The `loginAttemptStore` Map grows unboundedly. While the `cleanupState` function exists (line 21), it is only called during `getLockoutRemainingSeconds` and only for the specific key being checked. A DoS attacker could fill memory by generating many unique email+IP combinations. | 11, 21-27 |

#### What Is Great

- **Dual-key lockout** -- locks by both email+IP and IP-only, preventing both targeted and distributed attacks.
- **Progressive delay** with jitter on failed attempts (lines 70-73), preventing timing oracle attacks.
- **15-minute lockout window** after 5 failures is a reasonable balance.
- **5-attempt limit within 10-minute window** is appropriately strict for admin access.

---

### 9. `src/lib/admin/request-guard.ts`

**Purpose:** CSRF-like protection via origin/referer header validation for admin server actions.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| MEDIUM | **No CSRF tokens -- relies solely on headers.** The `assertTrustedAdminRequest` function compares `origin` and `referer` headers against the `host` header (lines 38-44). While modern browsers reliably send these headers, some edge cases exist: (1) Referer can be suppressed via `Referrer-Policy: no-referrer`, (2) some browser extensions or proxy configurations may strip headers, (3) if both `origin` and `referer` are absent, the check passes (line 42 only rejects when headers are present but mismatched -- if both are null, line 40-42 both pass). | 34-44 |
| LOW | **`x-forwarded-host` header is trusted.** The `host` value can come from `x-forwarded-host` (line 29), which is set by reverse proxies. If the deployment is misconfigured or the app is accessed directly (bypassing the proxy), this could be spoofed. | 29 |

#### Specific Vulnerability Detail (lines 38-44):

```typescript
if (originHost && originHost !== meta.host) return false     // line 40
if (!originHost && refererHost && refererHost !== meta.host) return false  // line 42
return true  // line 44
```

If a request has **no `Origin` header AND no `Referer` header**, the function returns `true`. This means a request crafted to strip both headers (e.g., via a custom HTTP client, not a browser) would pass the check. Since server actions require POST requests from browsers, the `Origin` header is reliably sent. However, for completeness, the fallback should reject when both are absent for admin endpoints.

#### What Is Great

- Defense-in-depth approach -- this is used alongside session verification.
- Handles both origin and referer as fallback signals.

---

### 10. `src/lib/rate-limit.ts`

**Purpose:** Rate limiting abstraction with Upstash Redis or in-memory fallback.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| **HIGH** | **In-memory fallback is per-process and volatile.** If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not configured, the system falls back to a `Map` in server memory (line 10). In serverless environments (Vercel), each function invocation may be independent, meaning rate limits are effectively not enforced. | 10-25 |
| LOW | **No memory cleanup.** The `memoryStore` Map grows without bound (line 10). While entries eventually become stale, they are never proactively removed. Under sustained load, this could cause memory pressure. | 10 |

#### What Is Great

- **Clean abstraction** allows swapping implementations.
- **Sliding window** when using Upstash Redis.
- **Dynamic import** of Upstash only when configured, avoiding build errors.

---

### 11. `src/lib/supabase/admin.ts`

**Purpose:** Creates a Supabase client with the service role key (bypasses RLS).

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| MEDIUM | **Singleton pattern caches the admin client globally.** The `adminClient` variable (line 4) is a module-level singleton. In long-running server processes, this is fine. In serverless environments, the client persists across warm invocations within the same container, which is acceptable. However, if the service role key is rotated, a restart is required. | 4-18 |
| LOW | **Service role key in `SUPABASE_SERVICE_ROLE_KEY`.** This is the standard pattern, but the key must never be exposed to the client. The variable name does NOT start with `NEXT_PUBLIC_`, so Next.js will not bundle it client-side. This is correct. | 10 |

#### What Is Great

- **Not prefixed with `NEXT_PUBLIC_`** -- the service role key is correctly kept server-side only.
- **Auth options disable auto-refresh and session persistence** (line 16), appropriate for a server-side service client.
- **Runtime validation** throws an error if env vars are missing (line 12).

---

### 12. `src/lib/supabase/server.ts`

**Purpose:** Creates a per-request Supabase client for server-side operations using the anon key + user cookies.

#### What Is Great

- Uses `@supabase/ssr`'s `createServerClient` with proper cookie handling.
- Uses the **anon key** (not service role), meaning all queries are subject to RLS policies.
- Gracefully handles the case where `setAll` is called from a Server Component (line 21-24).
- Standard Supabase SSR pattern correctly implemented.

#### Notes

- The `!` non-null assertions on env vars (line 9-10) will throw at runtime if not set. This is acceptable since the app cannot function without them, but a more descriptive error would be helpful.

---

### 13. `src/lib/supabase/client.ts`

**Purpose:** Browser-side Supabase client using the anon key.

#### What Is Great

- Uses `NEXT_PUBLIC_` prefixed env vars (correctly public).
- Runtime validation for missing env vars (lines 6-8).
- Uses `@supabase/ssr`'s `createBrowserClient`.

#### Notes

- No security issues. The anon key is designed to be public and should be paired with RLS policies in Supabase.

---

### 14. `src/lib/ai/openrouter.ts`

**Purpose:** Configures the OpenRouter AI SDK provider with the API key.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **API key from environment only.** `OPENROUTER_API_KEY` is read from `process.env` (line 4). This is correct. The variable is not prefixed with `NEXT_PUBLIC_`. No issues. | 4 |

#### What Is Great

- Minimal, clean configuration.
- No API key exposure risk.
- `response-healing` plugin adds resilience.

---

### 15. `src/lib/ai/memory.ts`

**Purpose:** Memory storage, retrieval, embedding generation, and compaction for the AI chat system.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **Memory retrieval uses keyword matching without sanitization.** The `tokenize` function (lines 104-111) strips non-alphanumeric characters, which is good for preventing injection, but the `retrieveMemoriesLite` function fetches the last 50 memories and scores them client-side (lines 120-143). If a user has many memories, this is inefficient but not a security issue. | 120-143 |
| LOW | **`touchMemories` does not scope by `user_id`.** The function updates `last_used_at` for memory IDs without checking `user_id` (lines 145-153). If an attacker can guess/enumerate memory UUIDs, they could touch another user's memories. However, this only updates `last_used_at` (a benign field) and UUIDs are not enumerable. RLS should protect this at the database level. | 145-153 |

#### What Is Great

- **Duplicate detection** before inserting memories (lines 54-62).
- **Embedding generation** is properly abstracted.
- **Memory compaction** with LLM summarization to manage memory growth.
- **Archival** rather than deletion of compacted memories.

---

### 16. `src/proxy.ts` (Middleware)

**Purpose:** Next.js middleware that protects admin routes by verifying the session cookie.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| **CRITICAL** | **Non-constant-time signature comparison.** Line 36 uses `!==` to compare the computed signature with the provided signature: `if (signature !== expectedSignature) return false`. This is a **timing side-channel vulnerability**. An attacker can measure response times to progressively guess the correct signature byte-by-byte. The `session.ts` file correctly uses `crypto.timingSafeEqual`, but the middleware does not. Since the middleware runs on EVERY admin request, this is a high-frequency attack surface. | 36 |
| LOW | **Session verification duplicated.** The signature verification logic is duplicated between `proxy.ts` (lines 12-47) and `session.ts` (lines 33-52). The middleware uses Web Crypto API (edge-compatible), while `session.ts` uses Node.js `crypto`. This duplication increases the risk of the two implementations diverging (as they already have -- the timing-safe comparison). | 12-47 |

#### Specific Vulnerability Detail (line 36):

```typescript
if (signature !== expectedSignature) return false  // TIMING SIDE-CHANNEL
```

**Contrast with `session.ts` (line 42):**

```typescript
if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null  // CORRECT
```

The middleware is the first line of defense for all admin routes. Every page load, every navigation hits this code path. The string comparison `!==` leaks timing information proportional to the length of the matching prefix.

#### What Is Great

- **Middleware-level protection** ensures admin routes cannot be accessed even by direct URL navigation.
- **Edge-compatible** implementation using Web Crypto API.
- **Expiration check** in the token payload.
- Correctly identifies which paths need protection (lines 6-9).

---

### 17. `src/app/admin/login/page.tsx`

**Purpose:** Admin login form page.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **Configuration status leaked.** The page renders `configMissing` status and hints about which env vars to set (lines 143-147). In production, this tells an attacker whether admin credentials are configured. If this page is publicly accessible, it reveals configuration state. | 143-147 |
| LOW | **Hash mode disclosure.** When `configMode === 'hash'`, the page renders a hint that the password field accepts a SHA-256 hash (lines 184-188). This reveals the hashing algorithm to potential attackers. | 184-188 |

#### What Is Great

- **Auto-redirect** if already authenticated (lines 59-62).
- **Error messages are generic** for auth failures ("Invalid admin email or password").
- **Lockout time displayed** to the user for transparency.
- Form uses `action={adminSignIn}` server action (no client-side credential handling).

---

### 18. `src/app/admin/(protected)/layout.tsx`

**Purpose:** Layout wrapper for all protected admin pages.

#### What Is Great

- **`requireAdminSession()` called at layout level** (line 7). This means ALL child pages are protected by the session check before any content renders.
- **Session email displayed** in the header for transparency.
- Clean separation of authentication concern at the layout level.

#### Notes

- No security issues found. This is a clean implementation.

---

### 19. `src/app/admin/(protected)/users/page.tsx`

**Purpose:** Admin user management page with per-user controls.

#### Security Vulnerabilities

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **User IDs exposed in hidden form fields.** User UUIDs are rendered in hidden `<input>` elements (e.g., line 293). These are visible in the page source. While UUIDs are not secrets, they are used as the sole identifier for admin operations. Combined with a session hijack, this facilitates targeted attacks. | 293, 304, 315, 325 |

#### Data Exposure

| Severity | Finding | Lines |
|----------|---------|-------|
| MEDIUM | **Truncated user IDs displayed.** The page shows `profile.id.slice(0, 8)` (line 252) in the UI, but the full UUID is in hidden form fields. The page loads up to 40 users with their usage statistics, daily counts, and activity timestamps. This is appropriate for an admin view but represents a rich target if the session is compromised. | 86-91, 252, 263 |

#### What Is Great

- **All forms use server actions** with `assertTrustedAdminRequest()` and `requireAdminSession()`.
- **Destructive operations** (Delete Chat History) are clearly visually distinguished.
- **N+1 query concern:** The page issues parallel queries for recent rows and total counts, which is efficient.

---

### 20. `src/app/admin/(protected)/overview/page.tsx`

**Purpose:** Admin dashboard with system metrics, route health, and global controls.

#### Data Exposure

| Severity | Finding | Lines |
|----------|---------|-------|
| LOW | **Recent chat activity shows speaker names and partial user IDs.** Lines 349-351 display `row.speaker` and `row.user_id.slice(0, 8)`. Message content is NOT displayed, which is good. | 347-353 |
| LOW | **Audit log entries visible.** The page displays admin audit log entries with actor email, action, and timestamp (lines 367-373). This is appropriate for admin context but should be noted. | 365-373 |

#### What Is Great

- **No message content displayed** in the recent activity feed -- only metadata.
- **Rich operational metrics** without exposing user PII.
- **Audit log visibility** provides accountability.

---

## Cross-Cutting Concerns

### A. CSRF Protection

The application uses **origin/referer header checks** (`assertTrustedAdminRequest`) rather than traditional CSRF tokens. Analysis:

- Next.js Server Actions use POST requests, which include `Origin` headers in modern browsers.
- The `sameSite: 'lax'` cookie attribute provides additional protection.
- **Gap:** If both `Origin` and `Referer` are absent (possible with certain non-browser clients), the check passes. For admin endpoints, this should be hardened to require at least one.

### B. SQL Injection

- **No raw SQL anywhere.** All database operations use the Supabase client library's query builder, which parameterizes inputs. SQL injection risk is **effectively zero**.

### C. XSS

- **Server-rendered React components** automatically escape content.
- **No `dangerouslySetInnerHTML`** found in any of the reviewed files.
- **LLM output is sanitized** before being returned to the client (trimmed, length-limited, type-checked).
- **Message IDs are sanitized** through `sanitizeMessageId()`.
- XSS risk is **low**.

### D. Secret Management

| Secret | Storage | Exposure Risk |
|--------|---------|---------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server env (no `NEXT_PUBLIC_` prefix) | Low |
| `OPENROUTER_API_KEY` | Server env (no `NEXT_PUBLIC_` prefix) | Low |
| `ADMIN_PANEL_PASSWORD_HASH` | Server env | Low |
| `ADMIN_PANEL_PASSWORD` | Server env (plaintext fallback) | Medium -- should be removed |
| `ADMIN_PANEL_SESSION_SECRET` | Server env | Low |
| `NEXT_PUBLIC_SUPABASE_URL` | Public env | Expected |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public env | Expected |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Server env (implied by `@ai-sdk/google`) | Low |

### E. Error Handling

- **User-facing errors are generic** ("Quick hiccup on our side", "Invalid request payload").
- **Internal errors logged to console** with details.
- **No stack traces or internal paths** exposed to clients.
- **Admin pages show generic operation failure messages** without DB error details.

### F. Denial of Service Vectors

| Vector | Mitigation | Residual Risk |
|--------|------------|---------------|
| Chat API spam | Rate limiting (60/min auth, 20/min guest) | Medium -- in-memory fallback is per-instance |
| Analytics spam | Rate limiting (60/min per IP) | Medium -- same in-memory issue |
| Admin login brute-force | 5-attempt lockout, 15-min window | High -- in-memory, resets on deploy |
| LLM cost abuse | Daily message limits (80 free, 300 pro) | Medium -- guests have no daily limit, only rate limit |
| Memory compaction | Threshold-based, fire-and-forget | Low |

---

## What Is Great

1. **Comprehensive input validation with Zod** across all API endpoints and server actions. Schemas are strict with length limits, enum constraints, and type checks.

2. **Timing-safe credential comparison** in `auth.ts` using `crypto.timingSafeEqual` for both email and password verification.

3. **HMAC-SHA256 signed session cookies** with expiration, httpOnly, secure flags, and path scoping.

4. **Full admin audit logging** with actor email, IP, origin, referer, and user-agent for every administrative action.

5. **Dual-key brute-force protection** on admin login (per email+IP and per IP).

6. **LLM output sanitization** -- every AI-generated event is re-validated, trimmed, and capped before being returned to clients.

7. **Content safety system** with hard blocks (immediate rejection) and soft blocks (empathetic redirection).

8. **Abuse scoring** with progressive penalties and a threshold-based block.

9. **Supabase RLS compliance** -- user-facing operations use the anon key, admin operations use the service role key, and the two are never mixed.

10. **No raw SQL** -- all queries use parameterized Supabase client methods.

11. **IDOR prevention** -- memory and chat operations always filter by `user_id` from the authenticated session.

12. **Middleware-level admin route protection** ensures no admin page can be accessed without a valid session cookie.

13. **Atomic counter updates** via Supabase RPC to prevent race conditions on daily message counts.

14. **Duplicate message detection** before chat history insertion, preventing data pollution.

---

## Prioritized Recommendations

### CRITICAL

| # | Issue | File | Recommendation |
|---|-------|------|----------------|
| C-1 | **Timing side-channel in middleware signature comparison** | `src/proxy.ts:36` | Replace `!==` with a constant-time comparison. Since this runs in Edge Runtime (no Node.js `crypto.timingSafeEqual`), implement a constant-time comparison using a loop with XOR accumulation, or use the Web Crypto API's `subtle.verify` instead of manual comparison. Example fix: convert both strings to `Uint8Array` and XOR-compare byte by byte. |

### HIGH

| # | Issue | File | Recommendation |
|---|-------|------|----------------|
| H-1 | **SHA-256 without salt or key stretching for admin password** | `src/lib/admin/auth.ts:46` | Migrate to bcrypt, scrypt, or Argon2id for the password hash. At minimum, add a per-credential salt. If env-var-based hashing must remain, document the weakness and enforce a minimum password complexity requirement (24+ chars). |
| H-2 | **In-memory rate limiting ineffective in serverless** | `src/lib/rate-limit.ts:10-25` | Ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are **always** configured in production. Add a startup warning log if falling back to in-memory mode. Consider failing closed (rejecting requests) instead of failing open when Redis is unavailable. |
| H-3 | **In-memory login lockout ineffective in serverless** | `src/lib/admin/login-security.ts:11` | Move the `loginAttemptStore` to Redis (Upstash or similar). Alternatively, store attempt counts in a Supabase table with a TTL-based cleanup. The current implementation provides zero protection in a serverless multi-instance environment. |
| H-4 | **Open redirect risk in auth callback** | `src/app/auth/callback/route.ts:8-9` | Tighten the redirect validation: reject `next` values starting with `//`, containing `\`, or containing `:`. Better yet, use an allowlist: `const ALLOWED = new Set(['/post-auth', '/chat', '/settings'])` and reject anything not in the set. |

### MEDIUM

| # | Issue | File | Recommendation |
|---|-------|------|----------------|
| M-1 | **Guest (unauthenticated) LLM access** | `src/app/api/chat/route.ts:492-596` | Consider requiring authentication for chat API access to prevent anonymous cost abuse. If guest access is a product requirement, add: (a) stricter guest rate limits, (b) CAPTCHA for unauthenticated users after N requests, (c) IP reputation scoring. |
| M-2 | **CSRF protection gap when both Origin and Referer are absent** | `src/lib/admin/request-guard.ts:40-44` | Add a check: if both `originHost` and `refererHost` are null, return `false` for admin endpoints. This prevents requests from non-browser clients that strip both headers. |
| M-3 | **Plaintext admin password fallback** | `src/lib/admin/auth.ts:50-51` | Remove or deprecate the `ADMIN_PANEL_PASSWORD` plaintext fallback. Log a warning if it is used. Enforce `ADMIN_PANEL_PASSWORD_HASH` as the only supported mode. |
| M-4 | **Admin user page exposes user statistics** | `src/app/admin/(protected)/users/page.tsx` | Consider adding a confirmation dialog for destructive operations (Delete Chat History). The current implementation triggers immediately on button click. A server-side confirmation step or a two-phase action would reduce accidental data loss. |
| M-5 | **No rate limiting on server actions** | `src/app/auth/actions.ts`, `src/app/admin/actions.ts` | Server actions like `deleteAccount`, `signInOrSignUpWithPassword`, and admin mutations have no rate limiting. While admin actions require a session, the auth actions (sign-in/sign-up) could be abused. Add rate limiting to `signInOrSignUpWithPassword`. |

### LOW

| # | Issue | File | Recommendation |
|---|-------|------|----------------|
| L-1 | **Usage metadata in chat API response** | `src/app/api/chat/route.ts:1048-1054` | Remove or gate the `usage` block behind a debug flag. It leaks `promptChars`, `historyCount`, and `provider` to all clients. |
| L-2 | **Config status disclosure on admin login page** | `src/app/admin/login/page.tsx:143-147, 184-188` | Suppress the configuration hints (`ADMIN_PANEL_EMAIL` env var names) in production. Show them only when `NODE_ENV !== 'production'`. |
| L-3 | **`touchMemories` does not scope by user_id** | `src/lib/ai/memory.ts:145-153` | Add `.eq('user_id', userId)` to the `touchMemories` update query for defense-in-depth. Even with RLS, explicit scoping is a best practice. |
| L-4 | **No memory store cleanup** | `src/lib/rate-limit.ts:10`, `src/lib/admin/login-security.ts:11` | Add periodic cleanup (e.g., a setInterval every 5 minutes) to prune expired entries from both in-memory Maps. This prevents unbounded memory growth. |
| L-5 | **Session has no revocation mechanism** | `src/lib/admin/session.ts` | Consider maintaining a server-side session revocation list (e.g., in Redis or Supabase) to enable targeted session invalidation without rotating the global secret. |
| L-6 | **Middleware duplicates session verification logic** | `src/proxy.ts` vs `src/lib/admin/session.ts` | Refactor to share the verification logic, or at minimum ensure both implementations are tested identically. The current divergence already caused the timing side-channel in C-1. |
| L-7 | **Mock AI header in non-production** | `src/app/api/chat/route.ts:550-571` | Add a comment documenting this is intentional for testing. Consider using a more specific env var (e.g., `ENABLE_MOCK_AI=true`) instead of a request header that any client can set. |
| L-8 | **No Content-Security-Policy headers** | Middleware/headers | Add CSP headers to mitigate XSS risks. At minimum: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`. Configure in `next.config.js` or middleware. |

---

## Summary of Risk Scores

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 1 | Timing side-channel in middleware signature comparison |
| HIGH | 4 | SHA-256 password hash, in-memory rate limiting, in-memory login lockout, open redirect |
| MEDIUM | 5 | Guest LLM access, CSRF gap, plaintext password fallback, no confirmation for destructive ops, no rate limiting on auth actions |
| LOW | 8 | Usage metadata leak, config disclosure, unscoped touchMemories, memory cleanup, session revocation, code duplication, mock header, no CSP |

**Overall Security Posture: GOOD for a startup-stage application**, with actionable items that should be addressed before scaling to a larger user base. The CRITICAL timing side-channel and HIGH in-memory state issues should be fixed immediately.
