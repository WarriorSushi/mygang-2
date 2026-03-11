# Session Handoff - 2026-03-12

## Status

The planned chat improvement work is effectively complete.

Completed and merged:

1. Phase 01 - Foundation and Token Efficiency
2. Phase 02 - Character Depth and Typing Fingerprints
3. Phase 03 - Modular System Prompt Architecture
4. Phase 04A - Memory Intelligence
5. Phase 04B - Memory Embedding Backfill on Upgrade
6. Phase 05 - Onboarding Vibe Quiz
7. Phase 06A - Message Source Foundation
8. Phase 06B - WYWA-safe History and UI
9. Phase 06C - Manual WYWA Generator Core
10. Phase 06D - WYWA Scheduler
11. Phase 07A - PWA Baseline and Title Presence
12. Phase 07B - Push Subscription Infrastructure
13. Phase 07C - WYWA Push Teasers
14. Supabase migration reconciliation
15. `handle_updated_at()` execute permission cleanup

## What Is Now Live In The Codebase

- Compact prompt/history formatting for chat.
- Smarter prompt architecture with extracted system prompt builder.
- Better character voice separation and squad-aware dynamics.
- Memory expiration with `expires_at`.
- Memory retrieval/scoring improvements.
- Upgrade-triggered embedding backfill for paid users.
- Onboarding vibe quiz and `vibe_profile`.
- WYWA ("While You Were Away") message generation.
- WYWA-safe history source tracking with `chat`, `wywa`, and `system`.
- Admin WYWA trigger.
- Scheduled WYWA cron path.
- PWA baseline with service worker and offline fallback.
- Title-based unread presence.
- Push subscription storage and settings opt-in flow.
- WYWA teaser push sending.

## Important Environment / Ops State

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is required for browser subscription setup.
- `VAPID_PRIVATE_KEY` is required for server-side push send.
- `VAPID_SUBJECT=mailto:support@mygang.ai` is the chosen contact identity.
- `CRON_SECRET` must exist in Vercel for the WYWA cron route.
- Vercel cron schedule is currently daily at `09:00 UTC` for Hobby compatibility.

## Supabase State

Supabase migration history was reconciled.

- Local and remote migration histories are aligned.
- Missing remote migrations were fetched into the repo.
- Missing local migrations were pushed online.
- The security cleanup revoking execute on `public.handle_updated_at()` from `anon` and `public` was applied.

## Known Good Checks

At the end of this session, the following passed:

- `pnpm exec tsc --noEmit`
- `pnpm run build`
- `tests/vapid.test.ts`
- `tests/push-send.test.ts`
- `tests/tab-presence.test.ts`
- `tests/wywa-batch.test.ts`
- `tests/wywa-generator.test.ts`
- `tests/chat-history-source.test.ts`
- `tests/chat-source-filter.test.ts`

## Recommended First Tasks Tomorrow

Do not start a new feature branch first.

Start with production/runtime validation:

1. Confirm Vercel env vars are present:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT`
   - `CRON_SECRET`
2. Run one real notification smoke test in production:
   - enable notifications in settings
   - verify a `push_subscriptions` row is created
   - manually trigger WYWA from admin
   - confirm exactly one teaser push arrives
3. Verify cron/WYWA operationally:
   - confirm the protected internal WYWA route works with the cron secret
   - confirm one real scheduled run creates WYWA rows only for eligible users
4. Check logs:
   - Vercel function logs
   - Supabase logs if needed
   - confirm no push-send or WYWA scheduler errors are recurring

## If There Are No Runtime Issues

If production smoke is clean, the next work should be stabilization, not another major feature push.

Good follow-ups:

- Add analytics/dashboard visibility for:
  - notification opt-in rate
  - WYWA generation count
  - WYWA push delivery attempts / stale subscription cleanup count
- Review whether PostHog is worth adding later.
- Watch for real user feedback before adding more retention features.

## Things To Avoid Tomorrow

- Do not rewrite migrations again.
- Do not start a mobile app build yet.
- Do not add more notification campaigns until WYWA push is proven stable.
- Do not touch `.env.local` in commits.

