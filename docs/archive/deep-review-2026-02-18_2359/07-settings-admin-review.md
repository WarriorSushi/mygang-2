# Deep Review: Settings Panel, Admin Dashboard & Auxiliary Pages

**Reviewer:** Senior Full-Stack Review
**Date:** 2026-02-18
**Scope:** Settings UX, Admin Dashboard, Admin Auth, Form Handling, Auxiliary Pages, Routing, Responsive Design

---

## Executive Summary

The settings panel, admin dashboard, and auxiliary pages form a mature, security-conscious subsystem. The admin dashboard in particular shows thoughtful engineering: HMAC-signed session cookies, brute-force protection with IP+email dual lockout, timing-safe comparisons, origin checking, and a full audit log. The settings panel is clean but thin. Auxiliary legal pages (privacy, terms) are impressively comprehensive. Several gaps exist around form feedback, confirmation dialogs, pagination, and mobile edge cases.

**Overall Grade: B+**

---

## 1. SETTINGS UX

### Files Reviewed
- `src/components/settings/settings-panel.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/layout.tsx`
- `src/app/settings/loading.tsx`
- `src/app/settings/error.tsx`

### What's GREAT

1. **Clean section-based layout.** Each concern (Account, Usage, Performance, Cost Control, Account Actions) is its own visually distinct card with consistent styling (rounded-3xl borders, muted backgrounds).

2. **Theme toggle is immediate.** Calls `setTheme()` optimistically while also persisting via `updateUserSettings()`. No jarring delay.

3. **Low-Cost Mode syncs both client and server.** Updates zustand store *and* calls `updateUserSettings()` -- good dual-write pattern that keeps the client responsive.

4. **Loading and error boundaries exist.** `loading.tsx` shows a spinner; `error.tsx` provides "Try again" + "Back to chat" options. Proper `'use client'` directive on error boundary.

5. **Layout has `robots: { index: false, follow: false }`.** Settings correctly excluded from search engines.

6. **Safe-area insets handled** in the page's padding (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).

7. **Legal & Info section** links to About, Privacy, and Terms directly from settings. Good discoverability.

### What's BUGGY or GLITCHY

1. **No feedback on `updateUserSettings()` failure (CRITICAL).** Both `handleTheme` and `handleLowCostModeToggle` call `updateUserSettings()` fire-and-forget. If the server action fails, the UI shows the new state but the database still has the old value. On next page load, the setting reverts silently.

   ```tsx
   // settings-panel.tsx line 42 -- no await, no error handling
   updateUserSettings({ theme: nextTheme })
   ```

2. **`deleteAccount()` uses `confirm()` which is blocked in some contexts.** On iOS Safari in PWA mode, `window.confirm()` may not work. The user could trigger account deletion without seeing the dialog.

3. **Sign-out clears many store fields but the order is fragile.** If `signOut()` throws (network error), the store is already wiped but the user remains authenticated. The store clearing should happen *after* successful sign-out, or the page should handle the error state.

   ```tsx
   // lines 143-155 -- store wiped before signOut() resolves
   store.setUserId(null)
   store.setIsGuest(true)
   // ... many more clears ...
   await signOut()  // if this fails, store is already destroyed
   ```

4. **Production monitoring toggle is always disabled in development.** The `disabled={!isProd}` logic means developers can never test this toggle's UX during local development. Consider a dev override.

### What's MISSING

1. **No username/display name editing.** Users can see their username but cannot change it from settings.

2. **No email display or change option.** Email is shown read-only with no ability to update.

3. **No notification preferences.** If the app ever adds push notifications or email digests, there's no place for them.

4. **No password change / linked accounts management.** If users signed up with email+password, there's no way to change the password from settings.

5. **No "system" theme option.** Only dark/light are available -- no "follow system preference" which is standard in modern apps.

6. **No confirmation toast/banner after settings save.** Theme and low-cost mode changes happen silently with no visual confirmation.

7. **No data export option.** GDPR/CCPA compliance is referenced in the privacy policy but there's no self-service data export.

8. **Usage section is static on page load.** If the user sends messages in another tab, the daily count shown in settings becomes stale with no auto-refresh.

### IMPROVEMENTS Recommended

| Priority | Improvement |
|----------|-------------|
| P0 | Add error handling + toast feedback for `updateUserSettings()` calls |
| P0 | Move store clearing to *after* successful `signOut()` |
| P1 | Replace `window.confirm()` with a custom modal for account deletion |
| P1 | Add a "System" theme option alongside Dark/Light |
| P2 | Add username editing capability |
| P2 | Add success toast when settings changes are persisted |
| P3 | Add data export button for GDPR compliance |

---

## 2. ADMIN DASHBOARD

### Files Reviewed
- `src/app/admin/page.tsx`
- `src/app/admin/(protected)/layout.tsx`
- `src/app/admin/(protected)/overview/page.tsx`
- `src/app/admin/(protected)/users/page.tsx`
- `src/app/admin/actions.ts`

### What's GREAT

1. **Comprehensive audit logging.** Every admin action (tier change, low-cost toggle, daily reset, history deletion, global override) writes to `admin_audit_log` with actor email, IP, origin, referer, and user-agent. This is production-grade auditability.

2. **Full request metadata captured.** `getAdminRequestMeta()` extracts IP (from x-forwarded-for/x-real-ip), origin, referer, host, and user-agent for every action. Excellent forensics capability.

3. **Input validation is thorough.** `isUuid()` validates user IDs with a proper regex. `sanitizeTier()` whitelists only 'free' or 'pro'. `parseReturnTo()` whitelists only two allowed redirect paths -- no open redirect vulnerability.

4. **Previous-state capture before mutations.** Every update action reads the current value first and logs both `previous` and `next` in the audit trail. This enables audit rollback reasoning.

5. **Overview dashboard is data-rich.** Shows users (total, pro, low-cost), chat rows, active users (24h), memories, route health metrics (429s, 500s, avg latency), source/provider mix, recent chat activity, and audit log -- all on one page.

6. **Quick operations panel** for global controls (enable/disable low-cost for all, reset daily counters) with clear labeling.

7. **Protected layout** calls `requireAdminSession()` which redirects unauthorized users. Clean separation of auth concern at the layout level.

8. **Error resilience.** The overview page gracefully handles missing tables (`PGRST205`, `42P01` error codes excluded from the error flag). New installations won't crash if `admin_runtime_settings` or `analytics_events` tables don't exist yet.

9. **The admin nav** shows the signed-in admin email in a badge. Sign-out is always visible.

### What's BUGGY or GLITCHY

1. **N+1 query problem in Users page (PERFORMANCE).** For each of up to 40 users, an individual `SELECT count(*)` query is executed against `chat_history`:

   ```tsx
   // users/page.tsx lines 104-112
   userIds.map(async (userId) => {
       const { count, error } = await admin
           .from('chat_history')
           .select('*', { count: 'exact', head: true })
           .eq('user_id', userId)
       return { userId, count: count || 0, error }
   })
   ```

   This fires 40 parallel count queries. At scale, this will be slow and wasteful. Should use a single aggregation query with `GROUP BY user_id`.

2. **No pagination on users list.** Hard-limited to 40 users with `.limit(40)`. With growth, admins cannot see users beyond the 40 most recently active. No search, no filtering, no "load more."

3. **No confirmation on destructive operations.** "Delete Chat History" per-user and "Reset All Daily Counters" (a bulk operation affecting every user) submit immediately on click with no confirmation dialog. One accidental click wipes a user's entire chat history.

4. **Notice banners use search params and disappear on any navigation.** Success/error feedback via `?message=` query params means the banner vanishes if the admin refreshes or navigates away before reading it. Also, after a page revalidation + redirect, the notice shows on the *new* page load, but since the overview does `revalidatePath` then `redirect`, there's a potential race where stale data appears alongside the success message.

5. **Overview fetches up to 4000 rows for active user counting and 600 route metric rows.** At scale these numbers may be insufficient or cause performance issues. The 600-row limit for route metrics means the "24h" numbers are actually "last 600 requests" which could be significantly less than 24h.

6. **`toLocaleString()` renders server-side with server timezone.** All timestamps in the admin dashboard (recent chat, audit log, runtime settings "updated at") use `toLocaleString()` which will use the server's locale/timezone, not the admin's. These dates will look wrong for admins in different timezones.

### What's MISSING

1. **No admin loading states or error boundaries.** The `admin/(protected)/` directory has no `loading.tsx` or `error.tsx`. If the dashboard queries fail or are slow, the admin sees a blank screen or an unhandled Next.js error.

2. **No user search or filtering.** Admins cannot look up a specific user by username, email, or ID. Must scroll through the (limited to 40) list.

3. **No data visualization.** All metrics are raw numbers. A simple sparkline or bar chart for 24h activity would greatly improve readability.

4. **No "are you sure" modals for bulk operations.** "Enable Low-Cost For All" affects every user in the database. There should be a confirmation step.

5. **No active-link highlighting in admin nav.** Both "Overview" and "Users" nav links look identical regardless of which page is active.

6. **No CSRF token.** While `assertTrustedAdminRequest()` checks origin/referer, a proper CSRF token would provide defense-in-depth. Origin checking alone can be bypassed in some edge cases.

7. **No role-based access.** Only one admin credential is supported (single email+password from env vars). No multi-admin support, no read-only roles.

### IMPROVEMENTS Recommended

| Priority | Improvement |
|----------|-------------|
| P0 | Replace N+1 user count queries with a single aggregated query |
| P0 | Add confirmation dialogs for destructive actions (delete history, bulk operations) |
| P1 | Add loading.tsx and error.tsx for admin protected routes |
| P1 | Add pagination and search to the users page |
| P1 | Add active-link highlighting in admin nav |
| P2 | Render timestamps in admin's timezone (pass UTC strings and format client-side) |
| P2 | Cap route metric / chat history queries more intelligently or paginate |
| P3 | Add basic charting for 24h activity trends |
| P3 | Consider multi-admin support via a database-backed admin users table |

---

## 3. ADMIN AUTH & SECURITY

### Files Reviewed
- `src/app/admin/login/page.tsx`
- `src/app/admin/actions.ts` (adminSignIn, adminSignOut)
- `src/lib/admin/session.ts`
- `src/lib/admin/auth.ts`
- `src/lib/admin/login-security.ts`
- `src/lib/admin/request-guard.ts`

### What's GREAT

1. **HMAC-SHA256 signed session cookies.** Session tokens are `base64url(payload).hmac_signature` with expiration. Uses `crypto.timingSafeEqual` for signature verification. This is well-implemented custom session management.

2. **Brute-force protection with dual lockout.** Tracks failed attempts by both `email:ip` and `ip` keys. 5 failures within 10 minutes triggers a 15-minute lockout. The lockout countdown is shown to the user with precise remaining time.

3. **Timing-safe comparisons everywhere.** Email comparison in `verifyAdminCredentials`, password hash comparison, and session signature verification all use `crypto.timingSafeEqual`. No timing oracle attacks possible.

4. **Artificial delay on failed login.** `applyFailedLoginDelay()` adds 700-1000ms for normal failures and 1000-1220ms when locked, with random jitter. This slows down automated attacks.

5. **Origin/referer validation** on every server action via `assertTrustedAdminRequest()`. Prevents basic CSRF attacks.

6. **Cookie security flags are correct.** `httpOnly: true`, `secure: true` in production, `sameSite: 'lax'`, `path: '/admin'` (scoped to admin routes only).

7. **Session TTL of 12 hours** is reasonable for an admin panel. Not too short (annoying), not too long (risky).

8. **Config mode detection.** Supports both hashed passwords (`ADMIN_PANEL_PASSWORD_HASH`) and plain passwords (`ADMIN_PANEL_PASSWORD`) with clear priority. Shows a warning when credentials are not configured.

9. **Login page handles already-authenticated users.** Redirects to `/admin/overview` if session already exists.

### What's BUGGY or GLITCHY

1. **In-memory brute-force store resets on server restart (MODERATE).** `loginAttemptStore` is a `Map` in module scope. On Vercel with serverless functions, this Map may be different per cold start or per instance. An attacker could circumvent lockout by waiting for a new function instance.

2. **Login hint leaks password hash acceptance.** Line 184-188 in the login page:

   ```tsx
   {configMode === 'hash' && (
       <p>Password field accepts your original admin password. It also accepts the exact configured SHA-256 hash if needed.</p>
   )}
   ```

   This tells an attacker that the hash can be used directly as a password. If the hash leaks (e.g., via env var exposure), an attacker knows they can paste it directly into the password field. The hash is then SHA-256'd again and compared, so this doesn't actually work -- but the message is misleading and confusing.

   Actually, looking more carefully at `verifyAdminCredentials`: the submitted password is hashed with `crypto.createHash('sha256').update(passwordInput).digest('hex')` and compared to the configured hash. So submitting the raw hash would NOT work (it would be double-hashed). The login hint text is **factually incorrect** and misleading.

3. **`getSessionSecret()` returns null if env var is missing but doesn't fail loudly.** If `ADMIN_PANEL_SESSION_SECRET` is not set, `signPayload` returns null, `encodeSession` returns null, and `setAdminSession` throws. But `decodeSession` silently returns null (session invalid). This means if the env var is accidentally removed in production, all existing admin sessions silently break with no specific error message -- admins just get redirected to login with "unauthorized."

### What's MISSING

1. **No session rotation on sensitive actions.** After performing destructive operations, the session token should ideally be refreshed to prevent session fixation-style attacks.

2. **No session invalidation mechanism.** There's no way to forcibly invalidate all admin sessions (e.g., emergency lockout). Since sessions are stateless (HMAC-signed cookies), the only way is to rotate `ADMIN_PANEL_SESSION_SECRET`.

3. **No audit log entry for failed login attempts.** Only successful logins and admin actions are audited. Failed login attempts (potential attack indicators) are not recorded in the database audit log.

4. **No 2FA / MFA.** For an admin panel with destructive capabilities (delete all user chat history, change tiers), there's no second factor.

5. **No IP allowlist option.** No way to restrict admin access to specific IPs.

### IMPROVEMENTS Recommended

| Priority | Improvement |
|----------|-------------|
| P0 | Fix the misleading login hint about SHA-256 hash acceptance (it's wrong) |
| P1 | Move brute-force state to Redis or database for multi-instance durability |
| P1 | Log failed login attempts to the audit table |
| P2 | Add session invalidation mechanism (e.g., a "revoke all sessions" button) |
| P2 | Consider adding TOTP-based 2FA for admin login |
| P3 | Add optional IP allowlist for admin routes |

---

## 4. FORM HANDLING

### Across Settings + Admin

### What's GREAT

1. **Server actions used consistently.** All admin mutations use Next.js server actions (`'use server'`), which handle CSRF protection via the framework's built-in mechanism.

2. **Input sanitization.** `isUuid()` for user IDs, `sanitizeTier()` for subscription tier values, `parseReturnTo()` for redirect paths. No injection vectors found.

3. **Login form has proper HTML semantics.** `type="email"`, `type="password"`, `autoComplete` attributes, `required` attributes, proper `<label>` associations with `htmlFor`.

4. **Disabled state on submit button** when config is missing.

### What's BUGGY or GLITCHY

1. **No loading/pending states on form submissions.** When an admin clicks "Delete Chat History" or "Enable Low-Cost For All", there's no visual feedback that the action is processing. The button just sits there until the redirect happens. On slow connections, admins may double-click.

2. **Settings panel fire-and-forget server calls.** `updateUserSettings()` on theme/low-cost change is not awaited and has no error boundary.

### What's MISSING

1. **No `useFormStatus()` usage for pending states.** Next.js provides `useFormStatus` for exactly this case -- showing loading spinners during server action execution.

2. **No optimistic UI with rollback.** Settings changes are applied immediately client-side but if the server rejects them, there's no rollback.

3. **No form-level validation messages.** The admin login form relies solely on HTML5 `required` validation. No custom error messages for malformed email, empty password, etc.

### IMPROVEMENTS Recommended

| Priority | Improvement |
|----------|-------------|
| P0 | Add pending/loading indicators to all admin form buttons using `useFormStatus` |
| P1 | Add error handling with rollback for settings panel mutations |
| P2 | Add custom inline validation messages for login form |

---

## 5. AUXILIARY PAGES

### Files Reviewed
- `src/app/privacy/page.tsx`
- `src/app/about/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/status/page.tsx`
- `src/app/status/layout.tsx`
- `src/app/post-auth/page.tsx`

### What's GREAT

1. **Privacy Policy is exceptionally thorough.** 21 sections covering data collection, AI processing disclosure, GDPR rights, CCPA rights, children's privacy, international transfers, data retention, cookies, and more. This is production-grade legal documentation.

2. **Terms of Service is equally comprehensive.** 22 sections with AI content disclaimers, acceptable use policy, IP rights, dispute resolution, class action waiver, force majeure. Well-structured with proper legal language.

3. **Both legal pages have proper SEO metadata.** `title`, `description`, and `canonical` alternates are set.

4. **About page is well-crafted.** Authentic brand voice, engaging copy, values section, contact section with multiple email links. The spinning logo adds personality.

5. **Status page is functional and informative.** Shows health status, version from package.json, git commit SHA, environment, and region. Uses `force-dynamic` to ensure fresh data.

6. **Status layout properly excludes from indexing** with `robots: { index: false, follow: false }`.

7. **Post-auth page handles edge cases well.** Retries `getUser()` after 1.5s for cookie propagation, listens to auth state changes, has an 8-second timeout fallback to landing page, prefetches both possible destinations, and properly cleans up timers/subscriptions.

### What's BUGGY or GLITCHY

1. **About page contact section has three identical emails.** "Feedback," "General," and "Support" all point to `pashaseenainc@gmail.com`. The three cards with identical emails look like a bug or placeholder. Users clicking different cards for different purposes get the same inbox with no differentiation.

2. **Post-auth page has no error handling for `resolveJourney`.** If `fetchJourneyState` or `persistUserJourney` throws, the user gets stuck on the loading screen until the 8-second timeout kicks them to the landing page. No error message is shown.

3. **Privacy and Terms pages use different layout structures.** Privacy has a sticky header with logo; Terms has a simpler back-link at the top. About has a sticky nav. This inconsistency means users navigating between these pages experience jarring layout shifts.

4. **Status page does not actually check database connectivity.** It only shows server process info (version, commit, env). A real health check should ping Supabase and return whether the DB is reachable.

### What's MISSING

1. **No table of contents for Privacy/Terms pages.** These are very long documents (900+ lines of JSX for privacy). A TOC with anchor links would greatly improve navigation. The section IDs exist but aren't linked from anywhere.

2. **No "last reviewed" or versioning for legal pages.** While "Last Updated" dates are present, there's no changelog or diff mechanism for tracking legal document changes.

3. **Status page has no uptime monitoring integration.** No connection to any monitoring service, no historical uptime data, no incident history.

4. **No 404 page customization found** in the reviewed files (not in scope but worth noting).

5. **About page has no link to Status page.** Users concerned about service health have no path to find it.

### IMPROVEMENTS Recommended

| Priority | Improvement |
|----------|-------------|
| P1 | Differentiate contact emails or consolidate to one card |
| P1 | Add error handling in post-auth page's resolveJourney |
| P2 | Add table of contents to Privacy and Terms pages |
| P2 | Add actual DB health check to status page |
| P2 | Standardize layout structure across legal/info pages |
| P3 | Add status page link to About or Settings pages |

---

## 6. ROUTING & LAYOUTS

### What's GREAT

1. **Admin route organization is excellent.** `(protected)` route group with layout-level auth check. Clean separation: `/admin` (redirect), `/admin/login` (public), `/admin/(protected)/overview` and `/admin/(protected)/users` (authenticated).

2. **Settings has complete error boundary coverage.** `loading.tsx`, `error.tsx`, and `layout.tsx` all present.

3. **Post-auth page properly handles the OAuth callback flow.** Listens to multiple signals (getUser, auth state change, retry timer, timeout) to robustly resolve the user's journey state.

### What's BUGGY or GLITCHY

1. **Admin root page (`/admin/page.tsx`) does two sequential redirects.** It checks session, redirects to overview if valid, else redirects to login. This is fine functionally but the page renders nothing -- a loading state would be slightly better UX during the redirect.

### What's MISSING

1. **No `loading.tsx` or `error.tsx` in admin routes.** If overview/users pages are slow to load or error out, there's no graceful fallback.

2. **No `not-found.tsx` in admin routes.** Navigating to `/admin/nonexistent` will show the default Next.js 404 rather than an admin-styled one.

3. **No middleware-level admin auth check.** Auth is only checked at the layout level. Adding middleware would provide earlier rejection and prevent any server component execution for unauthorized requests.

### IMPROVEMENTS Recommended

| Priority | Improvement |
|----------|-------------|
| P1 | Add loading.tsx and error.tsx to admin/(protected) |
| P2 | Add not-found.tsx to admin routes |
| P2 | Consider adding middleware-level admin auth for defense-in-depth |

---

## 7. RESPONSIVE DESIGN

### What's GREAT

1. **Settings page uses responsive breakpoints.** `sm:flex-row`, `sm:items-center`, `sm:justify-between` for the header. Switch toggles use `sm:flex-row` fallback from column layout.

2. **Admin layout uses flex-wrap** on nav links and header elements. Works on small screens.

3. **Admin users page cards** use `lg:flex-row` to stack vertically on mobile with action buttons going full-width.

4. **Legal pages** use max-width containers and responsive padding.

5. **Safe-area insets** handled in settings and terms pages for notched devices.

### What's BUGGY or GLITCHY

1. **Admin overview page has many grid columns that may squeeze on tablets.** `xl:grid-cols-4` for metric cards, `xl:grid-cols-[1.35fr_1fr]` for panels. Between `sm` and `xl` breakpoints (768px-1280px), some cards may be awkwardly sized.

2. **Admin user action buttons fixed at `sm:w-[360px]`.** On narrow screens this is fine (full width), but on medium screens the fixed width may not align well with the info column.

3. **10px text (`text-[10px]`, `text-[11px]`) throughout settings and admin** may be difficult to read on mobile devices. These sizes are below the typical 12px minimum for mobile readability.

### What's MISSING

1. **No touch-friendly sizing consideration for admin buttons.** Many buttons use `py-2` which results in small tap targets (around 32px). The recommended minimum for touch targets is 44px.

2. **No horizontal scroll handling for admin data tables.** The user list and audit log could overflow on very narrow screens.

### IMPROVEMENTS Recommended

| Priority | Improvement |
|----------|-------------|
| P1 | Increase minimum font size from 10px to 12px for mobile readability |
| P2 | Increase button touch targets to minimum 44px height on mobile |
| P2 | Test and fix tablet breakpoint layout issues in admin overview |

---

## 8. SECURITY SUMMARY

### Strong Points
- HMAC-signed stateless sessions with timing-safe comparison
- Dual brute-force lockout (per-email+IP and per-IP)
- Artificial delay + jitter on failed logins
- Origin/referer checking on every server action
- Input validation and sanitization (UUID, tier whitelist, return-path whitelist)
- Cookie scoped to `/admin` path with httpOnly, secure, sameSite
- Comprehensive audit trail with request metadata
- Admin client uses service-role key (correctly bypasses RLS for admin operations)

### Vulnerabilities / Concerns
| Severity | Issue |
|----------|-------|
| Medium | In-memory brute-force store lost on serverless cold starts |
| Low | No CSRF token (relies on origin checking + server action framework) |
| Low | No 2FA for destructive admin operations |
| Low | No mechanism to revoke all admin sessions |
| Info | Failed login attempts not recorded in persistent audit log |
| Info | Misleading login hint about SHA-256 hash acceptance |

---

## 9. TOP 10 ACTION ITEMS (Prioritized)

| # | Priority | Area | Action |
|---|----------|------|--------|
| 1 | P0 | Settings | Add error handling + user feedback for `updateUserSettings()` calls |
| 2 | P0 | Settings | Move store clearing to after successful `signOut()`, not before |
| 3 | P0 | Admin | Fix N+1 query in users page (use aggregated COUNT with GROUP BY) |
| 4 | P0 | Admin | Add confirmation dialogs for all destructive operations |
| 5 | P0 | Admin | Add `useFormStatus` pending states to all admin form buttons |
| 6 | P1 | Auth | Fix misleading SHA-256 hash login hint text |
| 7 | P1 | Auth | Move brute-force tracking to persistent storage (Redis/DB) |
| 8 | P1 | Admin | Add loading.tsx and error.tsx to admin protected routes |
| 9 | P1 | Admin | Add pagination and search to users page |
| 10 | P1 | Settings | Replace `window.confirm()` with custom confirmation modal |

---

## 10. FILES REVIEWED

| File | Lines | Verdict |
|------|-------|---------|
| `src/components/settings/settings-panel.tsx` | 171 | Good structure, needs error handling |
| `src/app/settings/page.tsx` | 64 | Clean server component |
| `src/app/settings/layout.tsx` | 12 | Minimal, correct |
| `src/app/settings/loading.tsx` | 7 | Simple, effective |
| `src/app/settings/error.tsx` | 38 | Well-implemented |
| `src/app/admin/page.tsx` | 10 | Clean redirect logic |
| `src/app/admin/login/page.tsx` | 201 | Beautiful UI, solid auth UX |
| `src/app/admin/(protected)/layout.tsx` | 58 | Good auth guard at layout level |
| `src/app/admin/(protected)/overview/page.tsx` | 382 | Data-rich, some perf concerns |
| `src/app/admin/(protected)/users/page.tsx` | 341 | Functional but N+1 and no pagination |
| `src/app/admin/actions.ts` | 444 | Thorough validation and audit logging |
| `src/lib/admin/session.ts` | 92 | Well-implemented HMAC sessions |
| `src/lib/admin/auth.ts` | 52 | Timing-safe, dual-mode auth |
| `src/lib/admin/login-security.ts` | 74 | Solid brute-force protection |
| `src/lib/admin/request-guard.ts` | 45 | Clean origin checking |
| `src/app/privacy/page.tsx` | 977 | Comprehensive, professional |
| `src/app/about/page.tsx` | 305 | Engaging, well-crafted |
| `src/app/terms/page.tsx` | 917 | Thorough legal coverage |
| `src/app/status/page.tsx` | 41 | Functional but basic |
| `src/app/status/layout.tsx` | 12 | Correct noindex |
| `src/app/post-auth/page.tsx` | 119 | Robust OAuth callback handling |
