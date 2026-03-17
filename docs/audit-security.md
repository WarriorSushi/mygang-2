# Security Audit — MyGang Next.js AI Chat App

**Date:** 2026-03-17
**Auditor:** Claude (automated)
**Scope:** API routes, Supabase RLS, proxy/middleware, webhooks, CSP, auth flow, admin panel

---

## CRITICAL

### SEC-C1: `anon` role has full table privileges on all 13 public tables

**Severity:** CRITICAL
**Location:** Supabase database grants (all public tables)

**Description:**
The `anon` Postgres role has SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, and REFERENCES privileges on **every** public table, including security-sensitive tables like `admin_audit_log`, `admin_runtime_settings`, `billing_events`, `subscriptions`, `profiles`, and `memories`.

While RLS is enabled on all tables and policies do restrict access (e.g., `admin_audit_log` has `qual: "false"` blocking all non-service-role access), the `anon` role should never have write grants to tables it doesn't need. If any RLS policy is misconfigured or a new table is added without policies, an unauthenticated user with just the public anon key could read/write/truncate data.

Specific risks:
- `anon` has TRUNCATE on all tables — if RLS doesn't cover TRUNCATE (it does in Postgres, but this is defense-in-depth), data could be wiped
- `anon` has INSERT/UPDATE/DELETE on `billing_events`, `subscriptions`, `admin_audit_log` — these should be service-role-only writes
- `anon` has all privileges on `characters` — only SELECT is needed (characters are public read-only)

**Recommended fix:**
```sql
-- Revoke all from anon on admin/billing tables
REVOKE ALL ON admin_audit_log, admin_runtime_settings, billing_events, subscriptions FROM anon;
-- Grant only what's needed
GRANT SELECT ON characters TO anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON characters FROM anon;
-- For user-facing tables, revoke from anon entirely (only authenticated should access)
REVOKE ALL ON profiles, chat_history, memories, gangs, gang_members, push_subscriptions, squad_tier_members, analytics_events FROM anon;
```

---

## HIGH

### SEC-H1: `unsafe-eval` in Content-Security-Policy script-src

**Severity:** HIGH
**Location:** `next.config.ts:26`

**Description:**
The CSP includes `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. The `unsafe-eval` directive allows dynamic code execution in the browser via mechanisms like `Function()` constructors, which significantly weakens XSS protections. The codebase comment notes this is required by Lottie-web for animation expressions.

**Recommended fix:**
Replace Lottie-web with `lottie-light` (the light build that doesn't use dynamic code execution for expressions). If only simple animations are used (no Lottie expressions), the light build works identically. Then remove `'unsafe-eval'` from CSP.

---

### SEC-H2: `profiles` table UPDATE policy has no `with_check` clause — users can set their own subscription tier

**Severity:** HIGH
**Location:** Supabase RLS policy: `"Users can update their own profile"` (UPDATE on `profiles`)

**Description:**
The UPDATE policy on `profiles` has `qual: (id = auth.uid())` but no `WITH CHECK` clause. This means a user can update their own row and set `subscription_tier` to `'pro'` directly via the Supabase client SDK, bypassing billing entirely. Other sensitive columns like `abuse_score`, `dodo_customer_id`, `purchase_celebration_pending`, `daily_msg_count`, and `pending_squad_downgrade` are also freely writable.

A malicious user could simply call:
```js
supabase.from('profiles').update({ subscription_tier: 'pro' }).eq('id', myUserId)
```

**Recommended fix:**
Restrict which columns the `authenticated` role can UPDATE:
```sql
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (user_profile, relationship_state, session_summary, summary_turns, custom_character_names, preferred_squad, vibe_profile) ON profiles TO authenticated;
```

---

### SEC-H3: `billing_events` and `subscriptions` have excessive grants to `authenticated`

**Severity:** HIGH (defense-in-depth)
**Location:** Supabase database grants

**Description:**
The `authenticated` role has INSERT, UPDATE, DELETE, and TRUNCATE on `billing_events` and `subscriptions`. These tables only have SELECT RLS policies for users — writes are handled exclusively by the service role in webhook handlers. The grants are unnecessary and create risk if an RLS policy is added incorrectly.

**Recommended fix:**
```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON billing_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON subscriptions FROM authenticated;
```

---

## MEDIUM

### SEC-M1: CSP allows `unsafe-inline` for script-src

**Severity:** MEDIUM
**Location:** `next.config.ts:26`

**Description:**
`'unsafe-inline'` in `script-src` weakens XSS protections. The comment correctly notes this is required by Next.js since it injects inline scripts without nonce support. This is a known Next.js limitation.

**Recommended fix:**
Monitor Next.js for nonce-based CSP support. When available, switch to nonce-based CSP and remove `'unsafe-inline'`.

---

### SEC-M2: Admin session falls back to stateless mode when Redis is unavailable

**Severity:** MEDIUM
**Location:** `src/lib/admin/session.ts:146`

**Description:**
When Redis is unavailable, `getAdminSession()` falls back to stateless validation (line 146: `// If Redis unavailable, fall back to stateless`). This means session revocation (`revokeAllAdminSessions`) is ineffective — a signed token remains valid until expiry (12 hours). In production, if Redis goes down, a revoked admin session would still work.

**Recommended fix:**
Consider shorter session TTLs (e.g., 1 hour) as a fallback safety net, or fail closed for admin sessions when Redis is unavailable in production (similar to the rate limiter's fail-closed behavior).

---

### SEC-M3: `chat_history` UPDATE policy missing `with_check`

**Severity:** MEDIUM
**Location:** Supabase RLS policy: `"Users can update their chat history"`

**Description:**
The UPDATE policy on `chat_history` has `qual: (user_id = auth.uid())` but no `WITH CHECK`. A user could update their own chat history row to change the `user_id` to another user's ID (if no DB constraint prevents it), effectively moving messages into another user's visible history.

**Recommended fix:**
```sql
DROP POLICY "Users can update their chat history" ON chat_history;
CREATE POLICY "Users can update their chat history" ON chat_history
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

### SEC-M4: Webhook handler logs customer email to console

**Severity:** MEDIUM
**Location:** `src/app/api/webhook/dodo-payments/route.ts:179`

**Description:**
Line 179: `console.log(...)` logs customer email addresses to server logs. If logs are stored in a third-party service (Vercel, Sentry), this constitutes PII leakage to log aggregation services.

**Recommended fix:**
Mask the email in logs or log only a hash of it.

---

### SEC-M5: `squad_tier_members` UPDATE policy missing `with_check`

**Severity:** MEDIUM
**Location:** Supabase RLS policy: `"Users can update own squad_tier_members"`

**Description:**
Same pattern as SEC-M3 — UPDATE policy without `WITH CHECK` allows row ownership transfer.

**Recommended fix:**
Add `WITH CHECK (user_id = auth.uid())` to the UPDATE policy.

---

## LOW

### SEC-L1: `connect-src` CSP allows broad Supabase wildcard

**Severity:** LOW
**Location:** `next.config.ts:26`

**Description:**
CSP connect-src includes `https://*.supabase.co wss://*.supabase.co` which allows connections to any Supabase project, not just your own. An XSS payload could exfiltrate data to an attacker-controlled Supabase project.

**Recommended fix:**
Restrict to your specific project: `https://xiekctfhbqkhoqplobep.supabase.co wss://xiekctfhbqkhoqplobep.supabase.co`

---

### SEC-L2: `img-src` allows `https:` wildcard

**Severity:** LOW
**Location:** `next.config.ts:26`

**Description:**
`img-src 'self' data: blob: https:` allows loading images from any HTTPS source. Could be used for tracking pixels in an XSS context.

**Recommended fix:**
If external images aren't needed, restrict to `'self' data: blob:`.

---

### SEC-L3: Sentry org name exposed in config

**Severity:** LOW
**Location:** `next.config.ts:46`

**Description:**
`org: "altcorp"` and `project: "mygang-ai"` are in the build config. This is public information but gives attackers context for targeted reconnaissance.

No action needed — this is standard Sentry configuration.

---

## PASSED (No Issues Found)

### Auth Flow
- All API routes check `supabase.auth.getUser()` before processing (verified in: `chat/route.ts`, `checkout/route.ts`, `checkout/activate/route.ts`, `analytics/route.ts`, `chat/rendered/route.ts`, `customer-portal/route.ts`, `push/subscription/route.ts`)
- Proxy correctly guards protected routes (`src/proxy.ts:111`)
- Session cookies use `httpOnly: true`, `secure` in production, `sameSite: 'strict'` (`src/lib/admin/session.ts:98-104`)

### Rate Limiting
- All API routes have rate limiting with per-user keys
- Rate limiter fails closed in production without Redis (`src/lib/rate-limit.ts:47-50`)
- Admin login has brute-force protection with lockout (`src/lib/admin/login-security.ts`)

### Webhook Signature Validation
- Dodo Payments webhook uses `@dodopayments/nextjs` `Webhooks()` helper which handles signature verification (`src/app/api/webhook/dodo-payments/route.ts:153`)
- CRON endpoint validates `Bearer` token against `CRON_SECRET` (`src/app/api/internal/wywa/route.ts:26`)

### Admin Panel Security
- CSRF protection via origin/referer checking (`src/lib/admin/request-guard.ts:34-47`)
- Admin session uses HMAC-SHA256 with constant-time comparison (`src/lib/admin/session.ts:67`)
- Admin credentials use PBKDF2 with 100,000 iterations (`src/lib/admin/auth.ts:38`)
- All admin actions require `requireAdminSession()` + `assertTrustedAdminRequest()`
- Input validation with UUID checks and tier sanitization (`src/app/admin/actions.ts:31-37`)
- Full audit logging of all admin actions

### Input Validation
- All API routes use Zod schemas for input validation
- Message content is truncated to safe limits
- `sanitizeMessageId()` used consistently
- Abuse scoring with content safety detection

### RLS Coverage
- All 13 public tables have RLS enabled
- All user-facing tables have proper `auth.uid()` policies
- Admin tables (`admin_audit_log`, `admin_runtime_settings`) have `qual: "false"` blocking all non-service-role access

### IDOR Prevention
- Customer portal uses server-side customer ID lookup, not client-supplied (`src/app/api/customer-portal/route.ts:32-38`)
- Checkout activate verifies subscription ownership via customer ID matching (`src/app/api/checkout/activate/route.ts:148`)
- All database queries filter by `user.id` from auth session

### Environment Validation
- All env vars validated at import time in production via Zod schema (`src/lib/env.ts:41-43`)
- ADMIN_PANEL_SESSION_SECRET requires minimum 32 characters

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1     |
| High     | 3     |
| Medium   | 5     |
| Low      | 3     |
| Passed   | 9 categories |

**Priority actions:**
1. **SEC-C1** — Revoke excessive `anon` grants immediately. This is the biggest attack surface.
2. **SEC-H2** — Restrict `profiles` UPDATE columns. Users can currently self-promote to `pro` tier via the Supabase client.
3. **SEC-H3** — Revoke write grants on `billing_events`/`subscriptions` from `authenticated`.
4. **SEC-M3/M5** — Add `WITH CHECK` to UPDATE policies missing them.
