# Chat Experience Overhaul

Date: 2026-04-02
Branch: `codex/humanize-chat-experience`

## Why this overhaul happened

The first-touch chat experience felt synthetic in three clear ways:

1. The first welcome was too scripted.
   The app opened with locally scripted greetings before the model had any room to be human. That made the very first impression feel repetitive and flat.

2. Personas were acting like costumes.
   Character instructions were too literal, so Atlas drifted into mission-speak, Vee over-flirted, Sage over-questioned, and Zara kept performing bluntness instead of just sounding like a person.

3. Onboarding ended too abruptly.
   Users were dropped straight from setup into chat with almost no anticipation, context, or emotional handoff.

## What changed

### 1. New arrival handoff between onboarding and chat

Added a dedicated arrival phase so onboarding now lands with a premium, anticipatory transition instead of a sudden route jump.

Key pieces:

- `src/lib/chat-arrival.ts`
  - builds a pending arrival context from the selected squad and custom names
  - stores/consumes that context in session storage
  - generates multi-step arrival copy and the chat-side arrival banner

- `src/app/onboarding/page.tsx`
  - prevents premature redirect to `/chat` while the loading phase is active
  - saves arrival context before routing
  - enforces a longer first-time dwell (~8s) and shorter retake dwell (~3.6s)

- `src/components/onboarding/loading-step.tsx`
  - renders the premium “joining your crew” screen
  - cycles through multi-step copy
  - surfaces the starter Memory Vault perk up front

- `src/app/chat/page.tsx`
  - consumes arrival context on the first chat render
  - shows a warm “Fresh arrival” banner
  - passes arrival context into the local greeting flow so the first welcome behaves like part of the handoff, not a disconnected script

### 2. Softer, more human first-touch greetings

The local greeting flow was reduced and humanized:

- `src/hooks/use-autonomous-flow.ts`
  - limits first-touch greetings to two speakers
  - uses a simpler beat order
  - respects arrival context so the first hello lands slower and more intentionally

- `src/constants/character-greetings.ts`
  - rewrote greeting options to sound like actual people
  - toned down therapist-speak, flirt spam, and role-label repetition

- `src/constants/character-messages.ts`
  - softened welcome/welcome-back copy for the same reason

### 3. System prompt and persona guidance were de-costumed

The main AI framing was changed so persona is guidance, not theater.

- `src/lib/ai/system-prompt.ts`
  - emphasizes one main responder plus an optional lighter second voice
  - adds stronger answer-first, curiosity, small-talk, direct-intro, and anti-loop rules
  - explicitly pushes the model away from meta-talk, role-label filler, and panel-style responses

- `src/lib/ai/character-prompt.ts`
  - rewrites per-character typing tendencies and subtext for all characters
  - makes the guidance lighter and less caricatured

- `src/app/api/chat/route.ts`
  - reduces responder pile-ons
  - raises quality for small talk and direct intro/self-disclosure turns
  - softens extended voice descriptions for the riskiest personas

### 4. Character catalog rows were updated for production

The live chat route can read `public.characters.prompt_block` when DB-backed characters are enabled, so changing local constants alone is not enough for production.

Added migration:

- `supabase/migrations/20260402180000_humanize_character_catalog.sql`

This rewrites the live `public.characters` catalog toward more grounded, human-sounding personas across the roster, including the highest-risk personas called out in testing.

Updated DB columns:

- `voice_description`
- `typing_style`
- `sample_line`
- `personality_prompt`
- `prompt_block`

This keeps production aligned with the softer local prompt direction even when `USE_DB_CHARACTERS=true`.

### 5. Memory Vault starter preview is now a real entitlement boundary

The original free-tier preview blurred hidden memories in the UI, but the hidden memory text was still fetched to the client.

That is now tightened.

- `src/app/auth/actions.ts`
  - `getMemoriesPage()` now returns only the readable preview rows for free users
  - includes preview metadata (`lockedCount`, `previewLimit`, etc.)
  - free-tier `updateMemory()` and `deleteMemory()` now no-op so preview stays read-only
  - `getMemories()` was aligned to the same preview boundary

- `src/components/chat/memory-vault.tsx`
  - consumes server-side preview metadata
  - shows the first five readable memories
  - renders blurred placeholder cards for locked memories instead of hidden real content
  - keeps the upgrade tease intact without leaking locked memory text

- `src/lib/billing.ts`
  - formalizes the free preview limit as `FREE_MEMORY_VAULT_PREVIEW_LIMIT = 5`
  - updates free-tier product copy to reflect the starter memory preview

## Additional UX polish

- `src/components/chat/chat-header.tsx`
  - free users now see `Starter memory` instead of the misleading `Memory active`

- `src/components/chat/message-list.tsx`
  - empty state is warmer and less mechanical

- `src/app/chat/page.tsx`
  - starter chips are more human and less bot-like

- `src/constants/characters.ts`
  - Atlas, Vee, Sage, and Zara local catalog copy was softened for UI/fallback surfaces

## Stability fixes made during the work

- Fixed the onboarding redirect race that could bypass the arrival loader.
- Synced `tests/system-prompt.test.ts` with the intentionally changed prompt contract.
- Replaced a flaky alias import path for `character-greetings` with relative imports in the few affected runtime files so script-style tests stop failing intermittently.
- Added `baseUrl` to `tsconfig.json` to keep path resolution explicit.

## Verification

Passed:

- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm test:fast`
- `pnpm build`

## Recommended follow-up

1. Expand the production persona migration beyond the four touched characters.
   The global prompt softening helps everyone, but the DB catalog for other characters is still more theatrical than ideal.

2. Add dedicated tests for free-tier Memory Vault preview gating.
   The server-side entitlement path is now stronger, but it should have explicit automated coverage.

3. Run a seeded onboarding-to-chat visual pass.
   The code is validated, but this branch would benefit from a final real-browser gut check for motion pacing, copy rhythm, and chat arrival feel.
