# MyGang.ai — Full Pre-Launch Audit Prompt

Copy everything below this line and paste it as your prompt in a fresh Claude Code session.

---

## What You Are Auditing

**MyGang.ai** is a social AI group chat app where users chat with a squad of AI characters who have distinct personalities. Think iMessage group chat, but the friends are AI.

**Live URL:** https://mygang.ai
**Tech stack:**
- Next.js 16 (App Router, Turbopack) with TypeScript strict mode
- Supabase (Postgres + Row Level Security + Auth via `@supabase/ssr`)
- Next.js 16 uses `src/proxy.ts` NOT `middleware.ts` — build fails if both exist
- Upstash Redis for rate limiting (fail-closed in production)
- DodoPayments for billing (webhooks, not Stripe)
- Zustand for client state (with localStorage persistence)
- OpenRouter for AI inference (via `ai` SDK's `generateObject`)
- Google `text-embedding-004` for memory embeddings
- Tailwind CSS v4 (oklch color system — NOT hsl)
- Package manager: pnpm (never npm)

**Tier system:** free / basic ($14.99/mo) / pro ($19.99/mo)

**Key user flows:**
1. Landing page -> Sign up (Google/email) -> Onboarding (pick characters) -> Chat
2. Chat with AI squad -> Characters respond with distinct personalities
3. Memory system remembers user across conversations
4. Upgrade via pricing page -> DodoPayments checkout -> Tier activates
5. Settings panel (Sheet sidebar) -> wallpaper, rename characters, manage subscription, delete account

## What Was Already Done

A previous audit (v3) fixed 51 items across security, database, frontend, performance, chat, and memory. Results are documented in `docs/plans/pre-production-audit-results.md`. That audit missed visual/rendering bugs (like `hsl()` wrapping oklch CSS variables causing transparent backgrounds). **Do NOT re-audit things already marked FIXED in that document.** Focus on finding what it missed.

## Available Tools

You have access to these — use them aggressively:

1. **Supabase CLI** — already logged in. Use `supabase` commands to inspect the live database, run queries, check RLS policies, list functions, etc.
2. **superpowers plugin** — has skills for: brainstorming, dispatching-parallel-agents, systematic-debugging, writing-plans, subagent-driven-development, verification-before-completion, requesting-code-review
3. **playwright plugin** — for browser automation and visual testing
4. **frontend-design plugin** — for UI/design quality assessment
5. **security-guidance plugin** — for security audit patterns
6. **Bash** — full shell access for any command

## How To Conduct This Audit

### Critical Rules

1. **READ EVERY FILE.** Do not just grep for keywords. Open every component, every route, every hook, every lib file, every CSS file. The previous audit missed bugs because it searched by keyword instead of reading file-by-file.

2. **Check EVERY inline style.** The codebase had `hsl(var(--background))` bugs where Tailwind v4 uses oklch values. Search for any remaining `hsl(var(--` in `.tsx`, `.ts`, and `.css` files. Also check any hardcoded color values that should use theme tokens.

3. **Test visually if possible.** Use playwright to load every page and check for visual regressions. Screenshot the landing page, chat page, settings sidebar, onboarding flow, pricing page, checkout success, memory vault, about/privacy/terms pages — in both light and dark mode, desktop and mobile viewport.

4. **Test every user flow end-to-end.** Trace the code path for: sign-up, login, onboarding, sending a message, receiving AI responses, hitting rate limit, upgrading tier, managing subscription, deleting account, deleting chat history, deleting memories.

5. **Read the database schema.** Run `supabase db dump --schema public` or read the initial migration + subsequent migrations to understand the full schema. Check every RLS policy, every function, every trigger, every constraint.

6. **Check the Zustand store.** Read `src/stores/chat-store.ts` carefully — check for race conditions, stale closures, hydration mismatches, localStorage corruption edge cases.

7. **Use parallel agents** (superpowers:dispatching-parallel-agents) to audit different areas simultaneously and maximize coverage.

### Project Structure

```
src/
  app/
    layout.tsx          — root layout, fonts, metadata, ThemeProvider
    page.tsx            — landing page (renders LandingPage component)
    globals.css         — all CSS variables and global styles
    auth/               — login/signup actions, callback, error page
    chat/               — main chat page
    admin/              — admin panel (protected)
    api/
      chat/route.ts     — main chat API (1600+ lines, core business logic)
      chat/rendered/    — rendered message persistence endpoint
      checkout/         — DodoPayments checkout + activation
      customer-portal/  — subscription management redirect
      webhook/dodo-payments/ — billing webhooks
    onboarding/         — character selection flow
    pricing/            — pricing page with tier comparison
    checkout/success/   — post-purchase celebration
    settings/           — settings page (redirects to chat with panel open)
    about/, privacy/, terms/ — info pages
    status/             — system status
    post-auth/          — post-authentication redirect handler
  components/
    chat/               — chat header, input, message list, message item, settings sheet, memory vault, inline toast
    billing/            — messages remaining banner
    effects/            — confetti celebration
    landing/            — landing page component
    onboarding/         — onboarding step components
    orchestrator/       — auth manager, perf monitor
    settings/           — settings panel (legacy, may be unused)
    squad/              — squad management modals
    ui/                 — shadcn/radix primitives (button, sheet, switch, avatar, etc.)
    holographic/        — holographic card effects
  hooks/
    use-chat-api.ts     — chat API integration, typing delays, error handling
    use-chat-history.ts — Supabase chat history sync
    use-autonomous-flow.ts — AI characters talking to each other
    use-typing-simulation.ts — typing bubble simulation
    use-capacity-manager.ts — auto low-cost mode
  lib/
    ai/memory.ts        — memory storage, retrieval, compaction, embeddings
    billing.ts          — tier definitions and helpers
    billing-server.ts   — server-only DodoPayments client
    rate-limit.ts       — Upstash Redis rate limiter
    supabase/           — client and server Supabase helpers
    chat-utils.ts       — message ID sanitization
    analytics.ts        — analytics event tracking
  stores/
    chat-store.ts       — Zustand store (messages, gang, settings, state)
  constants/
    characters.ts       — character definitions
    character-greetings.ts — greeting messages
    wallpapers.ts       — chat wallpaper options
supabase/
  migrations/           — 59 migration files (all applied to production)
  config.toml           — Supabase project config
```

## Audit Areas (check ALL of these)

### 1. Visual and UI Bugs (HIGHEST PRIORITY — this is what the previous audit missed)
- Open every page visually. Check for transparent/invisible elements, wrong colors, broken layouts
- Test light mode AND dark mode on every page
- Test mobile viewport (375px) AND desktop (1440px) on every page
- Check all CSS: inline styles, Tailwind classes, CSS variables, color format mismatches
- Check all animations: framer-motion, CSS transitions, loading states
- Check z-index stacking: modals, sheets, toasts, dropdowns, overlays
- Check safe-area-inset handling for notched phones
- Check font loading: are all declared fonts actually used? Any FOUT/FOIT?
- Check image loading: Next.js Image optimization, alt tags, sizes, lazy loading
- Check scrolling behavior: does chat scroll to bottom properly? Scroll locking during AI response?

### 2. User Flow and Edge Cases
- What happens when a user has 0 messages? 1 message? 1000 messages?
- What happens when chat history load fails? Memory load fails? Auth session expires mid-chat?
- What happens on first visit? Is onboarding forced? Can it be skipped?
- What happens when user refreshes during AI response?
- What happens when user sends a message while previous is still generating?
- What happens on network disconnect/reconnect?
- Back button behavior on every page — any infinite loops or unexpected navigations?
- What happens when localStorage is full or corrupted?
- What happens when two tabs are open simultaneously?
- What happens when user downgrades from pro to free mid-session?

### 3. Security
- Every API route: is it authenticated? Rate limited? Input validated?
- Every Supabase RPC function: does it have auth.uid() guard?
- Every RLS policy: can users access other users' data?
- Are there any SQL injection vectors (string interpolation in queries)?
- Are there any XSS vectors (unsanitized user content rendered as HTML)?
- CSRF protection on mutations?
- Is the admin panel properly protected?
- Are webhook endpoints properly verified (DodoPayments signature)?
- Any secrets/keys exposed in client bundle?
- Can users manipulate their own tier/subscription via client?

### 4. Database Integrity
- Are all foreign keys properly defined with ON DELETE behavior?
- Are all NOT NULL constraints correct? Any columns that should be NOT NULL but aren't?
- Are all CHECK constraints in place (valid enum values, positive numbers, etc.)?
- Are indexes covering the actual query patterns?
- Are there any orphaned rows possible?
- Are all SECURITY DEFINER functions safe (search_path set, auth guards)?
- Run `supabase db lint` if available

### 5. Performance
- Bundle size: what's the total JS shipped to each page? Any unnecessary imports?
- API latency: are there sequential calls that could be parallel?
- Database: any N+1 queries? Missing indexes for common queries?
- Re-renders: any components re-rendering excessively?
- Memory leaks: any useEffect cleanup missing? Timers not cleared?
- Debouncing: any high-frequency operations not debounced (scroll, input, resize)?

### 6. Accessibility (WCAG 2.1 AA)
- Can every interactive element be reached via keyboard?
- Do all inputs have labels? All buttons have accessible names?
- Are focus indicators visible?
- Is color contrast sufficient (4.5:1 for text, 3:1 for large text)?
- Are loading/error states announced to screen readers?
- Can the chat be used with a screen reader?

### 7. Chat Experience
- Is the typing simulation timing natural? Too fast? Too slow?
- Do AI responses feel stuck or instant?
- Is the rate limit experience smooth? Clear messaging?
- Does the cooldown countdown work correctly?
- Are character personalities consistent with their defined voices?
- Does the autonomous flow (characters talking among themselves) work? Is it tier-gated?

### 8. Memory System
- Are memories stored correctly with proper categories?
- Does semantic dedup actually prevent near-duplicates?
- Does compaction preserve category structure?
- Are tier limits enforced (free=20, basic=50, pro=unlimited)?
- Does memory retrieval return relevant results?
- Are embeddings generated only when needed?

### 9. Billing and Payments
- Does the checkout flow work for unauthenticated users? (Should redirect to login)
- Does tier activation happen immediately after payment?
- Are webhook handlers idempotent?
- What happens if webhook arrives before user returns to success page?
- What happens on payment failure/refund?
- Is the customer portal link working?
- Are all tier-gated features actually gated?

### 10. Mobile-Specific
- Touch targets: are all buttons at least 44x44px?
- Does the virtual keyboard push content up properly?
- Does the chat input stay above the keyboard?
- Is the settings sheet (sidebar) properly sized on mobile?
- Do swipe gestures conflict with browser navigation?
- Is the safe area inset handled on iPhone (notch, home bar)?

### 11. Error Handling and Resilience
- Does every API call have error handling?
- Do error boundaries exist for every route?
- Are loading states shown during async operations?
- Are error messages user-friendly (not stack traces)?
- Does the app recover gracefully from Supabase outage? Redis outage? OpenRouter outage?

### 12. SEO and Meta
- Are all pages indexed correctly?
- OpenGraph tags on every public page?
- Structured data valid?
- Sitemap complete?
- robots.txt correct?
- Canonical URLs set?

## Output Format

Create a new file: `docs/plans/full-launch-audit.md`

Structure your findings as:

```
# MyGang Full Launch Audit

## Summary
- X critical (must fix before launch)
- X important (should fix before launch)
- X nice-to-have (can fix post-launch)

## Critical
### [AREA-C1] Short title
- **File:** path/to/file.ts:line
- **What's wrong:** Clear description
- **Impact:** What happens if not fixed
- **Fix:** Specific code change needed
- **Benefit:** --- What fixing this gives the user/app ---

## Important
(same format)

## Nice-to-Have
(same format)
```

**Severity guide:**
- **Critical** = broken functionality, security hole, data loss risk, crash, visual bug users will definitely see
- **Important** = degraded experience, minor security concern, performance issue, accessibility gap
- **Nice-to-have** = polish, optimization, future-proofing

## Final Instructions

- Do NOT re-report items already FIXED in `docs/plans/pre-production-audit-results.md`
- Do NOT include product opinions disguised as bugs (tier tuning, prompt wording preferences, etc.)
- DO include every visual bug you can find — use playwright to screenshot pages if possible
- DO verify each finding by reading the actual code, not guessing
- DO provide specific file paths and line numbers
- DO write the benefit in plain simple English (the developer is a vibe coder, not a senior engineer)
- After creating the audit doc, ask the user if they want you to begin fixing the critical items immediately
