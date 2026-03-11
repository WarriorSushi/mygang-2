# Improving Chat — Implementation Plan

> Date: 2026-03-11
> Branch: `feat/chat-improvements`
> Based on: MASTER-PLAN-v4-FINAL.md + proposed_system_plan_v4.md
> Reviewed by: 4 specialist codebase analysis agents (backend, data, frontend, infra)

---

## Executive Summary

The Master Plan v4 is **solid and well-thought-out**, but our codebase review found several wrong assumptions, already-implemented items, and missing infrastructure that need to be corrected before implementation. This plan adjusts the approach based on what the code actually does today.

### Key Findings

1. **Plan 1A (send only active squad) is already implemented** — the code already filters to active squad at `route.ts:660`. No work needed.
2. **Plan 1D (conditional memory rules) is already partially implemented** — extraction rules are already gated by `allowMemoryUpdates`.
3. **Plan 4E (memory conflict resolution) is partially implemented** — word-overlap archival already exists in `memory.ts:179-217`.
4. **Plan 4I (inside joke detection) is already wired up** — the `inside_joke` category exists in DB and TypeScript types.
5. **The `theme` column already exists** — the plan's ALTER TABLE for theme would fail or no-op.
6. **WYWA needs serious infrastructure** — zero cron, zero background jobs, zero push notifications exist today.
7. **PWA is barely started** — manifest exists but no service worker, no push, no offline capability.
8. **The onboarding quiz is a much bigger lift than estimated** — 5-7 days, not 2-3.

---

## Phase 1: Token Efficiency

### 1A. Send Only Active Squad Members — ALREADY DONE ✅

**What the plan says:** Filter to active squad (4-6 characters), save ~500-700 tokens.
**What the code does:** `route.ts:660` already builds `activeGangSafe` from `CHARACTERS.filter((c) => filteredIds.includes(c.id))`. Only active squad definitions are sent.

**No work needed.** Do not re-implement or add a second filter layer.

---

### 1C. Compact Conversation History — DO THIS

**Current state:** `route.ts:1115-1130` formats history as `JSON.stringify(historyForLLM)` with repeated field names (`id`, `speaker`, `content`, `type`, `target_message_id`) for every message. The `target_message_id` field is `null` on 85%+ of messages but still serialized.

**Proposed format:**
```
[id] speaker: content
[id] speaker: content |>target_id
[id] speaker: reaction:👍 |>target_id
```

**Why NOT pure pipe-delimited:** The `|` character can appear inside message content (users type it). Use the bracket+colon format above which is unambiguous.

**Critical requirement:** The `id` field MUST be preserved — the LLM uses these IDs to set `target_message_id` in its response for reply threading. Dropping IDs breaks threading entirely.

**Files to change:**
- `src/app/api/chat/route.ts:1115-1130` — format history
- `src/app/api/chat/route.ts:1037` — update the "RECENT CONVERSATION" preamble to explain the new format to the LLM

**Token savings:** ~200-500 tokens per request depending on history length (30-40% reduction on history block).

**Risk:** Medium. The LLM must understand the new format to correctly parse speaker identity and message threading. Add a one-line format explanation: `HISTORY FORMAT: [id] speaker: content [|>reply_to_id]`

**Test plan:** Send 10 test conversations in both formats, verify the LLM's `target_message_id` output still references valid IDs.

**Effort:** 2-3 hours

---

### 1D. Conditional Memory Extraction Rules — PARTIALLY DONE ✅

**What's already done:** The ~900-char extraction rules block (`route.ts:1075-1093`) is already gated by `allowMemoryUpdates`. When false, it's replaced by a one-liner.

**What's NOT done (real opportunity):** The memory snapshot skeleton (RELATIONSHIP BOARD, SESSION SUMMARY, USER PROFILE) is still injected for **free tier users** even though `memoryInPromptLimit === 0` and no memories are ever shown. This wastes ~200-400 tokens per free-tier request.

**Fix:** Add a tier guard at `route.ts:931-944` — skip RELATIONSHIP BOARD and SESSION SUMMARY injection for free tier (they get no memory context anyway).

**Effort:** 30 minutes

---

### 1E. Compress Core Rules — DO THIS

**Current state:** CORE RULES section (`route.ts:1037-1093`) is ~2,400 characters (~600 tokens). Rule 7 (LANGUAGE) alone is ~700 chars with 4 example pairs. Rules 10-11 (MEMORY-DRIVEN BEHAVIOR) add ~500 chars.

**What to do:**
- Rule 7: Keep 1 BAD/GOOD example pair, drop the other. Save ~200 chars.
- Rules 8-11: Compress verbose instructions into tighter directives. Save ~200-300 chars.
- Add new Rule 12 (DIRECT QUESTIONS) and Rule 13 (VIBE CHECK) from the plan — they're good additions.

**Don't do:** Don't remove examples entirely from Rule 7 — the model needs at least one to calibrate.

**Token savings:** ~150-250 tokens

**Effort:** 2-3 hours

---

### NEW: 1F. Skip Memory Snapshot for Free Tier

**Current state:** Free users get `memoryInPromptLimit === 0` but the snapshot skeleton (PROFILE, RELATIONSHIP BOARD, SESSION SUMMARY) is still rendered and injected.

**Fix:** If `memoryInPromptLimit === 0`, skip the entire memory snapshot block. Free users get zero memory context anyway — no point wasting tokens on the skeleton.

**Savings:** ~200-400 tokens per free-tier request

**Effort:** 30 minutes

---

## Phase 2: Character Depth

### 2A. Depth Layers — DO THIS

**Current state:** Character extended voices have surface personality only. No hidden motivations, no vulnerability triggers, no emotional depth.

**What to do:** Append ONE `DEPTH:` line to each character's `CHARACTER_EXTENDED_VOICES` entry in `route.ts:47-62`. Keep the existing prose voice intact.

**Example for Kael:**
```
"Hypes everything up. Uses 'we' a lot... DEPTH: Secretly afraid of being forgotten. When outshined, hypes harder. Occasionally says something real — then covers with a flex."
```

**Token cost:** ~100-210 tokens total for 4-6 active characters (acceptable — funded by Phase 1 savings).

**Files to change:**
- `src/app/api/chat/route.ts:47-62` — the `CHARACTER_EXTENDED_VOICES` object

**Risk:** Low. This is additive — existing voice stays, depth adds nuance.

**Effort:** 2-3 hours (writing good depth lines is the work, not the code)

---

### 2B. Typing Fingerprints — DO THIS (HIGH PRIORITY)

**Current state:** No typing style enforcement exists. Characters all type similarly despite different voice descriptions. This is the single biggest immersion gap.

**What to do:** Add a `TYPING STYLE IS NON-NEGOTIABLE:` block to the system prompt. Only include styles for active squad members. Hard constraint — violations break immersion.

**Implementation:** Build a `TYPING_STYLES` map (character_id → style string) and a `buildTypingFingerprints(squadIds)` function that filters to active squad.

**Where to add in prompt:** After the SQUAD block, before SQUAD DYNAMICS. This placement lets the LLM read the character voice, then immediately see the typing constraint.

**Files to change:**
- `src/app/api/chat/route.ts` — add TYPING_STYLES constant + builder function + inject into system prompt

**Token cost:** ~60-120 tokens (4-6 active characters)

**Risk:** Low. This only constrains formatting, not content.

**Effort:** 2-3 hours

---

### 2C. Filtered Squad Dynamics — DO THIS

**Current state:** Squad dynamics block is hardcoded with all possible character relationships. Includes clashes/alliances for characters not in the user's squad — wasted tokens.

**What to do:** Build CLASHES and ALLIANCES arrays with character pair arrays, filter to only include entries where BOTH characters are in the active squad.

**Files to change:**
- `src/app/api/chat/route.ts` — replace hardcoded dynamics text with `buildFilteredDynamics(squadIds)` function

**Token savings:** ~50-100 tokens (removes irrelevant dynamics)

**Effort:** 1-2 hours

---

### 2E. Depth Moments — DO THIS

**Current state:** No explicit instruction for characters to drop persona during vulnerable moments.

**What to do:** Add as a new core rule (Rule 11 replacement):
```
DEPTH MOMENTS: When user shares something genuinely vulnerable or emotional, ONE character briefly drops persona. 1-2 messages max, then revert. Don't announce it.
```

**This already exists as Rule 11 in the plan's proposed CORE_RULES. Just include it.**

**Token cost:** ~45 tokens

**Effort:** 30 minutes

---

## Phase 2.5: While-You-Were-Away (WYWA)

### Infrastructure Reality Check

**Current state:** ZERO background infrastructure exists.
- No `vercel.json` (no cron routes)
- No Supabase Edge Functions (directory doesn't exist)
- No service worker, no push notifications
- No email service
- The only "autonomous" behavior is a client-side `setTimeout` in `useAutonomousFlow` hook — fires only while the tab is open

**Vercel Cron Limits:**
- Hobby plan: 2 cron jobs, daily minimum frequency
- Pro plan: 40 cron jobs, hourly minimum frequency
- Max function duration: 60s (Pro) or 300s with `maxDuration`

**The core problem:** Processing 1000+ users in a single cron invocation is impossible within Vercel's 60-300s function timeout. You need fan-out architecture.

### Recommended Approach: Supabase Edge Functions + pg_cron

**Option B from the infra analysis — best fit for our stack:**

1. Create a `supabase/functions/wywa-generator/` Edge Function
2. Schedule it with `pg_cron` (Supabase paid plan feature) every 6 hours
3. The Edge Function queries users inactive 4+ hours, fans out per-user
4. Uses a stripped-down prompt (NOT the full chat route prompt) for cheap generation
5. Writes directly to `chat_history` via service role

**DB changes needed:**
```sql
-- Add source column to distinguish WYWA messages from real ones
ALTER TABLE public.chat_history
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'chat'
  CHECK (source IN ('chat', 'wywa', 'system'));

-- Track user last activity for WYWA eligibility
-- (last_active_at might already exist — verify)
```

**Cost estimate:** The plan's $0.0001-0.0003/generation is realistic for Gemini Flash Lite. At 1000 users × 4 runs/day = ~$1.08/day = ~$32/month. Manageable at small scale.

**Critical risks:**
1. **DB bloat:** 48 synthetic rows per user per day = 48,000 rows/day for 1000 users = 1.44M/month. Need TTL cleanup.
2. **WYWA messages polluting LLM context:** If WYWA messages enter the history window sent to the LLM, the model treats synthetic history as ground truth. Filter them out of the `historyForLLM` using the `source` column.
3. **User confusion:** Users may believe characters responded to something they said. Must visually differentiate WYWA messages OR add a "while you were away" divider in the chat UI.
4. **Memory writes from WYWA context:** Ensure `allowMemoryUpdates = false` for any LLM call that has WYWA messages in context.

**Effort:** 5-7 days (not 2-3 as the plan estimates). Includes: Edge Function setup, pg_cron scheduling, topic pool, WYWA prompt design, chat_history schema change, client-side handling, testing.

**Recommendation:** Defer to Week 4-5. Get token efficiency + character depth + modular prompt done first. WYWA is the biggest lift and depends on stable prompt architecture.

---

## Phase 3: Redesigned Onboarding Quiz

### Current Onboarding (4 steps)

1. **WELCOME** — static splash, "Assemble the Gang" button
2. **IDENTITY** — nickname input (only personality data collected)
3. **SELECTION** — grid of all 14 characters, pick 2-4, no recommendation logic
4. **INTRO** — selected character details + optional custom names
5. **LOADING** — spinner → redirect to `/chat`

**Key files:**
- `src/app/onboarding/page.tsx` — step state machine
- `src/components/onboarding/*.tsx` — 5 step components

### What Needs Building

| Feature | Status | Work Required |
|---------|--------|---------------|
| Screen 1: Display name + theme toggle | Exists (IdentityStep) | Modify — add theme toggle |
| Screen 2: Intent (why are you here?) | New | New component `IntentStep` |
| Screen 3: Warmth preference | New | New component `WarmthStep` |
| Screen 4: Chaos preference | New | New component `ChaosStep` |
| Screen 5: Squad selection with recommendations | Exists (SelectionStep) | Major modify — add recommendation engine |
| 3 optional deep screens | New | 3 new components |
| Character affinity scoring | New | Pure function module |
| Auto-wallpaper suggestion | New | Small mapping function |
| Retake button in settings | New | Settings panel addition |
| `vibe_profile` DB column | New | Migration needed |
| Step state machine rewrite | — | Required — grows from 5→10+ states |

### DB Changes

```sql
-- vibe_profile does NOT exist yet
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vibe_profile JSONB DEFAULT NULL;

-- theme ALREADY EXISTS as TEXT — do NOT add again
-- The plan's ALTER TABLE for theme would fail
-- Leave as-is unless you want to add a VARCHAR constraint
```

### Critical Gotcha: Existing User Bypass

The onboarding page has a guard at line 71-75:
```typescript
if (isHydrated && activeGang.length >= 2) router.replace('/chat')
```

Any existing user visiting `/onboarding` gets immediately forwarded to chat. The retake flow must either:
- Use a query param (`?retake=true`) that disables the bypass
- Or use a separate `/onboarding/retake` route

**Effort:** 5-7 days (plan estimates 2-3 — unrealistic for 8 screens + recommendation engine + migration + retake flow)

---

## Phase 4: Memory Intelligence

### Already Implemented ✅

| Item | Status | Notes |
|------|--------|-------|
| 4I. Inside Joke Detection | ✅ Category exists | `inside_joke` category in DB + TypeScript types. Just enhance the prompt wording. |
| 4E. Conflict Resolution (basic) | ✅ Partial | Word-overlap archival exists in `memory.ts:179-217` for importance≥2 memories |
| 4F. Recency Decay (basic) | ✅ Partial | Current composite score has linear 7-day recency component |

### Needs Work

| Item | What To Do | Effort |
|------|-----------|--------|
| 4B. Compact Relationship State | Change prompt rendering format only. `kael:warm+playful(aff7,trust6)` instead of verbose. No DB change. | 1 hour |
| 4C. Embedding Backfill on Upgrade | New Edge Function triggered by Dodo webhook. Batch-generate embeddings for `embedding IS NULL` rows. Rate-limit to avoid hitting Gemini API limits. | 3-4 hours |
| 4G. Temporal Memory Flag | **New DB columns needed:** `is_temporal BOOLEAN DEFAULT FALSE` + `expires_at TIMESTAMPTZ`. Update extraction prompt to tag temporal memories. Filter at retrieval time. **CRITICAL:** Expiry should ARCHIVE (not delete) — the LLM is unreliable at distinguishing temporal vs stable (e.g., "user is stressed" could go either way). Use 7-day window minimum, not 48-72h. | 3-4 hours |
| 4H. Category Priority | 5-line sort comparator addition in `retrieveMemoriesHybrid()`. Zero DB change. | 30 minutes |
| 4J. Friend Test Importance | Prompt-only change. Replace `1=casual, 2=stated, 3=corrected` with "Would a friend remember this in 2 weeks?" | 15 minutes |

### Important: `match_memories` SQL Function Gap

The current `match_memories` function only returns `id`, `content`, and `similarity`. It does NOT return `category`, `importance`, or `created_at`. The hybrid retrieval works around this by doing a second query for recency data.

Any scoring changes (4F, 4H) must either:
1. **Update the SQL function** to `RETURNS TABLE (id UUID, content TEXT, similarity FLOAT, category TEXT, importance INT, created_at TIMESTAMPTZ)` — cleaner, one query
2. **Keep the two-query architecture** and do scoring in TypeScript — current approach, more network calls

**Recommendation:** Update `match_memories` to return the extra fields. It's a simple migration and eliminates the second query.

### Important: Don't Replace the Composite Score

The plan's `similarity × e^(-0.03 × days_old)` formula **drops** importance and usage frequency signals that the current composite score includes. This is a regression.

**Better approach:** Keep the existing composite score structure, add exponential decay as a modifier:
```javascript
const recencyDecay = Math.exp(-0.03 * daysOld);
const compositeScore = (0.45 * similarity * recencyDecay) + (0.2 * recency) + (0.15 * (importance/3)) + (0.15 * usageFrequency) + (0.05 * categoryPriority);
```

### DB Migration for Phase 4

```sql
-- Temporal memory support
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS is_temporal BOOLEAN DEFAULT FALSE;

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS memories_expires_at_idx
  ON public.memories (user_id, expires_at)
  WHERE expires_at IS NOT NULL;
```

---

## Phase 5: LLM-as-Decision-Maker (Free — Prompt Only)

All prompt-level changes, zero extra API calls. Low risk, do alongside Phase 2.

| Item | What To Do | Effort |
|------|-----------|--------|
| 5A. Vibe Detection | Add `"vibe"` to output schema. Forces LLM to calibrate tone. | 30 min |
| 5B. Silence as Valid Response | Add rule: "Sometimes 1 character + silence is right. 'goodnight' gets one reply." | 15 min |
| 5C. Ecosystem Topic Branching | Add rule: "Characters can react, start side convos, or bring up random in-character topics." | 15 min |
| 5D. Relationship Delta Reasoning | Add rule: "Reason why before changing scores. Only adjust for meaningful moments." | 15 min |

---

## Phase 6: Modular System Prompt Architecture

### Current State

The entire system prompt is ONE template literal at `route.ts:992-1108`. No builder functions, no separate file, no modularity. All conditional logic is interleaved with string construction.

### Refactoring Approach

Extract the monolithic string into a `src/lib/ai/system-prompt.ts` file with builder functions:

```typescript
// src/lib/ai/system-prompt.ts
export function buildSystemPrompt(user, session, context): string {
  const blocks: string[] = [];

  blocks.push(DIRECTOR_IDENTITY);
  blocks.push(buildUserBlock(user));
  blocks.push(buildSquadBlock(user.squad, CHARACTER_VOICES));
  blocks.push(buildTypingFingerprints(user.squad));
  blocks.push(SQUAD_DYNAMICS_BASE);
  blocks.push(buildFilteredDynamics(user.squad));
  blocks.push(buildSafetyBlock(context.safetyDirective));
  blocks.push(buildModeBlock(context.chatMode, context.lowCost));
  blocks.push(buildCoreRules(context));
  blocks.push(buildPlanningBlock(context));
  blocks.push(buildFlowFlags(context));

  // Conditional blocks (0 tokens when not triggered)
  if (user.vibe_profile) {
    blocks.push(buildVibeDirective(user.vibe_profile));
    blocks.push(buildIntentDirective(user.vibe_profile));
    blocks.push(buildUserStyleDirective(user.vibe_profile));
  }
  if (context.hasAwayMessages) blocks.push(WYWA_CONTEXT);
  if (context.purchaseCelebration) blocks.push(buildCelebration(context.plan));
  if (context.memorySnapshot) blocks.push(context.memorySnapshot);
  blocks.push(buildMemoryRules(context.allowMemoryUpdates, context.allowSummaryUpdates));

  return blocks.filter(Boolean).join("\n\n");
}
```

### Risk: Silent Behavioral Regressions

The current prompt has 8+ conditional branches. If any is wired incorrectly in the new builder, the model silently gets different context. This causes behavioral degradation (worse character responses, wrong mode) rather than crashes — hard to catch.

**Mitigation:**
1. Write a test that snapshots the current monolithic prompt output for 5 known scenarios (greeting, free user, pro user, ecosystem mode, purchase celebration)
2. Refactor to builders
3. Assert the builder output matches the snapshots character-for-character
4. Only then start making improvements

**Effort:** 3-4 hours for refactor + 1-2 hours for snapshot tests

---

## Phase 7: Retention System

### 7A. PWA Conversion

**Current state:** `manifest.json` exists with correct structure. NO service worker, NO `next-pwa` package, NO push infrastructure.

**What's needed:**
- Install `@ducanh2912/next-pwa` or similar
- Create service worker with offline fallback
- Push subscription API endpoints (CRUD)
- VAPID key generation + storage in env
- `push_subscriptions` table in Supabase
- CSP update to allow push service domains
- Browser permission flow UI (ask after 3-4 chats, not immediately)

**Effort:** 3-5 days (plan says 1 day — very optimistic)

### 7B. Tab Presence Signals

**What to do:**
- Page title update (`"MyGang (3 new)"`) — easy, 30 minutes
- Favicon badge — janky cross-browser, doesn't work on iOS Safari at all. Consider skipping for mobile-first audience.

**Effort:** 2-3 hours for title, 4-6 hours for proper favicon badge

### 7C-7H: Other Retention Features

All require either WYWA infrastructure (7C email, 7E QotD) or UI additions (7F recap, 7G milestones, 7H memory vault). Defer until WYWA infrastructure is built.

---

## Things the Plan Gets Wrong

1. **1A is already done** — no token savings to claim here
2. **Theme column already exists** — migration would fail
3. **4E conflict resolution already partially exists** — not starting from zero
4. **4F recency decay formula drops importance/usage signals** — would be a regression
5. **Onboarding is 5-7 days, not 2-3** — 8 screens + recommendation engine + migration + retake flow
6. **WYWA is 5-7 days, not 2-3** — requires greenfield infrastructure (Edge Functions, cron, schema changes)
7. **PWA is 3-5 days, not 1 day** — service worker from zero in Next.js App Router is non-trivial
8. **Favicon badges don't work on iOS Safari** — limited reach for mobile audience
9. **The pipe-delimited format `msg-1|user|message|content` is ambiguous** — `|` appears in message content. Use bracket format instead.

---

## Revised Implementation Order

```
WEEK 1: Token Efficiency + Character Depth (Foundation)
  ┣━ 1C. Compact history format                      — 2-3 hours
  ┣━ 1E. Compress core rules                         — 2-3 hours
  ┣━ 1F. Skip memory snapshot for free tier           — 30 min
  ┣━ 2B. Typing fingerprints (DO FIRST)              — 2-3 hours
  ┣━ 2A. Depth layers                                — 2-3 hours
  ┣━ 2C. Filtered squad dynamics                     — 1-2 hours
  ┣━ 2E. Depth moments rule                          — 30 min
  ┗━ 5A-5D. Prompt improvements (vibe, silence, etc) — 1-2 hours

WEEK 2: Modular Prompt Architecture (Structural)
  ┣━ 6. Snapshot tests for current prompt             — 1-2 hours
  ┣━ 6. Extract builders to system-prompt.ts          — 3-4 hours
  ┣━ 6. Wire vibe quiz builder functions              — 2-3 hours
  ┣━ 4B. Compact relationship state format            — 1 hour
  ┣━ 4H. Category priority tiebreaker                — 30 min
  ┣━ 4I. Inside joke prompt enhancement              — 15 min
  ┗━ 4J. Friend test importance framing              — 15 min

WEEK 3: Memory Intelligence + DB
  ┣━ 4G. Temporal memory flag (migration + code)     — 3-4 hours
  ┣━ 4F. Enhanced recency decay (keep composite)      — 1-2 hours
  ┣━ 4C. Embedding backfill Edge Function             — 3-4 hours
  ┗━ DB migration: vibe_profile column                — 30 min

WEEK 4-5: Redesigned Onboarding Quiz (Big Lift)
  ┣━ Quiz UI (5 mandatory + 3 optional screens)       — 2-3 days
  ┣━ Character recommendation engine                  — 3-4 hours
  ┣━ Auto-wallpaper suggestion                        — 1-2 hours
  ┣━ Settings retake button + routing                 — 3-4 hours
  ┗━ Integration testing                              — 1 day

WEEK 5-6: WYWA Infrastructure (Greenfield)
  ┣━ Supabase Edge Function setup                     — 1 day
  ┣━ pg_cron scheduling                               — 2-3 hours
  ┣━ WYWA prompt design + topic pool                  — 1 day
  ┣━ chat_history source column migration             — 30 min
  ┣━ Client-side WYWA handling + UI divider           — 1 day
  ┗━ Testing + rate limit safeguards                  — 1 day

WEEK 7: PWA + Retention
  ┣━ Service worker + next-pwa setup                  — 1-2 days
  ┣━ Push notification infrastructure                 — 1-2 days
  ┣━ Tab presence (page title update)                 — 2-3 hours
  ┣━ Memory vault UI                                  — 1-2 hours
  ┗━ Friendship milestones                            — 2-3 hours

WEEK 8: Retention Polish (if time)
  ┣━ Email re-engagement infrastructure               — 2-3 days
  ┣━ Question of the Day                              — 1-2 hours
  ┣━ Weekly Vibe Recap                                — 3-4 hours
  ┗━ Final testing + rollout                          — 1 day

Total: ~8 weeks (plan estimated 6-7 — add buffer)
```

---

## File Map: What Changes Where

### `src/app/api/chat/route.ts` (Main Chat Route)
- Lines 47-62: Add DEPTH lines to CHARACTER_EXTENDED_VOICES
- Lines 953-968: Add typing fingerprints block
- Lines 992-1108: Extract to modular builders → `src/lib/ai/system-prompt.ts`
- Lines 1037-1093: Compress core rules, add new rules 12-13
- Lines 1115-1130: Compact history format
- Lines 931-944: Conditional memory snapshot skip for free tier

### `src/lib/ai/system-prompt.ts` (NEW — Phase 6)
- All builder functions
- TYPING_STYLES map
- CLASHES/ALLIANCES arrays
- Vibe/intent/style directives

### `src/lib/ai/memory.ts` (Memory Intelligence)
- `retrieveMemoriesHybrid()`: Add category priority, enhanced recency decay, temporal filtering
- `storeMemories()`: Add temporal tagging support

### `src/app/onboarding/page.tsx` (Onboarding Rewrite)
- Step state machine: 5→10+ states
- Retake routing support

### `src/components/onboarding/*.tsx` (New Quiz Screens)
- `IntentStep.tsx` (new)
- `WarmthStep.tsx` (new)
- `ChaosStep.tsx` (new)
- `HonestyStep.tsx` (new, optional)
- `EnergyStep.tsx` (new, optional)
- `TextingStyleStep.tsx` (new, optional)
- `SelectionStep.tsx` (modify — add recommendation engine)
- `IdentityStep.tsx` (modify — add theme toggle)

### `src/components/settings/settings-panel.tsx`
- Add "Retake Vibe Quiz" button

### DB Migrations
1. `ALTER TABLE profiles ADD COLUMN vibe_profile JSONB DEFAULT NULL`
2. `ALTER TABLE memories ADD COLUMN is_temporal BOOLEAN DEFAULT FALSE`
3. `ALTER TABLE memories ADD COLUMN expires_at TIMESTAMPTZ DEFAULT NULL`
4. `ALTER TABLE chat_history ADD COLUMN source TEXT DEFAULT 'chat'`

### Infrastructure (WYWA — Phase 2.5)
- `supabase/functions/wywa-generator/` (new Edge Function)
- `vercel.json` or pg_cron setup for scheduling

---

## Success Criteria (How We Know It Worked)

1. ✅ Characters sound different — tell who's talking without the name (typing fingerprints)
2. ✅ Characters have surprising depth — not one-note (depth layers)
3. ✅ Characters personalize from message one — vibe quiz shapes behavior
4. ✅ Token usage is lower — despite richer features (compact history + compressed rules)
5. ✅ System prompt is modular — every block conditional, zero dead tokens
6. ✅ Memories are accurate — temporal expiry, category priority, conflict resolution
7. ✅ Group chat feels alive — WYWA messages waiting when you come back
8. ✅ Users come back — push, tab signals, milestones

---

## Things NOT To Do (From Plan + Our Additions)

1. Don't compress character voices to tags (prose gives personality)
2. Don't inject memory callbacks every API call
3. Don't make depth moments random/percentage-based
4. Don't send dynamics for characters not in squad
5. Don't remove ALL examples from Rule 7 (keep 1 pair)
6. Don't change memory system internals recklessly
7. Don't build login rewards, coins, leaderboards, or badges
8. Don't replace the composite retrieval score with similarity-only formula
9. Don't use `|` as delimiter in history format (appears in content)
10. Don't hard-delete memories based on LLM conflict resolution (archive instead)
11. Don't skip the modular prompt snapshot tests before refactoring
12. Don't let WYWA messages enter the LLM context without a source filter

---

## Senior Review Comments

{{{
Overall recommendation: do this, but not as a single wholesale adoption of the proposal. The strongest parts are prompt efficiency, typing fingerprints, depth tuning, and modular prompt construction. The weakest parts are WYWA, PWA/push, and the onboarding rewrite because those cross API, client, persistence, and operational boundaries at the same time.
}}}

{{{
The plan is directionally good, but a few claims are already stale in this repo. Active-squad filtering already exists in src/app/api/chat/route.ts, memory extraction rules are already conditionally injected there, inside_joke is already in the prompt schema + memory type system, theme already exists on profiles, and match_memories already returns category/importance/created_at/last_used_at after supabase/migrations/20260307160000_audit_v3_db_fixes.sql. Treat those as validation, not new work.
}}}

{{{
History compaction is worth doing, but only if the formatter is actually unambiguous. Current message content can contain pipes and newlines, so any line-based format must escape or normalize those before concatenation. Also remember assistant events are persisted through /api/chat/rendered after client-side sequencing, while user messages are persisted from the main chat route; any history/source changes have to cover both paths.
}}}

{{{
I would make Phase 6 mandatory before any large prompt edits. The current prompt path carries tier gating, purchase celebration, idle-autonomous behavior, safety flags, memory snapshot injection, custom names, and an optional USE_DB_CHARACTERS path. If we refactor the prompt without snapshot-style tests for representative scenarios, we are very likely to ship silent behavior regressions rather than obvious crashes.
}}}

{{{
For character depth, typing fingerprints are the best ROI item in the whole proposal. They solve a real immersion problem with low code risk. Depth lines are also good, but keep them short and additive so they enrich the existing voice instead of turning every reply into therapy. I would ship typing fingerprints first, then depth lines, then filtered squad dynamics.
}}}

{{{
The WYWA section is the most product-interesting and the most operationally expensive. There is no vercel.json cron config and no supabase/functions directory today, so background generation is greenfield. At the same time, the app is not starting from zero: there is already client-side idle-autonomous behavior and a browser Notification path in src/hooks/use-chat-api.ts. My advice is to defer WYWA until the prompt architecture is stable, then add a source column to chat_history, filter synthetic rows out of normal LLM context by default, and make sure the UI labels WYWA content clearly so users do not confuse it with live replies.
}}}

{{{
The onboarding/vibe quiz rewrite is valuable, but the proposal understates the implementation spread. vibe_profile would need DB migration work plus wiring through client-journey, auth/settings validation, onboarding persistence, hydration, reset/retake behavior, and Playwright coverage. I would not bundle that with prompt refactoring in the same release unless we want a large QA surface.
}}}

{{{
For memory work, keep the current composite retrieval model and evolve it instead of replacing it. The current retrieveMemoriesHybrid path already blends similarity, recency, importance, and usage. Temporal memory support makes sense, but expiry should archive or ignore at retrieval time rather than hard-delete. Also, embedding backfill on upgrade may be easier to trigger from the existing Dodo webhook path than by introducing a second billing-trigger mechanism immediately.
}}}

{{{
My recommended execution order for this codebase is: 1) compact history + free-tier memory snapshot skip + core-rule compression, 2) typing fingerprints + depth lines + filtered dynamics, 3) prompt modularization with regression tests, 4) selective memory improvements, 5) onboarding quiz, 6) WYWA, 7) push/PWA. That sequence matches the current architecture and minimizes the chance that we break the chat experience while improving it.
}}}
