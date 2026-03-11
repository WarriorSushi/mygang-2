# Phase 06 - While You Were Away Background Chat

## Goal

Generate believable away-chat content when the user is inactive, without corrupting the normal live-chat context.

This is the highest-risk product phase in the plan because it touches:

- background execution
- database writes
- chat history loading
- request payload shape
- LLM prompt semantics
- user trust


## Read These Files First

- `src/app/api/chat/route.ts`
- `src/app/api/chat/rendered/route.ts`
- `src/hooks/use-chat-api.ts`
- `src/hooks/use-chat-history.ts`
- `src/app/auth/actions.ts`
- `src/app/api/webhook/dodo-payments/route.ts`
- `src/lib/database.types.ts`
- `public/manifest.json`

## Current Repo State

Important facts:

1. There is no `vercel.json`.
2. There is no `supabase/functions` directory.
3. Chat history currently has no `source` column.
4. `getChatHistoryPage()` currently reads all `chat_history` rows for the user with no source filtering.
5. The client sends recent local messages to `/api/chat`; message rows currently do not include a per-message source field.
6. There is already client-side idle autonomous behavior, but it only runs while the tab is open.

## Recommendation

Do not implement WYWA until Phases 01-03 are finished.

Once you do implement it, treat it as a separate subsystem with explicit message-source tracking.


## Scope

This phase should include:

1. message source support
2. background generation infrastructure
3. a stripped-down WYWA prompt
4. chat-history write path for WYWA rows
5. UI handling for WYWA rows
6. context filtering so synthetic rows do not poison the normal LLM window

This phase should not include:

- full push infrastructure
- full PWA conversion
- weekly recap or email campaigns

Recommended rollout:

- start as a tightly gated pilot
- strongly consider paid-only at first
- add hard per-run caps
- add hard per-user cooldowns
- only widen rollout after cost and confusion metrics are acceptable

## Required Schema Changes

### Required Change 1 - Add `source` To `chat_history`

Recommended migration:

```sql
ALTER TABLE public.chat_history
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'chat';

ALTER TABLE public.chat_history
  ADD CONSTRAINT chat_history_source_check
  CHECK (source IN ('chat', 'wywa', 'system'));

CREATE INDEX IF NOT EXISTS chat_history_user_source_created_idx
  ON public.chat_history (user_id, source, created_at DESC);
```


### Strongly Recommended Change 2 - Track Last WYWA Generation

Without this, a cron job can keep generating repeated away-chat rows for the same inactive user.

Recommended migration:

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_wywa_generated_at TIMESTAMPTZ DEFAULT NULL;
```

This is not strictly mandatory, but it is highly recommended for idempotency and cost control.

## Architecture Recommendation

Recommended stack:

1. Supabase Edge Function for background generation
2. `pg_cron` or equivalent scheduler
3. direct DB writes with service-role access

Why this is better than relying on current client behavior:

- it works when the app is closed
- it is easier to batch inactive-user selection
- it keeps background generation off the client

## Files Most Likely To Change

- new migration(s)
- `src/lib/database.types.ts`
- `src/app/auth/actions.ts`
- `src/hooks/use-chat-history.ts`
- `src/stores/chat-store.ts`
- `src/hooks/use-chat-api.ts`
- `src/app/api/chat/route.ts`
- new `supabase/functions/wywa-generator/`

## Required Work

### Task 1 - Add Message Source End-To-End

This is the critical step many implementations miss.

You cannot safely add WYWA if the app cannot tell which messages are synthetic.

That means updating:

- DB schema
- database types
- history loader
- Zustand message type if needed
- client payload shape if source should travel back to `/api/chat`
- chat route filtering

Recommended direction:

1. extend stored/history message shape with `source`
2. make `getChatHistoryPage()` return it
3. make `useChatHistory()` preserve it
4. decide whether the client should send it back in request messages

### Task 2 - Filter WYWA Rows Out Of Normal LLM Context By Default

This is non-negotiable.

If WYWA rows flow into the normal prompt context with no distinction, the model will treat synthetic history as ordinary canonical conversation.


Recommended behavior:

- normal live-chat turns should exclude WYWA rows from `historyForLLM` by default
- if product later wants WYWA-aware responses, pass them in intentionally with a dedicated prompt block

This may require:

- message-source support in request messages
- or explicit server-side filtering against persisted history if the source is not sent from client

### Task 3 - Add A Separate WYWA Prompt

Do not call the full main chat route prompt for background chatter.

WYWA should use a cheaper, smaller prompt focused on:

- active squad
- light topics
- occasional memory callback
- short exchange length
- no memory updates
- no summary updates

This prompt should be separate from the main prompt builder.


### Task 4 - Add Background Generator Infrastructure

Recommended implementation:

1. create `supabase/functions/wywa-generator/`
2. query inactive users using `profiles.last_active_at`
3. avoid users recently processed using `last_wywa_generated_at`
4. choose 2-3 squad members
5. generate 3-5 short messages
6. insert `chat_history` rows with `source = 'wywa'`
7. update `last_wywa_generated_at`


### Task 5 - Add UI Treatment For WYWA Rows

If WYWA rows show up in history, users need clarity.

Recommended options:

1. divider such as "While you were away"
2. subtle visual treatment for WYWA batches
3. do not make them look identical to a real-time turn if the product wants transparency

### Task 6 - Prevent Memory Pollution

WYWA content should not create user memories.

Safe rules:

- no `memory_updates`
- no `session_summary_update`
- do not let synthetic rows cause user-profile extraction


## Cautions

### Caution 1 - History Loading Currently Pulls Everything

`getChatHistoryPage()` in `src/app/auth/actions.ts` currently selects every row for the user.

If you add WYWA rows with no loader changes, they will start appearing everywhere immediately.

### Caution 2 - Message Reconciliation May Collapse Duplicates

`use-chat-history.ts` has duplicate-collapsing logic.

If you add `source` to messages but ignore it in message signatures, WYWA rows could be merged incorrectly with normal rows.

Review:

- `messageSignature`
- `messageStrictSignature`
- duplicate-collapse logic


### Caution 3 - There Are Two Chat-History Writers Today

Do not forget:

- main chat route writes user rows
- rendered route writes displayed AI rows

WYWA will likely be a third writer unless you route it through one of those systems.

### Caution 4 - Cost And Volume Add Up Fast

Even cheap generations become expensive if:

- you run too often
- you process every inactive user every time
- you write too many rows per batch

Use:

- inactivity threshold
- generation cooldown
- short outputs
- paid-only or tightly gated rollout at first
- hard per-run caps on processed users
- hard per-user cooldowns between WYWA batches


## Suggested Implementation Order

1. Add `source` and `last_wywa_generated_at` schema.
2. Thread `source` through types and history loading.
3. Update duplicate-collapse logic if source needs to be part of signatures.
4. Add source-aware filtering for normal live-chat prompt history.
5. Build the background function and prompt.
6. Insert WYWA rows and mark source.
7. Add UI divider or labeling.

## Acceptance Criteria

This phase is done when:

1. WYWA rows are source-tagged.
2. WYWA generation can run in the background without an open tab.
3. WYWA rows do not automatically pollute the normal LLM context.
4. UI can distinguish WYWA content.
5. WYWA turns do not create user memories or summaries.

## Test Plan

Minimum:

```bash
pnpm lint
```

Recommended:

1. manually insert sample `source='wywa'` rows and verify history/UI behavior
2. verify normal chat request payload excludes or handles WYWA rows correctly
3. run at least one end-to-end manual test for an inactive user returning to chat

## Suggested Commits

1. `chat-history: add source support for wywa`
2. `chat: filter synthetic history from live llm context`
3. `wywa: add background generator and prompt`
4. `chat-ui: label while-you-were-away messages`

## Nice To Have, Not Required

- add per-user topic cooldowns so WYWA does not repeat the same debate too often.
