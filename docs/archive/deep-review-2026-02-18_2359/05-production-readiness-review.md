# Production Readiness Review -- MyGang.ai

**Date:** 2026-02-18
**Reviewer:** Senior DevOps/SRE Engineer (automated deep audit)
**Stack:** Next.js 16.1.6 / React 19 / Supabase / Tailwind v4 / OpenRouter + Gemini
**Repo:** `C:/coding/mygangbyantig` (branch: `master`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Build and Deployment](#2-build-and-deployment)
3. [Performance](#3-performance)
4. [SEO and Discoverability](#4-seo-and-discoverability)
5. [Error Handling](#5-error-handling)
6. [Monitoring and Observability](#6-monitoring-and-observability)
7. [Environment and Secrets](#7-environment-and-secrets)
8. [Dependencies](#8-dependencies)
9. [Caching and Revalidation](#9-caching-and-revalidation)
10. [CDN and Static Assets](#10-cdn-and-static-assets)
11. [Database (Supabase)](#11-database-supabase)
12. [Security](#12-security)
13. [CI/CD](#13-cicd)
14. [Scalability](#14-scalability)
15. [What is GREAT](#15-what-is-great)
16. [What is NOT Production-Ready](#16-what-is-not-production-ready)
17. [What is MISSING for Production](#17-what-is-missing-for-production)
18. [Prioritized Improvements](#18-prioritized-improvements)

---

## 1. Executive Summary

MyGang.ai is an AI group-chat application with a solid architectural foundation -- clean App Router structure, Zod-validated API routes, Supabase RLS, rate limiting, and security headers. The codebase demonstrates thoughtful engineering in areas like content safety filtering, abuse scoring, memory compaction, and graceful AI provider fallback.

However, several **critical issues** exist that would cause problems in a real production environment under load:

- **Committed secrets in `.env.local`** (API keys, service role keys exposed in version control)
- **No middleware.ts** for auth session refresh (Supabase SSR best practice)
- **No CI/CD pipeline** (no GitHub Actions, no pre-merge gates)
- **In-memory rate limiting as default** (resets on every deployment/serverless cold start)
- **No error tracking service** (Sentry/Datadog absent -- only `console.error`)
- **No `global-error.tsx`** (the `error.tsx` at app root does not catch layout-level errors)

Overall readiness: **~65% production-ready**. The application would work for a soft launch with modest traffic, but needs hardening before scaling.

---

## 2. Build and Deployment

### Next.js Config (`next.config.ts`)

**Good:**
- Security headers are comprehensive: CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, HSTS (production-only).
- `allowedDevOrigins` configured for local dev.

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | CSP uses `'unsafe-inline' 'unsafe-eval'` for scripts -- this significantly weakens CSP. Should use nonces or hashes in production. |
| MEDIUM | No `images.remotePatterns` configured -- if user avatars or external images are loaded, Next/Image optimization will fail silently or error. |
| LOW | No `output` config specified. For Vercel this is fine (default), but for self-hosting, `output: 'standalone'` is needed. |
| LOW | No `poweredByHeader: false` -- leaks `X-Powered-By: Next.js` header. |
| LOW | No `compress` setting (default `true` is fine for Vercel but worth noting). |

### Build Scripts (`package.json`)

**Good:**
- Clean `build`, `dev`, `start`, `lint` scripts.
- Load test and Playwright test scripts present.

**Issues:**

| Severity | Finding |
|----------|---------|
| HIGH | No `typecheck` script (`tsc --noEmit`). Lint alone does not catch all type errors. |
| MEDIUM | No `test` script for unit tests. Only Playwright E2E exists. |
| LOW | Version is `0.1.0` -- fine for pre-launch but should adopt semver discipline. |

### TypeScript Config (`tsconfig.json`)

**Good:**
- `strict: true` enabled.
- `isolatedModules: true` for compatibility with SWC/esbuild.
- Path alias `@/*` configured.

**Issues:**

| Severity | Finding |
|----------|---------|
| LOW | `jsx: "react-jsx"` is fine but Next.js 16 defaults to this anyway -- no issue, just redundant. |

### ISR/SSR/SSG Strategy

- Landing page (`/`) -- static with structured data. Good.
- Chat page (`/chat`) -- client-side rendered. Appropriate for real-time chat.
- Status page (`/status`) -- `force-dynamic`. Good for health checks.
- No explicit ISR/revalidation used anywhere. For this app type (mostly client-side SPA after auth), this is acceptable.

---

## 3. Performance

### Bundle Size

| Severity | Finding |
|----------|---------|
| MEDIUM | `framer-motion` (v12.31.0) is a large dependency (~150KB+ min). Verify tree-shaking is working. Consider `motion` (the lightweight export). |
| MEDIUM | `radix-ui` (v1.4.3) as a single package -- newer versions offer individual imports (`@radix-ui/react-dialog`, etc.) for better tree-shaking. The monolithic `radix-ui` package may include unused components. |
| MEDIUM | `lucide-react` (v0.563.0) -- very large icon library. Only import icons used; verify no barrel imports. |
| LOW | `html-to-image` is bundled -- only needed for screenshot features, should be dynamically imported. |

### Code Splitting

- App Router provides automatic route-level code splitting. Good.
- No evidence of `next/dynamic` usage for heavy components. Consider lazy-loading the chat page's rich components (wallpaper layer, message virtual list).

### Image Optimization

| Severity | Finding |
|----------|---------|
| HIGH | No evidence of `next/image` usage for character avatars. The architecture doc mentions WebP/AVIF optimization, but the OG image is just `/icon-512.png` (a static PNG). |
| MEDIUM | No `images` configuration in `next.config.ts` for remote image domains. |

### Font Loading

**Good:**
- Using `next/font/google` with `Geist` and `Geist_Mono` -- optimal font loading with zero layout shift.
- Subset to `latin` only.

### CSS Strategy

**Good:**
- Tailwind v4 with PostCSS plugin. Modern setup.
- `content-visibility: auto` used for performance (`.content-auto` class).
- Safe area insets respected (`.pb-safe`, `.pt-safe`).

**Issues:**

| Severity | Finding |
|----------|---------|
| LOW | Large amount of custom CSS for wallpaper variants could be extracted to a separate file for better cacheability. |

---

## 4. SEO and Discoverability

### Meta Tags and OG Tags

**Good:**
- Comprehensive metadata in `layout.tsx`: title template, description, keywords, OG tags, Twitter card, icons, manifest, robots directives, Google verification.
- `metadataBase` properly set.
- Chat pages excluded from indexing (`robots: { index: false }`).

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | OG image is `/icon-512.png` (512x512 square). OG images should be 1200x630 for proper social media rendering. No dynamic OG image generation. |
| LOW | Missing `alternates.languages` for i18n (only English currently, so low priority). |

### Sitemap and Robots

**Good:**
- `sitemap.ts` generates proper sitemap with all public pages.
- `robots.ts` properly disallows authenticated routes, API, admin, tests.
- `llms.txt` mentioned in comments (served from `/public`).

### Structured Data

**Good:**
- JSON-LD with Organization, WebSite, SoftwareApplication, and FAQPage schemas on landing page.
- Properly rendered via `next/script`.

### PWA

**Good:**
- `manifest.json` present with proper configuration.
- Icons at 192x192 and 512x512.

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | No service worker for offline support. Manifest exists but no offline fallback page. |
| LOW | No `maskable` icon variant specified in manifest. |

---

## 5. Error Handling

### Error Boundaries

**Good:**
- `src/app/error.tsx` -- root error boundary with reset and home link.
- `src/components/orchestrator/error-boundary.tsx` -- class component ErrorBoundary for chat components.

**Issues:**

| Severity | Finding |
|----------|---------|
| HIGH | **No `global-error.tsx`**. The `error.tsx` at app root catches page-level errors, but layout-level errors (in `RootLayout`) require `global-error.tsx` in the App Router. If `ThemeProvider`, `AuthManager`, or `PerfMonitor` throw during render, the user sees the default Next.js error page. |
| MEDIUM | `error.tsx` only logs to `console.error`. No error tracking service integration. |
| MEDIUM | No `loading.tsx` at any route level. Users see no loading indicator during route transitions. |

### 404 Page

**Good:**
- Custom `not-found.tsx` with branded design and link back home.

### API Error Handling

**Good:**
- Chat route has comprehensive error handling: try/catch at top level, capacity error detection, graceful user-facing messages.
- Analytics route has proper error handling with rate limiting.
- Zod validation on all API inputs.

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | Error responses in chat route always return JSON with system character messages. This is creative UX but makes it harder for monitoring tools to distinguish real errors from user-facing messages. Consider also setting a custom header for error classification. |

---

## 6. Monitoring and Observability

### Analytics

**Good:**
- Custom analytics system via `src/lib/analytics.ts` with session management.
- Performance monitoring via `PerfMonitor` component (LCP, FID, CLS, long tasks, TTFB).
- Chat route metrics logged (`logChatRouteMetric`).
- Analytics API route with Zod validation and rate limiting.

### Logging

| Severity | Finding |
|----------|---------|
| CRITICAL | **No error tracking service (Sentry, Datadog, etc.)**. All errors go to `console.error` which is ephemeral in serverless environments. Errors in production will be invisible unless someone is watching Vercel function logs in real-time. |
| HIGH | No structured logging. All `console.error` calls use unstructured string messages. Consider a structured logger (e.g., pino) for production. |
| MEDIUM | No request tracing / correlation IDs. When debugging multi-step issues (auth -> profile fetch -> LLM call -> persistence), there is no way to trace a single request through the system. |

### Health Checks

**Good:**
- `/status` page exists with version, commit SHA, environment, and region info.

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | Status page does not actually check Supabase connectivity or AI provider health. It is a shallow health check that will return "OK" even if the database or AI provider is down. |
| LOW | No `/api/health` endpoint for automated monitoring/load balancer health checks. The HTML status page is not ideal for automated systems. |

---

## 7. Environment and Secrets

### CRITICAL: Secrets Exposure

| Severity | Finding |
|----------|---------|
| **CRITICAL** | **`.env.local` contains real production secrets and is present in the working directory.** While `.gitignore` excludes `.env*` files, the file contains: Supabase service role key, Google AI API key, OpenRouter API key, admin password hash, admin session secret. **If this file was ever committed or the gitignore was misconfigured, all secrets are compromised.** |
| **CRITICAL** | **No `.env.example` file exists.** New developers have no template for required environment variables. This also means there is no documentation of what env vars are required. |

### Env Var Validation

| Severity | Finding |
|----------|---------|
| HIGH | **No runtime env var validation at startup.** The Supabase client throws generic errors if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing. There should be a `src/lib/env.ts` that validates all required env vars at build/startup time using Zod or `@t3-oss/env-nextjs`. |
| MEDIUM | `process.env.NEXT_PUBLIC_SUPABASE_URL!` uses non-null assertion operator in `server.ts`. This will cause an opaque runtime error if the var is missing. |

### Admin Credentials

| Severity | Finding |
|----------|---------|
| HIGH | Admin authentication uses SHA-256 hashing without salt. This is weak -- any rainbow table can crack common passwords. Should use bcrypt/argon2 at minimum. |
| MEDIUM | Admin email is stored in env vars. This is fine but the password hash should be generated with a proper password hashing algorithm. |

---

## 8. Dependencies

### Package Analysis

**Production Dependencies (21 packages):**

| Package | Version | Notes |
|---------|---------|-------|
| `next` | 16.1.6 | Current |
| `react` / `react-dom` | 19.2.3 | Current |
| `@supabase/ssr` | ^0.8.0 | Current |
| `@supabase/supabase-js` | ^2.94.0 | Current |
| `ai` (Vercel AI SDK) | ^6.0.69 | Current |
| `@ai-sdk/google` | ^3.0.20 | Current |
| `@ai-sdk/openai` | ^3.0.25 | Current |
| `@openrouter/ai-sdk-provider` | ^2.2.3 | Current |
| `@upstash/ratelimit` | ^2.0.1 | Current |
| `@upstash/redis` | ^1.35.2 | Current |
| `zod` | ^3.23.8 | Current |
| `zustand` | ^5.0.11 | Current |
| `framer-motion` | ^12.31.0 | Large bundle impact |
| `radix-ui` | ^1.4.3 | Monolithic import |
| `lucide-react` | ^0.563.0 | Large icon set |
| `html-to-image` | ^1.11.13 | Should be dynamically imported |
| `class-variance-authority` | ^0.7.1 | Lightweight, fine |
| `clsx` | ^2.1.1 | Lightweight, fine |
| `tailwind-merge` | ^3.4.0 | Lightweight, fine |
| `next-themes` | ^0.4.6 | Lightweight, fine |
| `@tanstack/react-virtual` | ^3.13.10 | Good for chat list virtualization |

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | `@ai-sdk/openai` is listed but does not appear to be used anywhere (OpenRouter provider is used instead). Dead dependency adds to install size. |
| LOW | All versions use `^` (caret) ranges. For production stability, consider pinning exact versions or using a lockfile (package-lock.json or pnpm-lock.yaml). |

### Security Vulnerabilities

| Severity | Finding |
|----------|---------|
| MEDIUM | No `npm audit` or `pnpm audit` in any CI/CD pipeline. Vulnerabilities may exist in transitive dependencies with no visibility. |

---

## 9. Caching and Revalidation

### HTTP Caching

| Severity | Finding |
|----------|---------|
| MEDIUM | No explicit `Cache-Control` headers set for API routes. Chat API responses are dynamic and should have `Cache-Control: no-store`. Static pages should have appropriate caching headers. |
| LOW | Next.js handles static asset caching via `/_next/static/` with immutable hashes. This is correct by default. |

### Data Caching

**Good:**
- In-memory caching for character prompt blocks (5-minute TTL).
- In-memory caching for admin runtime settings (20-second TTL).

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | Module-level `let` caches (`cachedDbPromptBlocks`, `cachedGlobalLowCostOverride`) are per-serverless-instance. In a scaled environment, each instance maintains its own cache, leading to inconsistent behavior and wasted LLM calls. Consider using Upstash Redis for shared caching. |
| LOW | The memory-based caches have no size limits. If the application runs in a long-lived server process, these would not grow unbounded (they are single-entry caches), so this is acceptable. |

### Revalidation Strategy

- No ISR used. All dynamic data is fetched on-demand. This is appropriate for a chat application.

---

## 10. CDN and Static Assets

**Good:**
- Vercel's global CDN handles static assets automatically.
- Fonts loaded via `next/font` are self-hosted (no external requests).
- Manifest and icons properly configured.

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | No `next/image` usage detected. Character avatars and any user-facing images should use the optimized Image component for automatic format conversion (WebP/AVIF), sizing, and lazy loading. |
| LOW | No `.webp` or `.avif` image variants in `/public`. |

---

## 11. Database (Supabase)

### Schema Design

**Good:**
- Well-structured relational schema with proper foreign keys and ON DELETE CASCADE.
- RLS enabled on all tables.
- Proper indexes added via migrations (chat_history, memories).
- Vector extension enabled for semantic memory search.
- Atomic profile counter updates via RPC function.

**Issues:**

| Severity | Finding |
|----------|---------|
| HIGH | **Connection pooler disabled** in `supabase/config.toml` (`[db.pooler] enabled = false`). For production with serverless functions (Vercel), connection pooling is essential. Each serverless invocation creates a new database connection. Without pooling, you will hit PostgreSQL's `max_connections` limit quickly under load. |
| MEDIUM | `minimum_password_length = 6` is weak. Industry standard is 8+. `password_requirements = ""` means no complexity requirements. |
| MEDIUM | `enable_confirmations = false` for email -- users can sign up without verifying their email. This opens the door to disposable email abuse. |
| MEDIUM | `auth.email.max_frequency = "1s"` allows very rapid email sending. Should be at least `"60s"` for production to prevent abuse. |
| MEDIUM | `network_restrictions.enabled = false` with `allowed_cidrs = ["0.0.0.0/0"]`. Fine for development but should be restricted in production. |
| LOW | No CAPTCHA configured (`[auth.captcha]` is commented out). Consider enabling Turnstile or hCaptcha. |
| LOW | MFA is not enabled. Not critical for a chat app but good to have for admin accounts. |

### Migration Strategy

**Good:**
- 14 ordered migrations with descriptive names.
- Migrations are additive and non-destructive.
- Uses proper SQL migration patterns.

### RLS Policies

**Good:**
- All tables have RLS enabled.
- Policies check `auth.uid()` appropriately.

**Issues:**

| Severity | Finding |
|----------|---------|
| MEDIUM | `chat_history` SELECT policy allows `is_guest = TRUE` reads. This means any authenticated user could potentially read guest messages. The INSERT policy similarly allows guest inserts. This should be scoped more tightly. |
| LOW | The `characters` table has no RLS policies visible. If it is read-only (admin-managed), a SELECT-only policy for all authenticated users is needed. |

---

## 12. Security

### Content Security Policy

**Good:**
- CSP is configured and restrictive for most directives.
- `frame-ancestors 'none'` prevents clickjacking.
- `connect-src` is properly scoped to Supabase and AI providers.

**Issues:**

| Severity | Finding |
|----------|---------|
| HIGH | `script-src 'self' 'unsafe-inline' 'unsafe-eval'` -- `unsafe-eval` is dangerous and should be removed. If Next.js requires it for dev, conditionally add it only in development. `unsafe-inline` should be replaced with nonces. |

### Input Validation

**Good:**
- Zod schemas on all API routes.
- Message content truncated to 2000 chars.
- Message IDs sanitized.
- Content safety filters (hard block and soft block patterns).
- Abuse scoring system.
- HTML/script tag detection in abuse scoring.

### Rate Limiting

**Good:**
- Rate limiting on both chat and analytics routes.
- Per-user and per-IP rate limits.
- Daily message limits with tiered (free/pro) quotas.
- Upstash Redis integration available.

**Issues:**

| Severity | Finding |
|----------|---------|
| HIGH | **Default rate limiting is in-memory** (`memoryStore = new Map`). This resets on every serverless cold start and is not shared across instances. In production without Upstash Redis configured, rate limiting is effectively non-functional. The env check `if (process.env.UPSTASH_REDIS_REST_URL && ...)` means this silently degrades. |
| MEDIUM | Rate limit creates a new `Ratelimit` and `Redis` instance on every call via dynamic import. Should be memoized/cached. |

### Authentication

**Good:**
- Supabase Auth with proper SSR cookie handling.
- Admin panel uses timing-safe comparison for credential verification.
- Auth state properly managed client-side with `AuthManager`.

**Issues:**

| Severity | Finding |
|----------|---------|
| HIGH | **No `middleware.ts`** for Supabase auth session refresh. The Supabase SSR documentation explicitly requires middleware to refresh auth tokens on every request. Without it, sessions may expire unexpectedly, causing auth state inconsistencies. |
| MEDIUM | Admin password is hashed with unsalted SHA-256. Should use bcrypt or argon2. |

### CORS

| Severity | Finding |
|----------|---------|
| LOW | No explicit CORS configuration. Next.js API routes default to same-origin, which is correct. If the app ever needs cross-origin API access, this will need attention. |

---

## 13. CI/CD

| Severity | Finding |
|----------|---------|
| **CRITICAL** | **No CI/CD pipeline exists.** No `.github/workflows/` directory. No pre-merge checks. Code can be pushed directly to `master` without: lint checks, type checks, test execution, build verification, security audit. |
| HIGH | No pre-commit hooks (no `.husky/` directory, no lint-staged config). |
| MEDIUM | Playwright tests exist but only for admin flow. No unit tests. No integration tests. |
| MEDIUM | No branch protection rules enforced (cannot verify from repo alone, but no CI implies no required checks). |

---

## 14. Scalability

### Serverless Considerations

| Severity | Finding |
|----------|---------|
| HIGH | `maxDuration = 45` on the chat route. This is appropriate for LLM calls but expensive. If Gemini is slow, a single user request holds a serverless function for 45 seconds. Consider streaming responses instead of `generateObject` to reduce time-to-first-byte. |
| HIGH | Fire-and-forget persistence (`persistAsync().catch(...)`) after returning the response is a good pattern, but in serverless environments (Vercel), the function may be terminated before background work completes. Use `waitUntil()` from Next.js 16 or Vercel's `waitUntil` to ensure background tasks complete. |
| MEDIUM | Memory compaction (`compactMemoriesIfNeeded`) is triggered inline during chat requests. This involves an additional LLM call. Under high load, this adds latency and cost. Should be moved to a background job/cron. |

### Connection Limits

| Severity | Finding |
|----------|---------|
| HIGH | Supabase admin client is a singleton (`let adminClient: SupabaseClient | null = null`). In serverless, this is per-instance and fine. But without connection pooling enabled in Supabase config, each instance opens a direct database connection. |
| MEDIUM | No connection limit configuration for the Supabase client. Default PostgreSQL `max_connections` is 100. Serverless functions can easily exhaust this. |

### Memory Usage

| Severity | Finding |
|----------|---------|
| MEDIUM | `memoryStore` (in-memory Map for rate limiting) grows unbounded. No TTL cleanup. In a long-running process, this is a memory leak. In serverless, it is reset on cold starts, so less of an issue. |
| LOW | Character prompt blocks cache and admin settings cache are bounded (single entries). No concern. |

---

## 15. What is GREAT

1. **Security Headers**: Comprehensive security headers in `next.config.ts` -- CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy. Better than 90% of Next.js apps in the wild.

2. **Input Validation**: Every API route uses Zod schemas. Request payloads are parsed, validated, and sanitized before processing. Content safety filters with hard/soft block patterns and abuse scoring.

3. **Structured Database Migrations**: 14 well-named, ordered SQL migrations. RLS enabled on all tables. Proper foreign keys with cascading deletes.

4. **Rate Limiting Architecture**: Dual-mode rate limiting (Upstash Redis or in-memory fallback). Per-user and per-IP limits. Daily quotas with subscription tiers.

5. **Error Handling in Chat Route**: The chat API route has exceptionally thorough error handling -- capacity detection, provider fallback logic, graceful user-facing error messages, metric logging on failures.

6. **SEO Foundation**: Proper metadata, OG tags, Twitter cards, structured data (JSON-LD), sitemap, robots.txt, canonical URLs.

7. **Performance Monitoring**: Custom `PerfMonitor` component tracking Web Vitals (LCP, FID, CLS), TTFB, DOM load, and long tasks. Chat route metrics with timing data.

8. **Font Strategy**: `next/font` with self-hosted Google Fonts. Zero layout shift, no external font requests.

9. **Content Safety**: Two-tier content safety system (hard block for illegal content, soft block with empathetic redirection for self-harm topics). Abuse scoring with progressive enforcement.

10. **TypeScript Strict Mode**: `strict: true` in tsconfig. Proper type definitions throughout.

---

## 16. What is NOT Production-Ready

1. **No middleware.ts** -- Supabase auth sessions will not refresh properly, leading to random logouts and auth failures.

2. **In-memory rate limiting as default** -- Without Upstash Redis env vars configured, rate limiting is per-instance and resets on cold starts. Effectively useless in serverless.

3. **No error tracking service** -- All errors go to `console.error`. In serverless production, these are ephemeral and largely invisible.

4. **No `global-error.tsx`** -- Layout-level errors crash the entire app with no recovery UI.

5. **CSP with `unsafe-eval`** -- Undermines the entire Content Security Policy.

6. **No env var validation** -- Missing environment variables cause opaque runtime errors instead of clear startup failures.

7. **Supabase connection pooler disabled** -- Direct database connections from serverless will exhaust connection limits under moderate load.

8. **Fire-and-forget async without `waitUntil()`** -- Background persistence tasks may be killed before completion in serverless.

9. **Admin password hashing** -- Unsalted SHA-256 is insufficient for password storage.

10. **No CI/CD at all** -- Any push to master goes directly to production with zero automated checks.

---

## 17. What is MISSING for Production

### Must-Have (Blockers)

- [ ] **`middleware.ts`** for Supabase auth session refresh
- [ ] **`.env.example`** with all required env vars documented
- [ ] **`global-error.tsx`** for layout-level error handling
- [ ] **Error tracking service** (Sentry, Datadog, LogRocket, etc.)
- [ ] **CI/CD pipeline** (GitHub Actions at minimum: lint, type-check, build, test)
- [ ] **Env var validation** at build/startup time
- [ ] **Supabase connection pooling** enabled for production
- [ ] **`waitUntil()`** for background tasks in serverless

### Should-Have (Pre-Scale)

- [ ] Structured logging (pino or similar)
- [ ] Request correlation IDs / tracing
- [ ] Deep health check endpoint (`/api/health` that checks DB + AI provider)
- [ ] Pre-commit hooks (husky + lint-staged)
- [ ] Unit test suite
- [ ] Branch protection rules
- [ ] Proper OG images (1200x630)
- [ ] Upstash Redis for rate limiting in production
- [ ] `next/image` for all user-facing images
- [ ] Removal of `unsafe-eval` from CSP
- [ ] Service worker for offline PWA support

### Nice-to-Have (Post-Launch)

- [ ] Dynamic OG image generation per page
- [ ] A/B testing framework
- [ ] Feature flags system
- [ ] Database backup verification (test restores)
- [ ] Load testing results documented
- [ ] Runbook for common incidents
- [ ] On-call rotation / PagerDuty integration
- [ ] Cookie consent banner
- [ ] Accessibility audit (WCAG 2.1 AA)

---

## 18. Prioritized Improvements

### CRITICAL (Fix Before Launch)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| C1 | **Rotate all secrets** in `.env.local` immediately. Even if not committed to git, the file contains real API keys and service role keys. Create `.env.example` with placeholder values. | 1h | Prevents credential compromise |
| C2 | **Add `middleware.ts`** for Supabase auth session refresh. Follow the official Supabase SSR guide. | 2h | Prevents random auth failures |
| C3 | **Add error tracking** (Sentry recommended). Wrap API routes and add the Sentry Next.js SDK. | 3h | Enables production debugging |
| C4 | **Create CI/CD pipeline**. GitHub Actions with: `npm run lint`, `tsc --noEmit`, `npm run build`, `npm audit`. Block merges on failure. | 3h | Prevents broken deployments |

### HIGH (Fix Within First Sprint)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| H1 | **Add `global-error.tsx`** at app root. | 30m | Catches layout-level crashes |
| H2 | **Enable Supabase connection pooling** for production. Update `supabase/config.toml` and use the pooler connection string in production. | 1h | Prevents connection exhaustion |
| H3 | **Add env var validation** using Zod or `@t3-oss/env-nextjs`. Validate all required vars at startup. | 2h | Clearer error messages, prevents silent failures |
| H4 | **Replace fire-and-forget with `waitUntil()`** in the chat route for background persistence tasks. | 1h | Prevents data loss in serverless |
| H5 | **Configure Upstash Redis** for production rate limiting. The code already supports it; just ensure env vars are set. | 30m | Functional rate limiting at scale |
| H6 | **Remove `unsafe-eval` from CSP**. Test that the app still works without it. If needed for dev only, conditionally include it. | 1h | Significantly strengthens CSP |
| H7 | **Add `loading.tsx`** for key routes (at minimum `/chat` and root). | 1h | Better perceived performance |
| H8 | **Upgrade admin password hashing** to bcrypt/argon2. | 2h | Proper credential security |

### MEDIUM (Fix Within First Month)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| M1 | Add structured logging with correlation IDs. | 4h | Debuggability |
| M2 | Add deep health check endpoint (`/api/health`). | 2h | Monitoring accuracy |
| M3 | Use `next/image` for character avatars and OG images. | 3h | Performance, image optimization |
| M4 | Create proper OG images (1200x630) for social sharing. | 2h | Social media presence |
| M5 | Add unit tests for critical functions (rate limiting, abuse scoring, content safety). | 4h | Regression prevention |
| M6 | Add pre-commit hooks with husky + lint-staged. | 1h | Code quality enforcement |
| M7 | Remove unused `@ai-sdk/openai` dependency. | 10m | Smaller install |
| M8 | Dynamically import `html-to-image`. | 30m | Smaller initial bundle |
| M9 | Tighten Supabase auth settings: `minimum_password_length = 8`, `password_requirements = "lower_upper_letters_digits"`, `enable_confirmations = true`, `max_frequency = "60s"`. | 30m | Auth security |
| M10 | Fix `chat_history` RLS policies to scope guest access more tightly. | 1h | Data isolation |
| M11 | Move memory compaction to a scheduled cron job instead of inline during chat. | 3h | Reduced latency |
| M12 | Memoize Upstash Redis/Ratelimit instances in `rate-limit.ts`. | 30m | Reduced overhead |

### LOW (Track and Address Opportunistically)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| L1 | Add `poweredByHeader: false` to Next config. | 1m | Minor security hardening |
| L2 | Add maskable icon to PWA manifest. | 10m | Better PWA experience |
| L3 | Add service worker for offline fallback. | 4h | PWA completeness |
| L4 | Pin dependency versions exactly. | 30m | Build reproducibility |
| L5 | Consider `motion` (lightweight) instead of full `framer-motion`. | 2h | Bundle size reduction |
| L6 | Add TTL cleanup to in-memory rate limit store. | 30m | Memory leak prevention |
| L7 | Add accessibility audit tooling (axe-core). | 2h | Accessibility compliance |
| L8 | Add Cookie consent banner if any tracking is enabled. | 3h | GDPR/privacy compliance |
| L9 | Add CAPTCHA to auth flows (Turnstile). | 2h | Bot prevention |

---

## Appendix: Files Reviewed

| File | Path |
|------|------|
| Package config | `/package.json` |
| TypeScript config | `/tsconfig.json` |
| Next.js config | `/next.config.ts` |
| ESLint config | `/eslint.config.mjs` |
| PostCSS config | `/postcss.config.mjs` |
| Supabase config | `/supabase/config.toml` |
| Root layout | `/src/app/layout.tsx` |
| Error page | `/src/app/error.tsx` |
| 404 page | `/src/app/not-found.tsx` |
| Sitemap | `/src/app/sitemap.ts` |
| Robots | `/src/app/robots.ts` |
| Global CSS | `/src/app/globals.css` |
| Theme provider | `/src/components/theme-provider.tsx` |
| Analytics lib | `/src/lib/analytics.ts` |
| Chat API route | `/src/app/api/chat/route.ts` |
| Analytics API route | `/src/app/api/analytics/route.ts` |
| Rate limiting | `/src/lib/rate-limit.ts` |
| Supabase server | `/src/lib/supabase/server.ts` |
| Supabase client | `/src/lib/supabase/client.ts` |
| Supabase admin | `/src/lib/supabase/admin.ts` |
| AI OpenRouter | `/src/lib/ai/openrouter.ts` |
| AI Memory | `/src/lib/ai/memory.ts` |
| Chat utils | `/src/lib/chat-utils.ts` |
| Admin auth | `/src/lib/admin/auth.ts` |
| Auth manager | `/src/components/orchestrator/auth-manager.tsx` |
| Error boundary | `/src/components/orchestrator/error-boundary.tsx` |
| Perf monitor | `/src/components/orchestrator/perf-monitor.tsx` |
| Chat layout | `/src/app/chat/layout.tsx` |
| Landing page | `/src/app/page.tsx` |
| Status page | `/src/app/status/page.tsx` |
| Manifest | `/public/manifest.json` |
| Playwright config | `/playwright.config.ts` |
| Git ignore | `/.gitignore` |
| Env file | `/.env.local` |
| Initial migration | `/supabase/migrations/20260203190126_initial_schema.sql` |
| Production checklist | `/design_docs/05_PRODUCTION_CHECKLIST.md` |
| Architecture doc | `/design_docs/02_ARCHITECTURE.md` |

---

*Generated by automated production readiness review on 2026-02-18.*
