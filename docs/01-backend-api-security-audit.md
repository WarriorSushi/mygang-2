# Backend, API & Security Audit Report

**Project:** MyGang by Antig
**Date:** 2026-02-16
**Auditor:** Claude Opus 4.6

---

## CRITICAL Issues

### 1. CRITICAL: All API Keys and Secrets Exposed in `.env.local`

**File:** `.env.local` (lines 1-19)

The `.env.local` file contains production credentials in plain text:
- Supabase service role key (line 4) -- full admin access to the database
- Google Generative AI API key (line 7)
- OpenRouter API key (line 10)
- Admin panel email, password hash, and session secret (lines 16-18)

While `.env.local` is in `.gitignore` and was never committed, these are real production keys visible to anyone with filesystem access. The **service role key** grants unrestricted database access -- if it leaks (e.g., via a build artifact, error log, or misconfigured deployment), the entire database is compromised.

**Recommendation:** Rotate all keys immediately if there is any chance of prior exposure. Use a secrets manager (Vercel env vars, AWS Secrets Manager, etc.) rather than local files for production.

### 2. CRITICAL: Admin Session Secret Falls Back to Password Hash/Plaintext Password

**File:** `src/lib/admin/session.ts` (lines 13-18)

```typescript
function getSessionSecret() {
    const explicit = process.env.ADMIN_PANEL_SESSION_SECRET?.trim()
    if (explicit) return explicit
    return process.env.ADMIN_PANEL_PASSWORD_HASH?.trim()
        || process.env.ADMIN_PANEL_PASSWORD?.trim()
        || null
}
```

If `ADMIN_PANEL_SESSION_SECRET` is not set, the function falls back to using the password hash or even the plaintext password as the HMAC signing secret. This reduces security isolation and means the admin password itself could become the session signing key.

### 3. CRITICAL: No Middleware File Exists -- `proxy.ts` Is Dead Code

**File:** `src/proxy.ts`

This file exports a `proxy` function and a `config` matcher for admin route protection, but there is **no `middleware.ts`** file in the project. Next.js requires a file named `middleware.ts` for middleware to execute. This means:
- **Admin routes have NO edge-level protection.** Anyone can navigate to `/admin/overview`, `/admin/users`, etc.
- The server actions within those pages do check `requireAdminSession()`, so data is still protected, but the pages themselves may render.

**Recommendation:** Rename `src/proxy.ts` to `src/middleware.ts` and export as `middleware`.

---

## HIGH Issues

### 4. HIGH: Admin Password Supports Unsalted SHA-256 and Plaintext Mode

**File:** `src/lib/admin/auth.ts` (lines 34-57)

- **Unsalted SHA-256** is not suitable for password hashing. Vulnerable to rainbow table attacks. Use bcrypt/scrypt/Argon2.
- The plaintext password mode stores the password as-is in an env var.
- Line 47: The function also accepts a pre-hashed input directly (pass-the-hash vulnerability).

### 5. HIGH: `x-mock-ai` Header Bypasses LLM Call Without Authentication

**File:** `src/app/api/chat/route.ts` (lines 622-644)

The mock bypass is checked **before** authentication, rate limiting, and all safety checks. Any unauthenticated user can send `x-mock-ai: true` to get a response without triggering any security controls.

**Recommendation:** Remove this in production, or gate behind `NODE_ENV !== 'production'`.

### 6. HIGH: Chat API Allows Unauthenticated Access with Reduced Rate Limits

**File:** `src/app/api/chat/route.ts` (lines 646-666)

The chat route proceeds even when `user` is null. Unauthenticated users get:
- IP-based rate limiting (20 req/min) -- easily bypassed with rotating IPs
- Full LLM access (Gemini + OpenRouter fallback)
- No daily message limits
- No abuse scoring

Anyone can consume LLM API credits without an account, potentially causing significant cost.

### 7. HIGH: In-Memory Rate Limiting in Serverless Environment

**File:** `src/lib/rate-limit.ts` (lines 10-25)

When Upstash Redis credentials are not configured, rate limiting falls back to an in-memory `Map`. In serverless (Vercel), each invocation can run in a separate instance, meaning rate limits are not shared. The `Map` also grows unboundedly.

Similarly, **admin login lockout** (`src/lib/admin/login-security.ts`) uses an in-memory `Map` with the same problems.

### 8. HIGH: LLM Provider Cooldown State Stored in Module-Level Variables

**File:** `src/app/api/chat/route.ts` (lines 38-43)

Module-level `geminiCooldownUntil` and `openRouterCooldownUntil` reset on each cold start. Cooldowns are not effective across serverless instances.

### 9. HIGH: `updateUserSettings` Has No Input Validation

**File:** `src/app/auth/actions.ts` (lines 380-391)

The `settings` object is passed directly to Supabase `.update()` with no validation. Server actions receive arbitrary input at runtime. Should be validated with Zod.

### 10. HIGH: `saveUsername` and `saveMemoryManual` Have No Input Validation

**File:** `src/app/auth/actions.ts`

- `saveUsername` (line 190): Accepts any string with no length limit.
- `saveMemoryManual` (line 411): Accepts any string as `content` with no length limit.

---

## MEDIUM Issues

### 11. MEDIUM: OAuth Callback `next` Parameter Allows Open Redirect Within App

**File:** `src/app/auth/callback/route.ts` (lines 8-9)

Only verifies path starts with `/`. A path like `//evil.com` could potentially be interpreted as protocol-relative.

### 12. MEDIUM: Admin CSRF Protection Relies Only on Origin/Referer Headers

**File:** `src/lib/admin/request-guard.ts` (lines 34-44)

Returns `true` when both `origin` and `referer` headers are absent. No proper CSRF token mechanism.

### 13. MEDIUM: `signInOrSignUpWithPassword` Auto-Creates Accounts on Failed Login

**File:** `src/app/auth/actions.ts` (lines 60-106)

Any email address can create an account without explicit consent. Could facilitate account enumeration.

### 14. MEDIUM: `saveGang` Does Not Validate Character IDs

**File:** `src/app/auth/actions.ts` (lines 130-164)

Accepts any strings and writes them to the database without validation against `CHARACTERS`.

### 15. MEDIUM: No Content-Security-Policy Header

**File:** `next.config.ts`

Good security headers exist, but no CSP. Leaves application more vulnerable to XSS.

### 16. MEDIUM: Character Prompt Block Cache Never Invalidates

**File:** `src/app/api/chat/route.ts` (lines 52, 174-195)

Once loaded, `cachedDbPromptBlocks` is never invalidated. Changes require a cold restart.

### 17. MEDIUM: Analytics Route Has No Rate Limiting

**File:** `src/app/api/analytics/route.ts`

An attacker could flood the analytics_events table with arbitrary data.

### 18. MEDIUM: `deleteAccount` Throws Raw Error to Client

**File:** `src/app/auth/actions.ts` (lines 114-128)

Raw Supabase error thrown directly, could leak internal details.

---

## LOW Issues

### 19. LOW: `post-auth/page.tsx` Uses `getSession()` Instead of `getUser()`
### 20. LOW: Duplicated Utility Functions Across Files
### 21. LOW: `client-journey.ts` Marked `'use client'` but Contains Only Data Fetching
### 22. LOW: Non-Null Assertions on Environment Variables
### 23. LOW: `getOrigin()` Trusts the `Origin` Header
### 24. LOW: In-Memory Login Attempt Store Never Cleans Up
### 25. LOW: `metadata` Field in Analytics Accepts `z.record(z.unknown())`

---

## Summary Table

| Severity | Count | Key Areas |
|----------|-------|-----------|
| CRITICAL | 3 | Exposed secrets, session secret fallback, dead middleware |
| HIGH | 7 | Pass-the-hash, mock bypass, no auth on chat, memory rate limiting, no input validation |
| MEDIUM | 8 | Open redirect, weak CSRF, auto-signup, no CSP, stale cache, no analytics rate limit |
| LOW | 7 | getSession vs getUser, code duplication, memory leaks, non-null assertions |

---

## Priority Recommendations

1. **Immediately** rename `src/proxy.ts` to `src/middleware.ts` and export as `middleware`.
2. **Immediately** remove or gate the `x-mock-ai` header behind a development-only check.
3. **Immediately** fix the pass-the-hash vulnerability in `verifyAdminCredentials`.
4. **Short-term** add Zod validation to all server actions.
5. **Short-term** require authentication for the chat API route or implement robust unauthenticated rate-limiting (require Upstash Redis in production).
6. **Short-term** migrate admin password hashing from SHA-256 to bcrypt/scrypt/Argon2.
7. **Medium-term** add a Content-Security-Policy header.
8. **Medium-term** add rate limiting to the analytics route.
9. **Medium-term** add TTL-based expiration to the `cachedDbPromptBlocks` cache.
10. **Rotate all API keys** if there is any possibility they were exposed.
