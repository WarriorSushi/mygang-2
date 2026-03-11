# Final Chat Improvement Plan

This folder is the replacement for `docs/chat_improvements`.

Latest handoff note:

- `session-handoff-2026-03-12.md`

It is written so each phase can be executed on its own by a smaller model or engineer without needing the deleted source folder. Each phase document includes:

- current repo state
- exact areas to read first
- implementation tasks
- warnings and cautions
- acceptance criteria
- testing guidance
- suggested commit boundaries


## Read This First

Before starting any phase, keep these repo facts in mind:

1. Active squad filtering is already implemented in `src/app/api/chat/route.ts`.
2. Memory extraction rules are already conditionally gated in `src/app/api/chat/route.ts`.
3. `inside_joke` already exists in the prompt schema and memory type system.
4. `theme` already exists on `profiles`.
5. `match_memories` already returns `importance`, `created_at`, `last_used_at`, and `category`.
6. User chat rows and rendered AI chat rows are persisted through different paths:
   - user-side persistence: `src/app/api/chat/route.ts`
   - rendered AI persistence: `src/app/api/chat/rendered/route.ts`
7. The chat route currently has a `USE_DB_CHARACTERS` branch. Do not accidentally delete or bypass it during refactors.
8. There is no `vercel.json` cron config and no `supabase/functions` directory today.
9. There is already client-side idle autonomous behavior in `src/hooks/use-autonomous-flow.ts`.
10. There is already a browser `Notification` path for cooldown reminders in `src/hooks/use-chat-api.ts`. This is not push infrastructure, but it means the app is not starting from absolute zero on notifications.
11. The onboarding page currently redirects away when local store already has a squad. Retake flows must explicitly bypass that behavior.


## Recommended Order

Do the phases in this order:

1. Phase 01 - Foundation and Token Efficiency
2. Phase 02 - Character Depth and Typing Fingerprints
3. Phase 03 - Modular System Prompt Architecture
4. Phase 04 - Memory Intelligence and Relationship State
5. Phase 05 - Onboarding and Vibe Quiz
6. Phase 06 - While You Were Away
7. Phase 07 - Retention, PWA, and Re-engagement

This order is deliberate:

- Phases 01-03 improve the core chat loop with the lowest product risk.
- Phase 04 builds on the stabilized prompt shape.
- Phase 05 changes onboarding and profile data contracts, so it should not be mixed with core prompt surgery.
- Phase 06 needs stable prompt architecture and message source handling first.
- Phase 07 depends on Phase 06 for the highest-value retention features.


## Global Rules

1. Do not re-implement things that already exist.
2. Do not combine multiple phases in one PR unless explicitly asked.
3. Prefer small, reviewable commits inside each phase.
4. For any new DB column or function change:
   - add a migration
   - update `src/lib/database.types.ts`
   - update any profile/history fetchers that read the affected table
5. For any chat-history-related change:
   - inspect both `src/app/api/chat/route.ts` and `src/app/api/chat/rendered/route.ts`
   - inspect `src/app/auth/actions.ts:getChatHistoryPage`
   - inspect `src/hooks/use-chat-history.ts`
6. For any prompt refactor:
   - preserve existing behavior first
   - only improve behavior after regression tests exist
7. For any onboarding work:
   - inspect `src/app/onboarding/page.tsx`
   - inspect `src/lib/supabase/client-journey.ts`
   - inspect `src/app/auth/actions.ts`
   - inspect `src/components/settings/settings-panel.tsx`
8. For any retention work:
   - do not assume service worker, push, cron, or edge functions already exist


## Useful Commands

Run these after each phase as applicable:

```bash
pnpm lint
pnpm exec playwright test tests/api-contract.spec.ts
pnpm exec playwright test tests/chat-flow.spec.ts
pnpm exec playwright test tests/user-journey.spec.ts
pnpm exec playwright test tests/onboarding-auth.spec.ts
```


Notes:

- There is no dedicated unit-test runner configured today beyond Playwright.
- If a phase introduces pure helper functions, it is acceptable to test them from Playwright's Node-side test environment instead of adding a new test framework.

## Phase Map

- `phase-01-foundation-and-token-efficiency.md`
- `phase-02-character-depth-and-typing.md`
- `phase-03-modular-system-prompt.md`
- `phase-04-memory-intelligence.md`
- `phase-05-onboarding-vibe-quiz.md`
- `phase-06-wywa-background-chat.md`
- `phase-07-retention-pwa-and-reengagement.md`

## Admin Pending

- `admin-pending-setup.md`
