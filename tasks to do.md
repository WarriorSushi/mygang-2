# Tasks To Do

## Workflow Rule
- For every new user prompt:
- Add the request here first with `Status: Pending` or `In Progress` before coding.
- After implementation, update to `Done` with a short "what was changed" note.

## Current Prompt (2026-02-07)

## Current Prompt (2026-02-10)

### 11) Admin Panel V1 Implementation + Scratchpad Fix
- Status: Done
- Request:
  - Start implementing admin panel.
  - Fix `scratchpad.md` so it contains only admin panel temporary planning notes.
  - Clarify env/hash setup steps for Vercel.
- Done:
  - Implemented admin panel v1:
    - `/admin/login` (env-based admin sign-in).
    - `/admin/overview` protected with signed admin cookie session.
    - `/admin` root redirect to login/overview based on session.
  - Added admin auth/session internals:
    - `src/lib/admin/auth.ts` supports plain password env and optional hash env.
    - `src/lib/admin/session.ts` adds signed httpOnly admin session cookie helpers.
    - `src/app/admin/actions.ts` adds `adminSignIn` / `adminSignOut`.
    - `src/app/admin/(protected)/layout.tsx` applies guard and signed-in header.
    - `src/app/admin/(protected)/overview/page.tsx` shows read-only operational metrics.
  - Rewrote `scratchpad.md` to admin-only temporary notes.
  - Validation:
    - `npm run lint` passes (existing warnings only).
    - `npm run build` passes.

### 10) Reset Scratchpad + Admin Env Guidance
- Status: Done
- Request:
  - Clear `scratchpad.md` temporary content fully if safe.
  - Re-add only admin panel planning notes there.
  - Provide exact Vercel env vars and any other required setup.
- Done:
  - Reset `scratchpad.md` content and replaced it with admin panel planning only.
  - Kept it lightweight and temporary-focused.
  - Prepared exact Vercel env setup guidance for admin auth.

### 9) Commit + Push + Admin Panel Prep Notes
- Status: Done
- Request:
  - Commit and push current work.
  - Add admin auth env variables locally (not hardcoded in code).
  - Write detailed admin panel powers/uses/benefits notes in `scratchpad.md`.
- Done:
  - Added admin panel planning notes in `scratchpad.md`:
    - powers, use-cases, benefits, security notes, page map, and phased build sequence.
  - Added local-only env entries in `.env.local` (gitignored):
    - `ADMIN_PANEL_EMAIL`
    - `ADMIN_PANEL_PASSWORD`
  - Committed and pushed all pending tracked changes to `origin/master`:
    - commit: `dbf2b72`

### 8) Tiny Auto Low-Cost Indicator Icon
- Status: Done
- Request:
  - Add a very small icon in chat UI for temporary auto low-cost mode.
  - On click, show a compact info message explaining why it is active.
- Done:
  - Added a tiny header info icon that appears only when temporary auto low-cost mode is active.
  - Clicking the icon opens a compact explanatory popover.
  - Wired from chat runtime state to header:
    - `src/app/chat/page.tsx` passes `autoLowCostActive`.
    - `src/components/chat/chat-header.tsx` renders icon + popover.
  - Validation:
    - `npm run lint` passes (existing warnings only).
    - `npm run build` passes.

### 7) Adaptive Low-Cost Auto Mode + Supabase Apply Attempt
- Status: Done
- Request:
  - Continue with the next systematic step from `scratchpad-decision-review.md`.
  - Implement adaptive capacity handling without hurting UX:
    - temporary auto low-cost profile on repeated 429/402
    - automatic recovery after stable successful user turns
    - keep user send latency immediate
  - Attempt applying Supabase migration if local environment is connected.
  - Keep `scratchpad.md` as temporary/lightweight notes only.
- Done:
  - Implemented adaptive temporary low-cost runtime policy in `src/app/chat/page.tsx`:
    - triggers temporary auto low-cost profile on repeated capacity failures (429/402).
    - uses effective low-cost behavior (`manual OR temporary-auto`) for payload size and autonomy suppression.
    - keeps user send path immediate (no new user-send delay).
    - adds automatic recovery back to full mode after stable successful user turns.
    - records low-cost state metadata in `chat_api_call` analytics.
  - Improved capacity backoff behavior:
    - honors `Retry-After` header when available and enforces minimum autonomous cooldown.
  - Applied Supabase migrations to remote with CLI and verified parity:
    - `supabase db push` applied pending migrations.
    - `supabase migration list` confirms local/remote timestamps are aligned.

### 6) Systematic Plan Execution + Scratchpad Cleanup
- Status: Done
- Request:
  - Clean up `scratchpad.md` if it is no longer important (temporary discussion file).
  - Follow `scratchpad-decision-review.md` and execute plan systematically.
  - Implement next planned items without harming UX.
- Done:
  - Implemented Phase 2 low-cost controls end-to-end:
    - added `lowCostMode` to chat store persistence.
    - added low-cost toggles in both in-chat controls and settings page.
    - persisted setting via `profiles.low_cost_mode` and wired auth/session sync.
    - added migration `supabase/migrations/20260210173000_add_low_cost_mode.sql`.
  - Implemented runtime low-cost behavior without delaying user sends:
    - client suppresses autonomous follow-ups in low-cost mode.
    - reduced payload size further in low-cost mode (`10` recent messages).
    - API enforces smaller budgets (history/output/responders/event count) in low-cost mode.
    - API prevents `should_continue` in low-cost mode.
  - Implemented observability hooks:
    - client emits `chat_api_call` analytics with source/status/attempt/payload size.
    - API emits structured `chat_route_metrics` logs including source, provider, counts, prompt chars, and latency.
  - Compacted server system prompt while preserving core behavior and safety constraints.
  - Cleaned `scratchpad.md` to temporary-only content and kept canonical plan in `scratchpad-decision-review.md`.
  - Validation completed:
    - `npm run lint` passed (existing warnings only).
    - `npm run build` passed.

### 5) Rewrite Decision Review Into Final Plan
- Status: Done
- Request:
  - Read `scratchpad-decision-review.md`.
  - If agreed, delete existing content and rewrite a proper plan including those recommendations.
- Done:
  - Replaced entire `scratchpad-decision-review.md` with a structured final plan:
    - decision summary (keep/modify/do next/do not do),
    - phased implementation plan,
    - degradation ladder,
    - thresholds,
    - UX guardrails,
    - rollback and success criteria.

### 4) Move Decision Section To Separate File
- Status: Done
- Request:
  - Remove the decision/recommendation review section from `scratchpad.md`.
  - Write it separately.
- Done:
  - Removed the decision matrix/recommendation block from `scratchpad.md`.
  - Created `scratchpad-decision-review.md` with that full content.

### 3) Review External AI Opinions + Decision Write-up
- Status: Done
- Request:
  - Review updated `scratchpad.md` opinions and decide what to do/not do.
  - Provide modifications and rationale.
  - Write detailed conclusions back into `scratchpad.md`.
- Done:
  - Added a detailed decision matrix to `scratchpad.md`:
    - do / do with modification / do not do
    - UX impact reasoning
    - delay policy (autonomous only, not user sends)
    - recommended degradation ladder under quota stress.

### 2) Deep Explainability Walkthrough In Scratchpad
- Status: Done
- Request:
  - Explain with a long concrete chat example.
  - Show exactly what client sends, what server trims/builds, what model returns, and what next turn sends.
  - Include prompt composition and API response examples.
- Done:
  - Expanded `scratchpad.md` with a long simulated timeline (21+ messages), request/response JSON examples, model prompt assembly walkthrough, and next-turn sliding-window behavior.
  - Added explicit 16->12 context window explanation and 429/402 backoff/cooldown behavior with ASCII flow.

### 1) Quota/Rate-Limit Root Cause + UX-Safe Fixes
- Status: Done
- Request:
  - Investigate whether chat is making too many API calls and why Gemini/OpenRouter limits keep failing.
  - Keep UX quality while reducing unnecessary provider calls.
  - Update `scratchpad.md` with findings and ASCII visualization.
  - Update this task log properly.
- Done:
  - Added deep investigation notes and architecture map in `scratchpad.md`.
  - Streamlined request size in `src/app/api/chat/route.ts`:
    - capped LLM history, per-message content, memory/profile snapshot lengths.
    - kept capped output tokens and zero SDK retries.
  - Added server-side provider cooldown/circuit-breaker behavior in `src/app/api/chat/route.ts`:
    - detects 429/402 capacity failures.
    - sets temporary cooldowns for Gemini/OpenRouter.
    - returns clear `429` with `Retry-After` instead of repeated hammering/fallback churn.
  - Reduced burst behavior in `src/app/chat/page.tsx` without hurting normal sends:
    - outbound payload reduced (`24 -> 16` messages).
    - autonomous calls now use temporary backoff after 429/402.
    - added slight spacing delay for autonomous-only calls.
    - reduced idle autonomous follow-ups from 2 to 1.
    - blocked idle-autonomous scheduling after failed API calls.
  - Verified with local `npm run lint` and `npm run build` (pass, warnings only).

### 5) Commit And Push Request
- Status: Done
- Request:
  - Commit and push the pending local changes.
- Done:
  - Committed pending landing hydration safety fix and task log update.
  - Pushed latest commit to `origin/master`.

### 4) Verify Landing Changes Visibility
- Status: Done
- Request:
  - Investigate why landing page changes are not visible.
  - Check exactly what was changed and whether those changes are in the pushed code / live output.
- Findings:
  - Verified `master` on origin contains commit `43fb648` with landing edits in `src/components/landing/landing-page.tsx`.
  - Live `https://mygang.ai` response did not include new landing strings (served older deployment content).
  - Observed production hydration error (`React #418`) from a landing chunk.
- Actions:
  - Confirmed changed sections/strings exist in repository code.
  - Added a hydration-safe theme toggle mount check in landing page using `useSyncExternalStore` to reduce mismatch risk.

### 1) Task Log System
- Status: Done
- Request:
  - Create this markdown file and keep it updated for every prompt.
  - Before starting any work, log the prompt here.
- Done:
  - Created `tasks to do.md`.
  - Logged this prompt before implementation.

### 2) Audit Last 15 Prompts
- Status: Done
- Request:
  - Review the recent last 15 user prompts.
  - Identify which requested items are still not done.
  - Add pending items in this file and implement them.
- Audit Result:
  - Most chat bubble, contrast, spacing, and desktop/mobile layout asks from recent prompts are already implemented in current codebase/history.
  - Pending and now being handled:
    - Ensure cross-device chat sync behavior is robust when two sessions are open.
    - Ensure "clear timeline" also clears DB history.
    - Rename action text to `Delete All Messages`.
    - Improve/refresh landing "How it works" + "Why it feels real" so it is clearly visible and strong on mobile.

### 3) Landing Page Items Reported As Missing
- Status: Done
- Request:
  - Replace the "4 Friends In Your Crew" style copy with a better non-limiting value proposition.
  - Make "How it works" section more beautiful, detailed, and fun.
  - Add a prewritten animated chat demo feeling warm/witty (no real API call).
  - Make mobile version swipable and desktop multi-instance if possible.
  - Ensure the hero CTA scrolls smoothly to this section.
  - Improve "Why it feels real" section quality.
- Done:
  - Updated value cards wording to avoid limiting framing.
  - Expanded `How it works` with a prominent `Live Walkthrough` panel.
  - Kept and polished prewritten animated demo threads.
  - Preserved mobile swipe cards and desktop multi-card layout; widened mobile card width for visibility.
  - Smooth scroll CTA is in place to `#how-it-works`.
  - Added a stronger `Why this feels different` comparison panel under `Why it feels real`.

## Pending Items Discovered During Audit
- Status: Done
- Items:
  - Cross-device sync reliability polish for authenticated users with periodic/focus refresh from cloud history.
  - Replace local-only timeline clear with DB-backed clear + local reset.
  - Rename danger action to `Delete All Messages`.
  - Strengthen landing mobile visibility/quality for:
    - stats/value cards copy impact
    - "How it works" visual walkthrough depth
    - "Why it feels real" presentation quality
- Done:
  - Added periodic/focus cloud history sync for authenticated chat sessions.
  - Added server action to delete `chat_history` rows for current user and wired settings button to use it.
  - Renamed action label to `Delete All Messages`.
  - Added local timeline-cleared event handling for immediate UI reset.
  - Added API resilience: retry on transient 5xx, safer fallback message generation when providers fail.
