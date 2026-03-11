# Phase 05 - Onboarding and Vibe Quiz

## Goal

Capture user intent and interaction preferences early enough to shape the chat experience from the first real conversation.

This phase changes product flow, profile data, UI state, and tests. Treat it as a wide phase.


## Read These Files First

- `src/app/onboarding/page.tsx`
- `src/components/onboarding/identity-step.tsx`
- `src/components/onboarding/selection-step.tsx`
- `src/components/onboarding/friends-intro-step.tsx`
- `src/lib/supabase/client-journey.ts`
- `src/app/auth/actions.ts`
- `src/components/settings/settings-panel.tsx`
- `tests/user-journey.spec.ts`
- `tests/onboarding-auth.spec.ts`

## Current Repo State

Important facts:

1. Onboarding is currently a 5-step flow:
   - welcome
   - identity
   - selection
   - intro
   - loading
2. Existing onboarding bypasses to `/chat` when local store already has a squad.
3. `persistUserJourney()` does not know about `vibe_profile`.
4. `updateUserSettings()` does not accept `vibe_profile`.
5. Settings already has a destructive "Start Fresh" path.
6. There is currently no non-destructive retake flow.

## Scope

This phase should include:

1. `vibe_profile` schema support
2. a redesigned onboarding state machine
3. quiz screens
4. recommendation logic
5. retake flow
6. persistence updates
7. test updates

This phase should not include:

- WYWA
- push notifications
- memory migrations unrelated to `vibe_profile`

## Recommended Product Direction

Use a short mandatory flow plus optional deep customization.

Recommended mandatory concepts:

1. display name
2. primary intent
3. warmth style
4. chaos level
5. squad selection with recommendations

Recommended optional concepts:

1. honesty level
2. energy
3. texting style


## Recommended Schema

Add to `profiles`:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vibe_profile JSONB DEFAULT NULL;
```

Example shape:

```json
{
  "primary_intent": "humor",
  "warmth_style": "balanced",
  "chaos_level": "lively",
  "honesty_level": "honest",
  "energy": "reflective",
  "user_style": "rapid"
}
```


## Files Most Likely To Change

- `src/app/onboarding/page.tsx`
- new components under `src/components/onboarding/`
- `src/lib/supabase/client-journey.ts`
- `src/app/auth/actions.ts`
- `src/lib/database.types.ts`
- `src/components/settings/settings-panel.tsx`
- Playwright onboarding tests

## Required Work

### Task 1 - Add `vibe_profile` To Persistence Contracts

Update all read/write layers that touch onboarding-related profile state:

- Supabase migration
- `src/lib/database.types.ts`
- `JourneyProfile` in `src/lib/supabase/client-journey.ts`
- `fetchJourneyState()`
- `persistUserJourney()`
- `updateUserSettings()` if settings will allow retake or edits

Do not add the column and stop there. The app will drift if the write path and read path disagree.

### Task 2 - Rewrite The Onboarding Step Machine

Current onboarding step type is a short fixed union.

You will need:

- more steps
- back navigation
- skip handling for optional screens
- stable transitions

Recommended approach:

- keep a clear step enum or ordered list
- separate mandatory and optional sections
- do not implement branching with ad hoc booleans scattered through the page

### Task 3 - Add Recommendation Logic

Character recommendation logic should be a pure function, not UI-only inline logic.

Recommended file:

- `src/lib/ai/character-recommendation.ts` or similar

The function should:

- accept quiz answers
- return ranked character IDs
- stay deterministic

Do not hide recommendation logic inside a component where it is hard to test.


### Task 4 - Add A Retake Flow

This repo already has a destructive reset flow. A vibe-quiz retake should usually be non-destructive.

Recommended behavior:

- preserve chat and memories
- let the user revisit the quiz
- overwrite `vibe_profile` on completion
- optionally let them repick squad if product wants it

Critical repo-specific issue:

`src/app/onboarding/page.tsx` currently redirects to `/chat` when local store already has two or more active members.

That means retake must explicitly bypass this logic.


Recommended options:

1. `/onboarding?retake=true`
2. `/onboarding/retake`

Either is fine. The important part is to avoid accidental redirect.


### Task 5 - Add Settings Entry Point

The settings page currently offers "Start Fresh", which wipes data.

Add a separate button for vibe retake. Do not overload "Start Fresh".

### Task 6 - Update Tests

This phase changes the most test surface.

At minimum revisit:

- `tests/user-journey.spec.ts`
- `tests/onboarding-auth.spec.ts`
- `tests/chat-flow.spec.ts`
- any visual onboarding tests

## Cautions

### Caution 1 - Theme Handling Is Slightly Uneven Today

Parts of the repo allow `theme: 'light' | 'dark' | 'system'`, while some UI only exposes light and dark.

If onboarding adds theme selection, do not accidentally strip or break `system` handling elsewhere.

### Caution 2 - Keep The Flow Short

The product goal is personalization, not a long survey.

Even if you add optional depth screens, the mandatory path should still feel fast.

If completion drops in testing, merge some quiz inputs together or move more questions into an optional follow-up/settings flow.

### Caution 3 - Do Not Make Retake Destructive By Accident

Retake and Start Fresh should stay distinct:

- retake: update vibe choices
- start fresh: wipe chat, memories, and squad

### Caution 4 - Squad Limits Already Depend On Tier

The route supports more than the onboarding UI currently exposes. Be careful not to hard-code a new mismatch between onboarding selection and tier rules.


## Suggested Implementation Order

1. Add `vibe_profile` migration and types.
2. Update profile fetch/write helpers.
3. Implement recommendation helper as a pure function.
4. Rewrite onboarding step machine.
5. Add new screens.
6. Add retake route or query-param bypass.
7. Add settings entry point.
8. Update tests.

## Acceptance Criteria

This phase is done when:

1. `vibe_profile` is stored on `profiles`.
2. New onboarding captures quiz answers and persists them.
3. Recommended characters are shown deterministically.
4. Retake flow works for existing users.
5. Existing onboarding redirect no longer blocks retake.
6. Updated onboarding tests pass.

## Test Plan

Minimum:

```bash
pnpm lint
pnpm exec playwright test tests/user-journey.spec.ts
pnpm exec playwright test tests/onboarding-auth.spec.ts
```

Recommended:

- run `tests/chat-flow.spec.ts`
- run visual onboarding tests if UI changed significantly

## Suggested Commits

1. `onboarding: add vibe profile schema and persistence`
2. `onboarding: add quiz state machine and recommendation engine`
3. `settings: add vibe retake flow`
4. `test: update onboarding and journey coverage`

## Nice To Have, Not Required

- Save incomplete quiz progress locally if product wants recovery after refresh.
