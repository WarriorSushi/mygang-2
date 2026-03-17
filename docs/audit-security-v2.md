# Security Audit v2 — MyGang Next.js AI Chat App

**Date:** 2026-03-18
**Auditor:** Claude (automated)
**Scope:** API routes, Supabase RLS/grants, proxy, webhooks, CSP, auth flow, admin panel, new components
**Previous audit:** `docs/audit-security.md` (2026-03-17)

---

## Status of v1 Issues

| v1 ID | Status | Notes |
|-------|--------|-------|
| SEC-C1 | **FIXED** | `anon` role stripped of all grants except SELECT on `characters`. Verified: only `anon/characters/SELECT` remains. |
| SEC-H1 | **NOT FIXED** | `unsafe-eval` still in CSP (line 26 of `next.config.ts`). Comment says "removed" but the actual CSP string still contains it. |
| SEC-H2 | **NOT FIXED** | `profiles` UPDATE policy still has no `WITH CHECK`. Users can still set `subscription_tier`, `abuse_score`, `daily_msg_count` etc. via Supabase client SDK. |
| SEC-H3 | **PARTIALLY FIXED** | `billing_events` and `subscriptions` had INSERT/UPDATE/DELETE revoked from `authenticated`. However, `billing_events` still has TRIGGER grant, and `authenticated` still has full TRUNCATE/TRIGGER grants on most other tables. |
| SEC-M1 | **ACCEPTED** | `unsafe-inline` still needed for Next.js -- no change available. |
| SEC-M2 | **FIXED** | Admin session now fails closed in production when Redis is unavailable (`session.ts:148`). |
| SEC-M3 | **FIXED** | `chat_history` UPDATE policy now has `WITH CHECK (user_id = auth.uid())`. Verified in live policies. |
| SEC-M4 | **PARTIALLY FIXED** | Webhook now masks email (`charAt(0) + '***@' + domain`) on line 178. But `findUserByEmailFallback` still logs userId on backfill (line 65) -- acceptable since user IDs are not PII. |
| SEC-M5 | **FIXED** | `squad_tier_members` UPDATE policy now has `WITH CHECK (user_id = auth.uid())`. Verified. |
| SEC-L1 | **FIXED** | CSP `connect-src` now scoped to `https://xiekctfhbqkhoqplobep.supabase.co`. |
| SEC-L2 | **NOT FIXED** | `img-src` still allows `https:` wildcard. Low priority. |
| SEC-L3 | **ACCEPTED** | Sentry org/project names are public by design. |

---

## NEW ISSUES

### HIGH

#### SEC-V2-H1: `profiles` UPDATE policy still allows subscription tier self-promotion

**Severity:** HIGH
**Location:** Supabase RLS policy `"Users can update their own profile"` (UPDATE on `profiles`)
**Carried from:** SEC-H2 (v1)

The UPDATE policy on `profiles` has `qual: (id = auth.uid())` but **no `WITH CHECK`** and no column-level grants restricting which columns `authenticated` can write. A malicious user can call:

```js
supabase.from('profiles').update({ subscription_tier: 'pro', abuse_score: 0 }).eq('id', myUserId)
```

This bypasses billing entirely. The `authenticated` role has UPDATE grant on the full table (no column restriction).

**Impact:** Users can self-promote to Pro tier, reset abuse scores, manipulate `daily_msg_count`, set `dodo_customer_id` to hijack another customer's billing portal.

**Recommended fix:**
```sql
-- Option A: Column-level grants (preferred)
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (username, user_profile, relationship_state, session_summary, summary_turns,
  custom_character_names, preferred_squad, vibe_profile, theme, chat_mode, chat_wallpaper,
  low_cost_mode, onboarding_completed, avatar_style_preference, last_active_at) ON profiles TO authenticated;

-- Option B: WITH CHECK that blocks sensitive columns (less robust)
```

---

#### SEC-V2-H2: `subscriptions` CHECK constraint rejects valid webhook statuses

**Severity:** HIGH (data integrity / billing failure)
**Location:** `public.subscriptions.status` CHECK constraint

The CHECK constraint allows: `pending`, `active`, `on_hold`, `cancelled`, `expired`.

But the webhook handler (`src/app/api/webhook/dodo-payments/route.ts`) writes these statuses:
- `cancelled_pending` (line 324) -- written on subscription cancellation
- `refunded` (line 404) -- written on refund
- `disputed` (line 431) -- written on dispute

These writes will **fail with a CHECK constraint violation**, meaning:
1. Cancelled subscriptions are not recorded correctly
2. Refunded users keep their paid tier (downgrade to free happens but subscription record fails)
3. Disputed subscriptions are not marked

**Recommended fix:**
```sql
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY['pending', 'active', 'on_hold', 'cancelled', 'cancelled_pending', 'expired', 'refunded', 'disputed']));
```

---

#### SEC-V2-H3: `unsafe-eval` still present in CSP despite comment saying it was removed

**Severity:** HIGH
**Location:** `next.config.ts:26`
**Carried from:** SEC-H1 (v1)

The comment on line 21 says "unsafe-eval has been removed" but line 26 still contains `'unsafe-eval'` in the CSP `script-src` directive. This allows dynamic code execution in the browser (Function constructor, etc.), significantly weakening XSS protections.

**Recommended fix:** Either actually remove `'unsafe-eval'` from the CSP string, or if Lottie still requires it (line 24 comment), update the comment to be accurate and switch to `lottie-light`.

---

### MEDIUM

#### SEC-V2-M1: `authenticated` role has TRUNCATE grant on 10 tables

**Severity:** MEDIUM (defense-in-depth)
**Location:** Supabase database grants

The `authenticated` role has TRUNCATE privilege on: `admin_audit_log`, `admin_runtime_settings`, `analytics_events`, `characters`, `chat_history`, `gang_members`, `gangs`, `memories`, `push_subscriptions`, `squad_tier_members`.

While RLS policies block unauthorized access, TRUNCATE bypasses RLS in some edge cases. The `authenticated` role should never need TRUNCATE.

**Recommended fix:**
```sql
REVOKE TRUNCATE ON admin_audit_log, admin_runtime_settings, analytics_events, characters,
  chat_history, gang_members, gangs, memories, push_subscriptions, squad_tier_members
  FROM authenticated;
```

---

#### SEC-V2-M2: `authenticated` has full write grants on `admin_audit_log` and `admin_runtime_settings`

**Severity:** MEDIUM (defense-in-depth)
**Location:** Supabase database grants

Despite RLS policies blocking access (`qual: "false"`), the `authenticated` role has SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, and REFERENCES on both admin tables. If the RLS policy is ever changed or dropped, any authenticated user could read/write admin audit logs and runtime settings.

**Recommended fix:**
```sql
REVOKE ALL ON admin_audit_log, admin_runtime_settings FROM authenticated;
```

---

#### SEC-V2-M3: `authenticated` has INSERT/UPDATE/DELETE on `characters` table

**Severity:** MEDIUM
**Location:** Supabase database grants

Characters are read-only data. The `authenticated` role has INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER on `characters`. The only RLS policy is SELECT (`qual: "true"`), meaning no INSERT/UPDATE/DELETE policy exists -- writes are implicitly denied by RLS. But this should be locked at the grant level.

**Recommended fix:**
```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON characters FROM authenticated;
```

---

#### SEC-V2-M4: `gang_members` ALL policy missing `WITH CHECK`

**Severity:** MEDIUM
**Location:** RLS policy `"Users can manage their gang members"` on `gang_members`

This ALL policy has `qual` checking gang ownership via EXISTS subquery but no `WITH CHECK`. On INSERT or UPDATE, a user could potentially insert a row pointing to a `gang_id` they don't own (the USING clause only filters reads on ALL policies; for INSERT, WITH CHECK is needed).

**Recommended fix:**
```sql
DROP POLICY "Users can manage their gang members" ON gang_members;
CREATE POLICY "Users can manage their gang members" ON gang_members
  FOR ALL USING (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = auth.uid()));
```

---

#### SEC-V2-M5: `gangs` ALL policy missing `WITH CHECK`

**Severity:** MEDIUM
**Location:** RLS policy `"Users can manage their own gang"` on `gangs`

Same pattern. The ALL policy has `qual: (user_id = auth.uid())` but no `WITH CHECK`. A user could INSERT a gang row with a different `user_id`.

**Recommended fix:**
```sql
DROP POLICY "Users can manage their own gang" ON gangs;
CREATE POLICY "Users can manage their own gang" ON gangs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

#### SEC-V2-M6: `memories` ALL policy missing `WITH CHECK`

**Severity:** MEDIUM
**Location:** RLS policy `"Users can manage their memories"` on `memories`

Same pattern as M4/M5. The ALL policy has no WITH CHECK, allowing a user to INSERT a memory with another user's `user_id`.

**Recommended fix:**
```sql
DROP POLICY "Users can manage their memories" ON memories;
CREATE POLICY "Users can manage their memories" ON memories
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

### LOW

#### SEC-V2-L1: `img-src` allows `https:` wildcard in CSP

**Severity:** LOW
**Location:** `next.config.ts:26`
**Carried from:** SEC-L2 (v1)

Allows loading images from any HTTPS source. Could be used for tracking pixels in an XSS context.

---

#### SEC-V2-L2: `profiles` has DELETE grant for `authenticated` but no DELETE RLS policy

**Severity:** LOW
**Location:** Supabase grants/policies on `profiles`

The `authenticated` role has DELETE privilege on `profiles`, but there is no DELETE RLS policy. This means DELETE is implicitly denied by RLS (correct behavior). However, the grant is unnecessary and should be revoked for defense-in-depth.

---

#### SEC-V2-L3: CRON endpoint timing-based secret comparison

**Severity:** LOW
**Location:** `src/app/api/internal/wywa/route.ts:26`

The CRON_SECRET comparison uses `!==` (line 26: `if (authHeader !== 'Bearer ${cronSecret}')`), which is not constant-time. A sophisticated attacker could theoretically determine the secret character-by-character via timing analysis, though this is extremely difficult over network.

**Recommended fix:** Use `crypto.timingSafeEqual` for the comparison.

---

## PASSED (No Issues Found)

### API Route Authentication
- All 9 API routes verified: every one calls `supabase.auth.getUser()` before processing
- No unauthenticated access possible to user data endpoints
- Webhook route uses `@dodopayments/nextjs` `Webhooks()` for signature verification

### Rate Limiting
- All API routes have per-user rate limiting via Upstash Redis
- Rate limiter fails closed in production without Redis
- All server actions in `src/app/auth/actions.ts` have rate limiting
- Admin login has brute-force protection with IP + email lockout

### Proxy / Route Protection
- `src/proxy.ts` correctly guards all protected routes
- Admin routes require valid session token (HMAC-SHA256 verified)
- Public content routes (`/about`, `/terms`, `/privacy`, `/refund`, `/pricing`) correctly excluded
- Admin login page excluded from protection (allows access to login form)

### Admin Panel Security
- CSRF protection via origin/referer checking in `assertTrustedAdminRequest()`
- Denies requests when both Origin and Referer are absent (blocks curl-based CSRF)
- Admin credentials use PBKDF2 with 100,000 iterations and random 32-byte salt
- Session uses HMAC-SHA256 with `crypto.timingSafeEqual`
- Session cookie: `httpOnly`, `secure` in production, `sameSite: strict`, path-scoped to `/admin`
- All admin actions require both `requireAdminSession()` and `assertTrustedAdminRequest()`
- Input validation with UUID regex and tier sanitization on all admin actions
- Full audit logging with request metadata (IP, origin, referer, user-agent)
- Session revocation via Redis with fail-closed in production

### Auth Flow
- Google OAuth uses server-side redirect (no token leakage)
- Password auth has rate limiting on email
- Account deletion uses admin client, requires auth, rate limited
- Sign-up correctly hides user enumeration ("Invalid email or password" for existing users)

### Webhook Security
- Dodo Payments webhook signature verification via `Webhooks()` helper
- Idempotency via `dodo_event_id` unique constraint with `ON CONFLICT` pattern
- CRON endpoint validates Bearer token against `CRON_SECRET`
- Customer ID ownership verified server-side (not client-supplied)

### IDOR Prevention
- Customer portal looks up `dodo_customer_id` from authenticated user's profile
- Checkout activate verifies subscription ownership via customer ID matching
- All database queries scoped to `user.id` from auth session

### Input Validation
- Zod schemas on all API route inputs
- Content length limits enforced
- `sanitizeMessageId()` used consistently
- `userSettingsSchema` uses `.strict()` to reject unknown keys
- Squad changes validate character IDs against allowlist and enforce tier limits server-side

### New Components
- **`pwa-install-prompt.tsx`**: Pure client-side, uses browser `beforeinstallprompt` API. No security concerns.
- **`avatar-lightbox.tsx`**: Uses `next/image` for avatar rendering (safe against image injection). Focus trap implemented correctly. No `dangerouslySetInnerHTML`.

### Cookie Settings
- Admin session: httpOnly, secure (prod), sameSite strict, path-scoped
- Supabase auth cookies: managed by `@supabase/ssr` (secure defaults)

### Environment Validation
- All env vars validated at import time via Zod schema (`src/lib/env.ts`)
- `ADMIN_PANEL_SESSION_SECRET` requires minimum 32 characters

---

## Summary

| Severity | Count | New | Carried from v1 |
|----------|-------|-----|-----------------|
| Critical | 0     | 0   | 0               |
| High     | 3     | 1   | 2               |
| Medium   | 6     | 5   | 1 (M1)          |
| Low      | 3     | 2   | 1               |
| Passed   | 12 categories | -- | -- |

### v1 Fix Rate
- 6 of 12 v1 issues fully fixed
- 2 partially fixed
- 2 not fixed (carried forward)
- 2 accepted/won't fix

### Priority Actions
1. **SEC-V2-H1** -- Restrict `profiles` UPDATE column grants. Users can currently self-promote to Pro tier. This is the most critical remaining issue.
2. **SEC-V2-H2** -- Fix `subscriptions` status CHECK constraint. Webhook handlers are silently failing on cancellation/refund/dispute events.
3. **SEC-V2-H3** -- Remove `unsafe-eval` from CSP or update misleading comment.
4. **SEC-V2-M2** -- Revoke all grants on admin tables from `authenticated`.
5. **SEC-V2-M4/M5/M6** -- Add `WITH CHECK` to ALL policies on `gang_members`, `gangs`, `memories`.
