# Phase 03 - Modular System Prompt Architecture

## Goal

Replace the monolithic template literal in `src/app/api/chat/route.ts` with a modular builder system, without silently changing behavior.

This phase is structural. It is about control, safety, and future extensibility.


## Why This Phase Is Mandatory Before Bigger Changes

The current prompt does too much in one place:

- identity
- user info
- character blocks
- custom names
- memory snapshot
- safety
- mode
- purchase celebration
- core rules
- memory extraction rules
- planning
- flow flags

If future features are added on top of the current string literal, the route will become harder to reason about and easier to break.


## Read These Files First

- `src/app/api/chat/route.ts`
- `src/constants/characters.ts`
- `src/lib/ai/memory.ts`
- `tests/api-contract.spec.ts`

Also inspect:

- `src/app/api/chat/route.ts` for `USE_DB_CHARACTERS`
- `src/app/api/chat/route.ts` for purchase celebration handling
- `src/app/api/chat/route.ts` for low-cost and idle-autonomous branches

## Current Repo State

Important facts:

1. The entire system prompt is built inline in `route.ts`.
2. The route already supports DB-sourced prompt blocks through `USE_DB_CHARACTERS`.
3. Custom names, purchase celebration, safety, memory rules, and flow flags are all intertwined in the same string.
4. There is no dedicated prompt regression test today.

## Scope

This phase should include:

1. a new prompt builder module
2. prompt regression tests
3. route wiring to the new builder
4. no intentional behavior changes beyond refactor safety unless explicitly noted

This phase should not include:

- new onboarding data
- WYWA
- push notifications
- large prompt-behavior redesigns beyond what Phase 02 already introduced

## Files Most Likely To Change

- `src/app/api/chat/route.ts`
- new file `src/lib/ai/system-prompt.ts`
- optionally a small shared types file
- one or more Playwright tests for prompt output

## Required Work

### Task 1 - Add Regression Coverage Before Rewiring The Route

This is the most important part of the phase.

Do not refactor the prompt first and promise to test later.


Recommended approach:

- create pure prompt-builder inputs
- snapshot or compare normalized output for a handful of representative scenarios

Suggested scenarios:

1. free tier, greeting-only, no memory snapshot
2. basic tier, ecosystem mode, memory snapshot present
3. pro tier, low-cost mode
4. purchase celebration turn
5. idle-autonomous turn
6. custom names active


You can implement these as Playwright Node-side tests if you do not want to add another test framework.

### Task 2 - Extract A Prompt Builder Module

Recommended file:

- `src/lib/ai/system-prompt.ts`

Recommended shape:

```ts
export function buildSystemPrompt(context: BuildSystemPromptInput): string
```

Recommended design:

- small builder functions for each block
- collect strings into an array
- filter out empty blocks
- join with `\n\n`

Candidate block builders:

- `buildIdentityBlock`
- `buildUserBlock`
- `buildSquadBlock`
- `buildCustomNamesBlock`
- `buildTypingFingerprintBlock`
- `buildDynamicsBlock`
- `buildSafetyBlock`
- `buildModeBlock`
- `buildCelebrationBlock`
- `buildCoreRulesBlock`
- `buildMemoryBlock`
- `buildPlanningBlock`
- `buildFlowFlagsBlock`


### Task 3 - Preserve Existing Source-Of-Truth Decisions

The route currently decides character context like this:

- local constant prompt blocks by default
- DB prompt blocks when `USE_DB_CHARACTERS === 'true'`

Do not bury that logic inside the builder in a way that changes behavior unexpectedly.

Safer pattern:

- build or fetch `characterContext` in the route exactly as today
- pass the final character block text into the prompt builder

### Task 4 - Rewire `route.ts` To Use The Builder

Once regression tests exist:

1. create the builder module
2. move prompt assembly into it
3. keep route-specific data fetching in the route
4. pass plain computed data into the builder

The route should still own:

- fetching profile
- fetching memories
- resolving active gang
- selecting DB prompt blocks
- computing flags

The builder should only own prompt text composition.

## Cautions

### Caution 1 - Do Not Mix Refactor And Product Changes In One Step

The cleanest path is:

1. extract builders while preserving current behavior
2. prove output parity
3. only then make prompt improvements

If you mix extraction and behavior changes together, it becomes impossible to isolate regressions.


### Caution 2 - Preserve The Current Branches

The builder must preserve:

- `greetingOnly`
- `autonomousIdle`
- memory snapshot conditionality
- `allowMemoryUpdates`
- `shouldUpdateSummary`
- purchase celebration
- low-cost mode
- gang-focus vs ecosystem
- safety directive
- custom names
- active squad only

### Caution 3 - Beware Whitespace Drift

Prompt regressions often come from accidental blank lines, missing separators, or concatenation glitches.

It is acceptable to normalize repeated blank lines in tests, but do not normalize so aggressively that real missing blocks become invisible.


### Caution 4 - Keep Metrics And Logging Untouched

The route currently records prompt length metrics and handles provider fallback behavior. This phase should not weaken observability.

## Suggested Implementation Order

1. Define builder input shape.
2. Add regression tests against current behavior.
3. Create `system-prompt.ts`.
4. Move prompt block construction into builders.
5. Rewire route to call the builder.
6. Re-run tests and compare output.
7. Only after parity, do small cleanup.

## Acceptance Criteria

This phase is done when:

1. The monolithic prompt string is no longer in `route.ts`.
2. Prompt assembly lives in a dedicated module.
3. Regression tests cover representative scenarios.
4. Existing route behavior is preserved.
5. The `USE_DB_CHARACTERS` path still works.

## Test Plan

Minimum:

```bash
pnpm lint
pnpm exec playwright test tests/api-contract.spec.ts
```

Recommended:

- add a new Playwright spec that imports the pure builder and verifies representative prompt outputs
- run at least one manual real-model check on a paid-tier-like scenario and a low-cost scenario

## Suggested Commits

1. `chat: add system prompt regression fixtures`
2. `chat: extract modular system prompt builder`
3. `chat: wire route to new system prompt module`

## Nice To Have, Not Required

- Move history formatting into a sibling helper file so the route keeps shrinking.
