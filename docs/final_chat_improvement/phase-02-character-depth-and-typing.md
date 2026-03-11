# Phase 02 - Character Depth and Typing Fingerprints

## Goal

Make characters feel recognizably different even when the user hides the speaker name.

This phase is about expressive output, not architecture.


## Why This Phase Matters

Right now the repo has good character labels, but the prompt mostly relies on prose voice descriptions. In practice, models often collapse into a similar text style unless there is a tighter formatting constraint.

Typing fingerprints are the highest ROI improvement in the entire chat plan.


## Read These Files First

- `src/app/api/chat/route.ts`
- `src/constants/characters.ts`
- `src/hooks/use-chat-api.ts`
- `src/app/api/chat/rendered/route.ts`

Also inspect:

- `src/app/api/chat/route.ts` for `USE_DB_CHARACTERS`
- the current `CHARACTER_EXTENDED_VOICES`

## Current Repo State

Important facts:

1. Character metadata exists in `src/constants/characters.ts`.
2. The chat route also builds prompt blocks from local constants.
3. There is an optional DB-backed prompt-block path when `USE_DB_CHARACTERS === 'true'`.
4. Custom character names are already injected.
5. Current extended voices do not strongly enforce typing style.

## Scope

This phase should include:

1. typing fingerprint block
2. short depth lines for each character
3. filtered clash/alliance dynamics for active squad only
4. a short depth-moment instruction for vulnerable user turns

This phase should not include:

- prompt modularization
- onboarding
- memory migrations
- WYWA

## Files Most Likely To Change

- `src/app/api/chat/route.ts`
- optionally a new helper file such as `src/lib/ai/character-prompt.ts`

## Required Work

### Task 1 - Add Typing Fingerprints

Create a per-character map of typing constraints and inject only active squad entries into the prompt.

Examples of constraints worth including:

- lowercase always vs proper capitalization
- punctuation style
- message length tendency
- emoji tendency
- cadence, such as multiple short bursts vs one medium message


Good implementation pattern:

- `const TYPING_STYLES: Record<string, string>`
- helper that filters to `activeGangSafe`
- inject after squad block, before squad dynamics

Important:

- keep the style block short
- focus on habits the model can reliably follow
- do not overfit to fragile rules like exact word counts every time


### Task 2 - Add One Short `DEPTH:` Line Per Character

The repo already has strong surface-level voices.

Add a short hidden emotional layer to each character. The line should:

- enrich the character
- not dominate every answer
- not make the character melodramatic

Keep each line compact. One or two short sentences is enough.


### Task 3 - Filter Squad Dynamics To Only Relevant Characters

Do not ship a large static relationship web for characters not in the active squad.

Recommended approach:

- define clash pairs
- define alliance pairs
- only emit pairs where both characters are active

This saves tokens and makes the prompt more relevant.


### Task 4 - Add A Depth-Moment Rule

Add one short rule such as:

- when the user is genuinely vulnerable, one character may briefly drop persona
- keep it to one or two messages
- do not make the entire group suddenly become solemn

This should be tied to user context, not random chance.


## Cautions

### Caution 1 - Preserve `USE_DB_CHARACTERS`

The repo can build character prompt blocks from Supabase when `USE_DB_CHARACTERS` is enabled.

Do not accidentally hard-code a path that only works for local constants.

Safe pattern:

- leave existing character-block source logic intact
- inject typing fingerprints as a separate prompt block

### Caution 2 - Do Not Make The Characters Too "Written"

The current product goal is "real group chat messages", not literary dialogue.

Depth lines should add subtext, not turn normal chat into constant dramatic monologues.


### Caution 3 - Custom Names Must Still Work

Custom names are already supported in the prompt.

Any new character-related prompt block must continue to refer to characters by ID and let the existing custom-name directive do its job.

### Caution 4 - Mock AI Is Not Enough

The mock route does not prove that voices are actually more distinct.

This phase benefits from at least a manual real-model check with two or three different user prompts.

## Suggested Implementation Order

1. Add typing-style map and filtered builder.
2. Inject the typing block into the current prompt.
3. Add depth lines to extended voices.
4. Add filtered clashes and alliances.
5. Add the depth-moment rule.
6. Run lint and smoke tests.

## Acceptance Criteria

This phase is done when:

1. The prompt includes typing fingerprints only for active squad members.
2. Each character has one short `DEPTH:` line.
3. Dynamics mention only active characters.
4. The prompt has a depth-moment instruction.
5. Manual model outputs make characters easier to distinguish by text alone.

## Test Plan

Minimum:

```bash
pnpm lint
pnpm exec playwright test tests/api-contract.spec.ts
```


Recommended manual checks:

1. Ask a neutral question and verify different characters type differently.
2. Ask a vulnerable question and verify one character softens without collapsing the whole cast.
3. Use custom character names and confirm output still respects them.

## Suggested Commits

1. `chat: add typing fingerprints for active squad`
2. `chat: add character depth lines`
3. `chat: filter squad dynamics to active members`

## Nice To Have, Not Required

- If the prompt code starts feeling crowded, extract typing-style and dynamics builders into a helper file now. That can reduce friction for Phase 03.
