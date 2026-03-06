# MyGang Pre-Production Deep Audit Results

**Date**: March 7, 2026
**Auditors**: 6 specialized AI agents reading actual code + querying live Supabase database
**Scope**: Security, Database, Frontend/UX, Performance, Chat Experience, Memory System

---

## Table of Contents

1. [Critical Issues](#1-critical-issues-must-fix-before-launch)
2. [Important Improvements](#2-important-improvements-should-fix-soon)
3. [Nice-to-Have Enhancements](#3-nice-to-have-enhancements-post-launch-backlog)
4. [Chat Experience Recommendations](#4-chat-experience-recommendations)
5. [Memory System Redesign Proposal](#5-memory-system-redesign-proposal)

---

## 1. Critical Issues (Must Fix Before Launch)

### SEC-C1. Users Can Self-Elevate Subscription Tier via Browser Console
**File**: Supabase RLS policy on `profiles` table
**Severity**: CRITICAL — complete billing bypass, revenue loss

The RLS UPDATE policy on `profiles` is `id = auth.uid()` with no column restriction. Any authenticated user can open the browser console and run:
```js
supabase.from('profiles').update({ subscription_tier: 'pro' }).eq('id', '<their-user-id>')
```
This bypasses all billing, granting free unlimited messaging, memory, and maximum squad slots.

**Fix**: Add a Postgres trigger that prevents non-service-role users from modifying sensitive columns:
```sql
CREATE OR REPLACE FUNCTION protect_sensitive_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.dodo_customer_id := OLD.dodo_customer_id;
    NEW.abuse_score := OLD.abuse_score;
    NEW.daily_msg_count := OLD.daily_msg_count;
    NEW.last_msg_reset := OLD.last_msg_reset;
    NEW.purchase_celebration_pending := OLD.purchase_celebration_pending;
    NEW.pending_squad_downgrade := OLD.pending_squad_downgrade;
    NEW.restored_members_pending := OLD.restored_members_pending;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER guard_sensitive_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_sensitive_profile_columns();
```

---

### SEC-C2. Analytics Route Allows Unauthenticated Data Injection
**File**: `src/app/api/analytics/route.ts`, line 18

The analytics route rate-limits by IP BEFORE checking auth. The RLS INSERT policy allows `user_id IS NULL`, so unauthenticated users can flood the `analytics_events` table (695 of 1228 rows already have NULL user_id). Potential storage cost attack.

**Fix**: Tighten the RLS INSERT policy: `auth.uid() IS NOT NULL`, or require auth before insert, or add a stricter unauthenticated rate limit (5/min vs 60/min).

---

### DB-C1. `chat_history.user_id` is Nullable — Allows Orphaned Chat Rows
**Table**: `chat_history.user_id`

`user_id` is nullable. NULL rows survive user deletion (CASCADE only works on matching user_id) and are invisible via RLS. Confirmed: 0 NULL rows currently exist.

**Fix**:
```sql
ALTER TABLE chat_history ALTER COLUMN user_id SET NOT NULL;
```

---

### DB-C2. `profiles.subscription_tier` is Nullable — Could Bypass Tier Checks
**Table**: `profiles.subscription_tier`

Nullable despite having a `'free'` default. A NULL value could cause unexpected behavior in billing logic.

**Fix**:
```sql
UPDATE profiles SET subscription_tier = 'free' WHERE subscription_tier IS NULL;
ALTER TABLE profiles ALTER COLUMN subscription_tier SET NOT NULL;
```

---

### FE-C1. Missing `viewport-fit=cover` — Safe Area Insets Broken on Notched iPhones
**File**: `src/app/layout.tsx`

The code references `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` in 8+ components, but there is no `viewport` export with `viewportFit: 'cover'`. Without this, Safari ignores all `env(safe-area-inset-*)` values (resolve to 0).

**Fix**: Add to `src/app/layout.tsx`:
```ts
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}
```

---

### FE-C2. Checkout Success Page Ignores Theme System
**File**: `src/app/checkout/success/page.tsx`, lines 51-98

Hardcoded dark colors (`bg-gradient-to-br from-gray-950`, `text-white`, `bg-purple-600`) that ignore the theme system. In light mode, users see a jarring dark splash screen after paying.

**Fix**: Replace with theme tokens: `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`.

---

### FE-C3. Like/Reply Touch Targets Are 16x16px (Should Be 44x44px)
**File**: `src/components/chat/message-item.tsx`, lines 354-377

The like/reply buttons use `p-0.5` with `w-3 h-3` icons (~16x16px total), far below the 44x44px minimum for mobile.

**Fix**: Change button classes to `p-2.5 -m-2` for a 32px+ touch area while keeping compact visuals.

---

### PERF-C1. Zustand Whole-Store Subscriptions (10 Instances)
**Files**: Multiple hooks and components

10 instances of `useChatStore()` without selectors, causing every component/hook to re-render on EVERY message:
- `src/hooks/use-typing-simulation.ts:13`
- `src/hooks/use-capacity-manager.ts:16`
- `src/hooks/use-chat-history.ts:208`
- `src/hooks/use-chat-api.ts:101`
- `src/components/orchestrator/auth-manager.tsx:30`
- `src/components/orchestrator/squad-reconcile.tsx:25`
- `src/components/landing/landing-page.tsx:208`
- `src/app/onboarding/page.tsx:51`
- `src/app/post-auth/page.tsx:17`
- `src/app/pricing/page.tsx:124`

**Fix**: Use selectors for all: `useChatStore((s) => s.specificField)` or `useShallow` for multiple fields.

---

### PERF-C2. Inline Callback Breaks Memoization on All MessageItems
**File**: `src/app/chat/page.tsx` → `src/components/chat/message-list.tsx:454`

`onReplyMessage={(message) => setReplyingTo(message)}` creates a new function reference each render, breaking `React.memo` on ALL ~100 `MessageItem` components.

**Fix**: `const handleReplyMessage = useCallback((message: Message) => setReplyingTo(message), [])` in ChatPage.

---

### PERF-C3. Sequential DB Queries in Chat Route Hot Path
**File**: `src/app/api/chat/route.ts`, lines 608-773

Auth → profile → memories run sequentially, adding ~50-80ms unnecessary latency per request.

**Fix**: Parallelize profile fetch + memory retrieval after auth:
```ts
const [profileResult, memoriesResult] = await Promise.all([
    supabase.from('profiles').select(...)...,
    shouldRetrieveMemories ? retrieveMemoriesLite(...) : Promise.resolve([])
])
```

---

### PERF-C4. `messages` Prop Causes Cascade Re-renders in useChatApi
**File**: `src/hooks/use-chat-api.ts`

`messages` is passed as a prop but never used directly (reads from `useChatStore.getState().messages` internally). Every message change triggers: ChatPage → useChatApi → all closures recreated.

**Fix**: Remove `messages` from `useChatApi`'s argument list.

---

### CHAT-C1. No Tier Differentiation for AI Event Count
**File**: `src/app/api/chat/route.ts`

Free users get the SAME number of AI character responses (up to 20 events, 3-4 responders) as Pro users. This means equal server cost with zero revenue.

**Fix**: See [Chat Experience Recommendations](#41-tier-specific-event-caps) below.

---

### MEM-C1. Embeddings Are Completely Dead — Zero Exist in Database
**File**: `src/lib/ai/memory.ts`, line 42

`useEmbedding` defaults to `false`. It's only `true` when the user literally types "remember this" (route.ts line 1275). All 7 memories have no embeddings. The `match_memories` RPC, HNSW index, and Google embedding model are all built but unused.

**Fix**: Change `useEmbedding = false` default to `true`, remove the "remember this" gating.

---

## 2. Important Improvements (Should Fix Soon)

### Security

| ID | Issue | File | Fix |
|----|-------|------|-----|
| SEC-I1 | Checkout `plan` not Zod-validated | `api/checkout/route.ts:18` | Add `z.object({ plan: z.enum(['basic', 'pro']) })` |
| SEC-I2 | Checkout `subscription_id` not format-validated | `api/checkout/activate/route.ts:13` | Add Zod schema with string constraints |
| SEC-I3 | Admin `sanitizeTier` missing 'basic' option | `app/admin/actions.ts:34` | Add `'basic'` to allowed values |
| SEC-I4 | In-memory login lockout resets per serverless container | `lib/admin/login-security.ts:11` | Fail closed in production without Redis |
| SEC-I5 | Status page exposes commit SHA, region, env | `app/status/page.tsx` | Remove internal details or protect behind auth |
| SEC-I6 | `console.error` may log sensitive data | Multiple (chat, checkout routes) | Sanitize to only log `error.message` |

### Database

| ID | Issue | Fix |
|----|-------|-----|
| DB-I1 | RLS on `subscriptions`/`billing_events` missing `(SELECT ...)` wrapper | Wrap `auth.uid()`/`auth.role()` in `(SELECT ...)` for per-query evaluation |
| DB-I2 | Redundant RLS SELECT policies on `gangs`, `gang_members`, etc. | Drop the separate SELECT policies since ALL policies cover them |
| DB-I3 | N+1 upsert loop in webhook `onSubscriptionActive` | `api/webhook/dodo-payments/route.ts:134` — batch the upsert |
| DB-I4 | `subscriptions`/`admin_runtime_settings` missing `updated_at` trigger | Add `handle_updated_at()` triggers |
| DB-I5 | `profiles.onboarding_completed` is nullable | `ALTER COLUMN SET NOT NULL` |
| DB-I6 | Leaked password protection disabled in Supabase Auth | Enable in Dashboard → Auth → Password Security |
| DB-I7 | `persistUserJourney` delete-then-insert gang members (not atomic) | `lib/supabase/client-journey.ts:103` — use upsert or DB transaction |

### Frontend

| ID | Issue | File | Fix |
|----|-------|------|-----|
| FE-I1 | Global error page dark-mode only | `app/global-error.tsx:18` | Add `@media (prefers-color-scheme: light)` inline styles |
| FE-I2 | Pricing page CTA uses 15 lines of inline styles | `app/pricing/page.tsx:614` | Replace with Tailwind + Button component |
| FE-I3 | Chat messages lack markdown/link rendering | `components/chat/message-item.tsx:335` | Add `react-markdown` or lightweight renderer |
| FE-I4 | Onboarding error page has no "Go home" link | `app/onboarding/error.tsx` | Add secondary "Go home" link |
| FE-I5 | Auth inputs lack `aria-label` attributes | `components/orchestrator/auth-wall.tsx:155` | Add `aria-label` to email/password inputs |
| FE-I6 | Settings loading lacks `role="status"` | `app/settings/loading.tsx` | Add `role="status"` and `aria-label` |
| FE-I7 | "Back to chat" shown to unauthenticated users on pricing | `app/pricing/page.tsx:229` | Conditionally show "Back to home" |
| FE-I8 | Confetti uses `100vw` (scrollbar overflow) | `components/effects/confetti-celebration.tsx:45` | Change to `100%` |
| FE-I9 | Memory Vault drawer missing focus restoration | `components/chat/memory-vault.tsx` | Store trigger ref, focus on close |
| FE-I10 | Landing hero `7.9rem` text overflows medium viewports | `components/landing/landing-page.tsx:311` | Use `lg:text-[5.5rem] xl:text-[7.9rem]` |

### Performance

| ID | Issue | File | Fix |
|----|-------|------|-----|
| PERF-I1 | `lottie-react` (~250KB) eagerly imported | `components/chat/message-list.tsx:12` | Dynamic import inside EmptyStateWelcome |
| PERF-I2 | `framer-motion` used for trivial scroll button | `components/chat/message-list.tsx` | Replace with CSS transitions |
| PERF-I3 | `useChatHistory` subscribes to entire store | `hooks/use-chat-history.ts:208` | Subscribe to `messages.length` only |
| PERF-I4 | No AbortController on chat API fetch | `hooks/use-chat-api.ts:242` | Add AbortController for cleanup |
| PERF-I5 | `seenByMessageId` recomputed on every message | `components/chat/message-list.tsx:153` | Move to MessageItem or cache delta |
| PERF-I6 | Every MessageItem calls `useTheme()` | `components/chat/message-item.tsx:189` | Pass `isDark` as prop from parent |

---

## 3. Nice-to-Have Enhancements (Post-Launch Backlog)

### Security (Low)
- SEC-L1: CSP uses `unsafe-inline` for scripts (required by Next.js — monitor for nonce support)
- SEC-L2: Rate limit uses user ID only — consider secondary IP-based limit for multi-account abuse
- SEC-L3: `dev_tools` localStorage flag enables debug UI in production

### Database (Low)
- DB-L1: 17 unused indexes (expected for low-volume tables, revisit after 1000+ rows)
- DB-L2: Local migration file timestamps don't match applied migrations
- DB-L3: `characters` table has no explicit write-deny policy (implicitly blocked by RLS)
- DB-L4: `profiles.daily_msg_count` and `abuse_score` are nullable (default 0)

### Frontend (Low)
- FE-L1: No `prefers-reduced-motion` on chat typing/scroll animations
- FE-L2: FAQ items lack `aria-expanded`
- FE-L3: Demo carousel lacks keyboard arrow navigation
- FE-L4: Testimonial 3D tilt doesn't respect reduced motion
- FE-L5: Missing `id="main-content"` on settings, pricing, checkout pages
- FE-L6: Selection step bottom bar could overlap on narrow screens

### Performance (Low)
- PERF-L1: Chat history polls every 12s regardless of activity (consider adaptive or Supabase Realtime)
- PERF-L2: Store persists 100 messages on every state change (consider debouncing)
- PERF-L3: `useAutonomousFlow` subscribes to `messages` array (extract only `.length`)

---

## 4. Chat Experience Recommendations

### 4.1 Tier-Specific Event Caps

**Current**: No differentiation. All tiers get up to 20 events, 3-4 responders.

**Recommended**:

| Metric | Free | Basic | Pro |
|--------|------|-------|-----|
| Max responders (gang_focus) | 2 | 3 | 3 |
| Max responders (ecosystem) | N/A (forced gang_focus) | 3 | 4 |
| Max message+reaction events | 3 | 6 | No limit (up to 20) |
| Max output tokens | 600 | 1000 | 1200 |
| Message split chance | 0% | 30% | 42% |
| Autonomous continuation | Disabled | 1 | 1 |
| Idle autonomous | Disabled | 1 | 1 |

**Rationale**:
- **Free (2 responders, 3 events)**: Taste of group chat — one character responds, maybe another reacts. ~40% cost savings per message. Creates upgrade incentive.
- **Basic (3 responders, 6 events)**: Full group chat feel within 500/month limit. ~15% savings.
- **Pro (no event limit)**: Premium experience with 4 responders in ecosystem mode.

**Implementation**: After route.ts line 840, add tier-aware constants:
```ts
const tierMaxEvents = { free: 3, basic: 6, pro: MAX_EVENTS }
const tierMaxResponders = {
    free: Math.min(2, filteredIds.length),
    basic: Math.min(3, filteredIds.length),
    pro: Math.min(isGangFocusMode ? 3 : 4, filteredIds.length)
}
```

### 4.2 Token Cost Analysis

**Current cost per user message**: ~$0.0005-$0.001 (Google Gemini 2.5 Flash Lite via OpenRouter)

| Tier | Messages/mo | Autonomous calls | Total LLM calls | Monthly cost | Revenue | Margin |
|------|-------------|-----------------|-----------------|-------------|---------|--------|
| Free | ~100-300 | 0 | 100-300 | $0.04-$0.11 | $0 | -$0.11 |
| Basic | Up to 500 | ~250 | 750 | ~$0.40 | $14.99 | 97% |
| Pro | ~1000-2000 | ~500-1000 | 1500-3000 | $1.11-$2.22 | $19.99 | 89-94% |

**Cost optimization opportunities**:
1. Tier-based event caps (saves ~30% on free tier)
2. Lightweight prompt for short messages (<20 chars) — skip memory, reduce system prompt ~50%
3. Filter reaction-only messages from LLM context (saves ~5-10% input tokens)
4. Consider idle autonomous as Pro-only (halves basic-tier autonomous cost)
5. Batch memory compaction (raise threshold from 10 to 25)

### 4.3 Paywall & Cooldown UX Issues

**Issue 1**: When a message fails with "Message limit reached", the Retry button triggers a full LLM round-trip that will fail again.
**Fix**: Hide Retry button when error is rate-limit related. Show "Try again in X minutes" instead.

**Issue 2**: After dismissing the paywall popup, no persistent indicator of cooldown status.
**Fix**: Show a subtle inline banner at the top of chat: "Free tier cooldown — 12:34 remaining" with an upgrade link.

**Issue 3**: When countdown reaches 0, modal doesn't auto-close.
**Fix**: Auto-dismiss the modal when cooldown expires and show a toast "You can send messages again!"

### 4.4 Chat Quality Improvements

1. **Parallel typing simulation**: Instead of sequential event playback, batch 2-3 typing indicators simultaneously, reveal messages 200-500ms apart. Mimics real group chat timing.

2. **Reduce message split aggressiveness**: 42% is too high. Recommend 20% for ecosystem, 15% for gang_focus.

3. **Smart context selection**: Instead of last N messages, weight user messages higher. Skip reaction-only messages in context to save tokens.

4. **Starter chips**: The `ChatInput` supports `starterChips` but they're not populated. Add engaging openers: "Tell me about yourselves", "Roast me", "What should we talk about?"

5. **Message count indicator for Basic tier**: Show "42 of 500 messages used this month" in chat header or settings.

### 4.5 Tier Value Differentiation

**Free — Hook to upgrade**:
- After 15th message (of 20), show subtle inline toast: "5 messages left this hour"
- Show badge on first greeting: "Free tier — 20 messages/hour" to set expectations
- After paywall: "Pro users never see this screen"

**Basic — Worth $14.99/mo**:
- Memory is the key differentiator. Add system prompt note: "EXPLICITLY demonstrate memory by referencing past facts naturally"
- Display remaining monthly messages in UI
- Ecosystem mode access makes chat feel alive

**Pro — Distinctly better than Basic**:
- 6 squad members vs 5 creates a more dynamic group feel
- 30 context messages = characters remember more of the current conversation
- Consider Pro-exclusive: custom character voice adjustments or "director mode" (set conversation topic)

---

## 5. Memory System Redesign Proposal

### 5.1 Current State Summary

- **7 total memories** across 2 users, all kind='episodic', **zero embeddings**
- Embeddings never generated (`useEmbedding` defaults to `false`)
- Retrieval uses keyword overlap (`retrieveMemoriesLite`), not semantic similarity
- Compaction merges ALL memories into one 400-char paragraph at threshold of 10
- `last_used_at` tracked but never used for retrieval ranking
- `metadata` column exists but never used
- `match_memories` RPC, HNSW index, Google embedding model — all built but unused
- No character-specific memories, no categories, no decay system

### 5.2 Gap Analysis

| What's Missing | Impact |
|---------------|--------|
| Embeddings dead — keyword-only retrieval | Misses semantic matches ("stressed" won't find "rough day at work") |
| No character-specific memories | All characters see the same memories — can't have character-specific relationships |
| No memory categories | Everything is flat text — no identity/preference/life_event distinction |
| No importance/decay system | 3-month-old casual mention treated same as yesterday's milestone |
| No emotional tracking | Characters can't follow up on user's emotional state across sessions |
| Compaction destroys information | All memories → one 400-char paragraph loses granularity |
| No upgrade hook for free users | Static lock screen instead of showing what they're missing |
| No proactive memory usage | Characters never spontaneously bring up memories |

### 5.3 Proposed Schema Changes

```sql
-- New columns on memories table
ALTER TABLE memories ADD COLUMN category text DEFAULT 'general'
  CHECK (category IN ('identity','preference','life_event','emotional',
                       'relationship','topic','user_stated','general'));
ALTER TABLE memories ADD COLUMN character_id text;
ALTER TABLE memories ADD COLUMN decay_score float DEFAULT 1.0;
ALTER TABLE memories ADD COLUMN access_count integer DEFAULT 0;
ALTER TABLE memories ADD COLUMN compacted_into uuid REFERENCES memories(id);

-- New indexes
CREATE INDEX memories_category_idx ON memories (user_id, category, created_at DESC);
CREATE INDEX memories_character_idx ON memories (user_id, character_id, created_at DESC)
  WHERE character_id IS NOT NULL;
```

### 5.4 Structured Memory Categories

| Category | Description | Population | Retrieval Priority |
|----------|-------------|------------|--------------------|
| `identity` | Name, age, pronouns, occupation, location | Auto-extracted by LLM | Always included |
| `preference` | Likes, dislikes, favorites, communication style | Auto-extracted by LLM | When relevant |
| `life_event` | Major events: new job, breakup, birthday | Auto-extracted, elevated importance | High, time-sensitive |
| `emotional` | Session emotional snapshots | Auto-extracted per session | Most recent always included |
| `relationship` | Character-specific: inside jokes, shared moments | Auto per character interaction | Character-filtered |
| `topic` | Recurring conversation themes | Auto-categorized from tags | Topic continuity |
| `user_stated` | Explicit "remember this" from user | Manual trigger | Highest priority, never decayed |

### 5.5 Importance & Decay System

**Importance scale** (1-5):
- 1 = Casual mention ("I think I like sushi")
- 2 = Explicit statement ("I'm a student at MIT")
- 3 = Corrected/emphasized ("No, I said I'm an ENGINEER")
- 4 = Life event/emotional milestone ("I got the job!")
- 5 = User-pinned ("remember this forever")

**Decay function** (calculated at retrieval, not stored):
```
effective_score = base_importance * decay_multiplier * recency_boost * access_bonus

decay_multiplier = 1.0 for identity/user_stated, else max(0.1, 1.0 - days_since/90)
recency_boost = 1.5 if accessed in last 7 days, else 1.0
access_bonus = min(1.5, 1.0 + access_count * 0.05)
```

### 5.6 Hybrid Retrieval Algorithm

Replace `retrieveMemoriesLite` with three-signal hybrid:
```
final_score = (0.4 * semantic_similarity) + (0.3 * keyword_overlap) + (0.3 * effective_score)
```

Steps:
1. Embedding search via `match_memories` — top 15 candidates
2. Keyword search via `retrieveMemoriesLite` — top 15 candidates
3. Merge, deduplicate, score with combined formula
4. Return top 7 (up from 5)
5. Always-include slots: top identity + most recent emotional memory
6. Fetch 2 character-specific memories per responding character

### 5.7 Improved Compaction

- Raise threshold from 10 to 25 memories
- Never compact `identity`, `user_stated`, or importance >= 4
- Topic-based merging (group similar before compacting)
- Preserve highest importance from source memories
- Use prompt: "Merge into 2-3 concise facts. Preserve names, dates, numbers, emotions."

### 5.8 Character Behavior Enhancements

**Session-start memory injection** (returning after 2+ hours):
```
== RETURNING USER CONTEXT ==
Last session: 6 hours ago
Last emotional state: stressed about exams
Suggested: Atlas check in about exam prep, Luna ask how they're feeling
```

**Character-specific references**:
- Luna: "hey did you ever ask them out?"
- Atlas: "how's the workout going?"
- Nyx: "predictable? at least I show up" (callback to roast battle)

**Inside joke system**: Flag humor with strong reactions as `relationship` memories with `inside_joke` tag. Elevated retrieval in lighthearted conversations.

**Emotional continuity**: Track `last_emotional_state`. When user was upset → Luna opens warm, Atlas offers support, Nyx dials back roasting. When happy → Kael matches energy, Rico amplifies.

### 5.9 Tier-Specific Memory

| Feature | Free | Basic ($14.99) | Pro ($19.99) |
|---------|------|----------------|--------------|
| Memory storage | None (session-only) | 100 active memories | 500 active memories |
| Categories | N/A | All | All + `user_stated` pinning |
| Retrieval | N/A | Top 5 keyword | Top 7 hybrid (embedding + keyword) |
| Character memories | N/A | No (global only) | Yes (per character) |
| Compaction | N/A | Standard (25 threshold) | Smart (topic-based, never touches pinned) |
| Emotional tracking | N/A | Basic (last session) | Full (cross-session arcs) |
| Proactive callbacks | N/A | No | Yes |
| Memory Vault UI | Locked + ghost previews | CRUD + search | CRUD + filters + pin/unpin + importance |

**Free tier upgrade hook**: "Ghost memories" — extract memories but don't store them. Show blurred previews: "The gang knows you like ████ and that you're a ████". Show toast: "The gang noticed 3 things about you but can't remember them on the free plan."

### 5.10 Token Impact

Current memory snapshot: ~650-800 tokens per request.
After redesign (Pro): ~1050-1200 tokens (+300-400 tokens, ~$0.0003-$0.001 per message).

### 5.11 Implementation Phases

1. **Phase 1**: Enable embeddings (change `useEmbedding` default, backfill 7 existing memories)
2. **Phase 2**: Schema enhancement (add category, character_id, decay_score, access_count columns)
3. **Phase 3**: Enhanced LLM extraction (add category + character_id to memory_updates schema)
4. **Phase 4**: Hybrid retrieval (embedding + keyword + decay scoring)
5. **Phase 5**: Memory Vault UI (category badges, pin/unpin, ghost previews for free)
6. **Phase 6**: Returning user context (session-start callbacks, emotional continuity)

---

## Priority Summary

### Must Fix Before Launch (13 items)
| # | Category | Issue | Effort |
|---|----------|-------|--------|
| 1 | Security | SEC-C1: Profile tier self-elevation via browser console | Low (DB trigger) |
| 2 | Security | SEC-C2: Unauthenticated analytics injection | Low (RLS fix) |
| 3 | Database | DB-C1: `chat_history.user_id` nullable | Trivial (ALTER) |
| 4 | Database | DB-C2: `profiles.subscription_tier` nullable | Trivial (ALTER) |
| 5 | Frontend | FE-C1: Missing `viewport-fit=cover` | Trivial |
| 6 | Frontend | FE-C2: Checkout success hardcoded dark colors | Low |
| 7 | Frontend | FE-C3: Tiny touch targets on like/reply | Trivial |
| 8 | Performance | PERF-C1: 10 Zustand whole-store subscriptions | Low (mechanical) |
| 9 | Performance | PERF-C2: Inline callback breaks MessageItem memo | Trivial |
| 10 | Performance | PERF-C3: Sequential DB queries in chat route | Low |
| 11 | Performance | PERF-C4: `messages` prop cascade re-renders | Low |
| 12 | Chat | CHAT-C1: No tier differentiation for events | Medium |
| 13 | Memory | MEM-C1: Embeddings completely dead | Low |

### Should Fix Soon (23 items)
Security (6) + Database (7) + Frontend (10) + Performance (6) — see tables above.

### Post-Launch Backlog (15 items)
Security (3) + Database (4) + Frontend (6) + Performance (3) — see section 3.

---

## What's Working Well

- Auth flow: Properly uses `supabase.auth.getUser()` in all API routes
- Webhook signature verification via Dodo Payments SDK
- Webhook idempotency with `logBillingEvent` duplicate checking
- Admin PBKDF2 hashing with 100K iterations + timing-safe comparison
- Redirect validation with allowlist (prevents open redirects)
- Chat input validation with comprehensive Zod schemas
- Content safety: Dual-layer hard/soft content filtering with Unicode normalization
- Security headers: CSP, X-Frame-Options DENY, HSTS, Referrer-Policy configured
- Rate limiting: Fail-closed in production without Redis
- No hardcoded secrets (all in env vars, `.env*` gitignored)
- CASCADE chain: User deletion properly cascades through all tables
- Dynamic imports: Heavy components (MemoryVault, ChatSettings, PaywallPopup) lazy loaded
- `content-visibility: auto` on old messages for render performance
- Good loading/error/empty state coverage across pages
- Theme system well-implemented with CSS variables
- Safe-area-inset usage in components (just needs viewport-fit meta to activate)
