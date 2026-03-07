# MyGang.ai — Deep Audit

## The App
MyGang.ai is an AI group chat app — users chat with a squad of AI characters with distinct personalities. Next.js 16 (App Router), Supabase (Postgres + RLS + Auth via @supabase/ssr), Upstash Redis rate limiting, DodoPayments billing, Zustand state, OpenRouter AI inference, Tailwind CSS v4 (oklch colors). Uses `src/proxy.ts` NOT middleware.ts. Package manager: pnpm. Tiers: free / basic ($14.99) / pro ($19.99).

## Previous Audits
Previous audit results are in `docs/plans/full-launch-audit.md` and `docs/plans/pre-production-audit-results-old.md`. Read both FIRST. Do NOT re-report anything already listed there (fixed or unfixed). Only find NEW issues.

## How to Audit

1. **Use parallel agents** (superpowers:dispatching-parallel-agents) to cover all areas simultaneously
2. **Read every file** — don't just grep keywords. Open components, routes, hooks, stores, lib files, CSS
3. **Query the live DB** — use `supabase` CLI commands to inspect schema, RLS policies, functions, indexes. Run `supabase db lint` if available
4. **Check visually** — look for color mismatches (oklch not hsl), broken dark mode, z-index conflicts, missing responsive handling
5. **Trace every user flow** — sign up, onboard, chat, hit rate limit, upgrade, downgrade, delete account. Check edge cases at each step
6. **Check the Zustand store** (`src/stores/chat-store.ts`) for race conditions, hydration issues, multi-tab bugs
7. **Verify billing** — webhook idempotency, tier gating on server AND client, payment failure handling

## Areas to Cover
- Security: auth, RLS, input validation, rate limiting, XSS, secrets exposure
- Visual/CSS: colors, dark mode, z-index, animations, fonts, mobile viewport, safe-area
- User flows: edge cases, error states, loading states, navigation, back button
- Database: schema integrity, FK constraints, CHECK constraints, indexes, trigger safety
- Performance: sequential calls, N+1 queries, bundle size, memory leaks, missing cleanup
- Accessibility: keyboard nav, ARIA, focus traps, screen reader, color contrast
- SEO: metadata, OpenGraph, sitemap, robots, structured data
- Chat: typing simulation, rate limit UX, autonomous flow, memory system
- Billing: checkout flow, webhook handling, tier enforcement, downgrade handling

## Output
Create `docs/plans/deep-audit-YYYY-MM-DD.md` with:

```
# MyGang Deep Audit

## Summary
- X critical / X important / X nice-to-have

## Critical
### [AREA-C1] Title
- **File:** path:line
- **What's wrong:** ...
- **Impact:** ...
- **Fix:** specific code change
- **Benefit:** plain English

## Important
(same format)

## Nice-to-Have
(same format)
```

Severity: Critical = broken/security hole/data loss/crash. Important = degraded UX/minor security/perf. Nice-to-have = polish.

After creating the doc, ask if I want you to start fixing critical items.
