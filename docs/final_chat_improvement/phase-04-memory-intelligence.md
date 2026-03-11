# Phase 04 - Memory Intelligence and Relationship State

## Goal

Improve memory relevance and temporal correctness without replacing the existing memory architecture.

This phase should evolve the current system, not restart it.


## Read These Files First

- `src/lib/ai/memory.ts`
- `src/app/api/chat/route.ts`
- `supabase/migrations/20260307160000_audit_v3_db_fixes.sql`
- `src/lib/database.types.ts`
- `src/app/api/webhook/dodo-payments/route.ts`

## Current Repo State

Important facts:

1. `retrieveMemoriesHybrid()` already exists.
2. Current ranking already blends:
   - semantic similarity
   - recency
   - importance
   - usage frequency
3. `match_memories` already returns:
   - `id`
   - `content`
   - `similarity`
   - `importance`
   - `created_at`
   - `last_used_at`
   - `category`
4. Basic overlap-based conflict resolution already exists.
5. `inside_joke` is already a supported category.
6. Free tier skips embedding generation for stored memories.

## Scope

This phase should include:

1. category-priority refinement
2. temporal memory support
3. improved extraction framing for importance and inside jokes
4. compact relationship-board rendering
5. optional embedding backfill on upgrade

This phase should not include:

- replacing the whole retrieval formula
- hard deleting memories based on LLM opinion
- major onboarding work

## Files Most Likely To Change

- `src/lib/ai/memory.ts`
- `src/app/api/chat/route.ts`
- `src/lib/database.types.ts`
- one or more new Supabase migrations
- optionally `src/app/api/webhook/dodo-payments/route.ts`

## Required Work

### Task 1 - Keep The Composite Score, Improve It

Do not replace the current retrieval formula with a pure exponential-decay formula.

That would be a regression because the repo already uses more than similarity.


Safe direction:

- keep the current composite score structure
- add category priority as a light tiebreaker or small score contribution
- optionally refine recency decay while preserving importance and usage

Good target behavior:

- recent relevant memories win
- important stable memories do not disappear too quickly
- inside jokes and major life events beat bland topical memories when scores are close


### Task 2 - Add Temporal Memory Columns

Recommended migration:

```sql
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS memories_expires_at_idx
  ON public.memories (user_id, expires_at)
  WHERE expires_at IS NOT NULL;
```


After migration:

- update `src/lib/database.types.ts`
- use `expires_at IS NOT NULL` as the temporal signal unless a future implementation proves a separate boolean is needed
- update stored memory shapes if needed

### Task 3 - Filter Expired Temporal Memories At Retrieval Time

Recommended behavior:

- expired temporal memories are ignored during retrieval
- they are not hard-deleted immediately
- later cleanup or archival can be a separate concern

Why:

- time-sensitive mood or schedule details should not keep surfacing forever
- hard deletion is risky and makes debugging harder


### Task 4 - Extend Extraction Guidance

Current prompt framing is good, but can be improved.

Recommended additions:

1. importance should use a "would a real friend remember this in two weeks" framing
2. temporal flag should distinguish stable facts from time-sensitive facts
3. inside-joke framing should explicitly call out funny recurring moments


If you add new fields to `memory_updates.episodic`, remember:

- update `responseSchema` in `src/app/api/chat/route.ts`
- update `storeMemories()` input mapping


### Task 5 - Compact Relationship Board Rendering

Current relationship board is verbose.

You do not need a DB migration for this.

You can change prompt rendering only.

Example direction:

```text
kael:warm playful aff65 trust55 banter70 protect50
```

Keep it readable. Do not compress it so much that the model loses meaning.


### Task 6 - Optional: Backfill Embeddings On Upgrade

This is optional inside this phase.

Important repo-specific note:

There is already a Dodo webhook in `src/app/api/webhook/dodo-payments/route.ts`.

That means embedding backfill can be triggered from the existing billing path instead of introducing a second billing trigger immediately.

Possible implementation options:

1. queue backfill from the current webhook path
2. call a background task or edge function
3. defer backfill and rely on natural regeneration later

The simplest acceptable version is:

- when a user upgrades, schedule or trigger backfill for memories with `embedding IS NULL`


## Cautions

### Caution 1 - Do Not Trust The Model To Delete Data

The model can help label temporal memories, but it should not be the sole authority for destructive deletion.

Archive or ignore at retrieval time first.


### Caution 2 - Update Types Everywhere

If `memories` gains new columns, update:

- migration
- generated types
- any stored-memory TS type
- any code path that inserts or reads memory rows

### Caution 3 - Free Tier Cost Controls Must Stay Intact

The repo deliberately skips embeddings for free tier memory storage.

Do not accidentally reintroduce embedding generation for free users.


### Caution 4 - Relationship State Is Prompt Data, Not New Schema

Compact relationship rendering should be a prompt-side change only unless there is a very strong reason to change how it is stored.

## Suggested Implementation Order

1. Add temporal columns and types.
2. Filter expired temporal memories at retrieval time.
3. Add category priority or improved scoring.
4. Update prompt extraction framing.
5. Compact relationship-board rendering.
6. Optionally add upgrade-triggered embedding backfill.

## Acceptance Criteria

This phase is done when:

1. Temporal memories can be represented safely.
2. Expired temporal memories stop surfacing in retrieval.
3. Retrieval still uses a composite score.
4. Category priority is reflected in ranking.
5. Relationship board uses a more compact prompt representation.

## Test Plan

Minimum:

```bash
pnpm lint
```

Recommended:

1. Add pure tests around memory scoring helpers if they are extracted.
2. Manually seed a few memories:
   - stable identity fact
   - fresh mood fact
   - expired plan
   - inside joke
3. Verify retrieval behaves correctly.

## Suggested Commits

1. `memory: add temporal support and retrieval filtering`
2. `memory: refine scoring with category priority`
3. `chat: improve memory extraction framing and relationship board`
4. `billing: backfill memory embeddings on upgrade`

## Nice To Have, Not Required

- Add a lightweight cleanup job later that archives old expired temporal memories rather than leaving them forever.
