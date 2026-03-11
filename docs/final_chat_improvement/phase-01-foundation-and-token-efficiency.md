# Phase 01 - Foundation and Token Efficiency

## Goal

Reduce prompt waste and improve maintainability without changing the product surface area.

This phase should make the current chat system cheaper and cleaner while preserving behavior.


## Why This Phase Comes First

This repo still builds one large prompt inside `src/app/api/chat/route.ts`. Before adding more character depth, memory rules, or background features, reduce the dead weight in the current prompt and history format.

This is the safest phase to ship first because it mostly changes prompt assembly, not product architecture.

## Current Repo State

Read these files first:

- `src/app/api/chat/route.ts`
- `src/hooks/use-chat-api.ts`
- `tests/api-contract.spec.ts`
- `tests/chat-flow.spec.ts`

Important current facts:

1. Active squad filtering is already done. Do not spend time on that.
2. History sent to the LLM is still JSON built from `historyForLLM`.
3. Memory retrieval is already tier-gated by `getMemoryInPromptLimit`.
4. Free tier can save memories but does not retrieve them into prompt context.
5. The route already tracks `llmPromptChars`, so you already have a metric hook for prompt size.

## Scope

This phase should include:

1. Compact conversation history formatting
2. Skip useless memory snapshot rendering for free tier
3. Compress the most verbose core-rule text
4. Keep behavior compatible with current response schema and reply threading

This phase should not include:

- typing fingerprints
- depth lines
- prompt builder extraction
- onboarding changes
- DB migrations
- WYWA

## Files Most Likely To Change

- `src/app/api/chat/route.ts`
- optionally a new helper file such as `src/lib/ai/history-format.ts`
- optionally `tests/api-contract.spec.ts`
- optionally a new Playwright spec for prompt-format helpers

## Required Work

### Task 1 - Replace JSON History With a Compact Text Format

Current behavior:

- `historyForLLM` is built in `src/app/api/chat/route.ts`
- it is stringified with repeated field names
- `target_message_id` is frequently null, but still serialized

Recommended format:

```text
[msg-1] user: hey
[msg-2] kael: yooo
[msg-3] rico reacted: 😂 |>msg-1
```


Rules for the formatter:

1. Preserve message IDs.
2. Preserve speaker.
3. Preserve whether the event is a message or reaction.
4. Preserve reply target only when present.
5. Normalize line breaks inside content so one chat row always becomes one history line.
6. Escape or normalize any delimiter characters you introduce.

Recommended implementation details:

- Keep the formatter as a dedicated function instead of inline string concatenation.
- Normalize `\r\n` and `\n` inside content to spaces or escaped tokens.
- Do not use raw `|` as the only delimiter unless you escape it first.
- Keep the format explanation inside the system prompt very short and precise.


Suggested prompt preamble:

```text
RECENT CONVERSATION FORMAT:
[id] speaker: content
[id] speaker reacted: emoji |>reply_to_id
```

### Task 2 - Skip Memory Snapshot for Free Tier

Current behavior:

- retrieval is skipped when `memoryInPromptLimit === 0`
- but the memory snapshot block is still assembled with profile, relationships, and summary skeleton text

Change:

- if `memoryInPromptLimit === 0`, do not build or inject the memory snapshot block at all
- paid tiers should still behave exactly as they do today

Important:

- do not confuse "memory retrieval disabled for prompt" with "memory storage disabled"
- free tier still stores memories


### Task 3 - Compress Core Rules Without Removing The Important Parts

Current behavior:

- rule text is verbose
- language examples use more prompt space than needed

Keep these concepts:

1. sparse `target_message_id` usage
2. reaction realism
3. status whitelist
4. high silent-turn re-engagement
5. grounded references only
6. early rapport
7. direct-question recall
8. natural memory callbacks

Safe reductions:

- reduce language examples to one BAD/GOOD pair
- shorten repeated explanation text
- keep the substance, remove repetition

Do not remove:

- direct-question behavior
- grounding rule
- memory-driven behavior rule


## Cautions

### Caution 1 - Reply Threading Must Keep Working

The model needs valid IDs in history so it can emit `target_message_id` on the rare turns where replies matter.

If IDs are dropped or become ambiguous, the UI's reply threading degrades immediately.


### Caution 2 - History Persistence Is Split Across Two Paths

The LLM prompt only sees the client payload, but persisted history comes from two places:

- user rows from `src/app/api/chat/route.ts`
- rendered AI rows from `src/app/api/chat/rendered/route.ts`

Do not assume there is only one chat-history writer when designing future history-related work.


### Caution 3 - Mock AI Does Not Exercise Prompt Quality

The existing `x-mock-ai` flow proves schema shape, not real LLM behavior.

That means:

- contract tests are useful
- they do not validate whether the new history format is easy for the model to understand

If possible, do at least one manual real-model smoke test before closing the phase.


### Caution 4 - Keep The `promptChars` Metric

Do not remove or break the current `llmPromptChars` accounting in the route. It is useful for verifying the result of this phase.


## Suggested Implementation Order

1. Extract a small history formatter function.
2. Update the LLM conversation payload to use it.
3. Update the system prompt preamble to explain the new format.
4. Skip memory snapshot creation when `memoryInPromptLimit === 0`.
5. Compress core rules.
6. Run lint and contract tests.
7. Do one manual real-model smoke test if environment allows.

## Acceptance Criteria

This phase is done when:

1. History sent to the LLM is no longer JSON.
2. Message IDs are still preserved.
3. Free-tier prompt no longer includes an empty memory snapshot skeleton.
4. Prompt size is lower in the route metric.
5. Reply threading still works.
6. Existing contract tests still pass.

## Test Plan

Minimum:

```bash
pnpm lint
pnpm exec playwright test tests/api-contract.spec.ts
```


Recommended additional manual checks:

1. Send a short normal message and inspect output shape.
2. Send a reaction-heavy conversation and make sure formatting stays readable.
3. Send a conversation with a reply target and verify the model can still emit a valid `target_message_id`.
4. Check a free-tier account and confirm no memory snapshot is injected.

## Suggested Commits

1. `chat: compact llm history format`
2. `chat: skip free tier memory snapshot block`
3. `chat: compress core prompt rules`

## Nice To Have, Not Required

- Put the history formatter in a pure helper file so later snapshot tests can import it.
- Add a small Playwright test that exercises the formatter output for message, reaction, and reply rows.
