# 10th March Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all confirmed bugs from the 10th March audit across Phases 1-2 (19 items: 1 critical, 5 high, 7 medium from Phase 2, plus Phase 3 quick wins).

**Architecture:** Bug fixes only — no new features, no refactoring. Each task groups edits by file to prevent conflicts. DB migrations run last.

**Tech Stack:** Next.js 16, TypeScript, Supabase (PostgreSQL 17), Zustand, Zod, Vercel AI SDK

**Spec:** `docs/10th_march_audit/FINAL-PLAN.md` + individual specialist reports `01`–`07`

---

## File Map

| Task | Files | Fixes |
|------|-------|-------|
| 1 | `src/app/api/webhook/dodo-payments/route.ts` | C1 (dispute handler), M2 (module-level client) |
| 2 | `src/app/api/chat/route.ts` | H1 (squad limit), H2 (purchase celebration), H3 (LLM timeout), M10 (metadata leak), M8 (vestigial counter) |
| 3 | `src/app/chat/page.tsx` | H5 (cooldown clear on tier change) |
| 4 | `src/hooks/use-chat-api.ts` | M4 (retry counter resets) |
| 5 | `src/stores/chat-store.ts` | M5 (rehydration mutation) |
| 6 | `src/app/api/customer-portal/route.ts` | M2 (module-level client) |
| 7 | `src/lib/env.ts` (new) | H4 (env var validation) |
| 8 | Supabase migration (new) | M1 (relationship_state race), M7 (subscriptions unique index) |

---

## Chunk 1: Phase 1 — Launch Blockers

### Task 1: Fix Dispute Handler + Move Module-Level Client (C1, M2)

**Files:**
- Modify: `src/app/api/webhook/dodo-payments/route.ts`

**Audit refs:** `07-business-logic-security.md` C1, `02-sre-production-readiness.md` M2, `05-data-engineering.md` dispute cross-confirmation

- [ ] **Step 1: Fix C1 — Rewrite `onDisputeOpened` to find the correct user**

Replace lines 394-416 in `src/app/api/webhook/dodo-payments/route.ts`:

```typescript
onDisputeOpened: async (payload) => {
    const data = payload.data as Record<string, unknown>
    const disputeId = data.dispute_id as string ?? null

    // C1 FIX: Find the actual disputed user via customer_id + email fallback
    // (same pattern as all other handlers — never query random billing_events)
    const customerId = getWebhookCustomerId(data)
    const customerEmail = getWebhookCustomerEmail(data)

    const userId = customerId
        ? await findUserByCustomerId(customerId)
        : customerEmail
            ? await findUserByEmailFallback(customerEmail)
            : null

    if (!userId) {
        // Log as orphaned — do NOT downgrade anyone
        console.error(`[webhook] Dispute opened but no user found. customer_id=${customerId}, dispute_id=${disputeId}`)
        await logBillingEvent(null, 'dispute.opened.orphaned', disputeId, data)
        return
    }

    const isNew = await logBillingEvent(userId, 'dispute.opened', disputeId, data)
    if (!isNew) return

    await supabase.from('profiles').update({ subscription_tier: 'free', pending_squad_downgrade: true }).eq('id', userId)
    await supabase.from('subscriptions').update({ status: 'disputed', updated_at: new Date().toISOString() }).eq('user_id', userId).in('status', ['active', 'cancelled_pending'])
},
```

- [ ] **Step 2: Fix M2 — Move `createAdminClient()` from module scope into each handler**

Replace line 6:
```typescript
// OLD: const supabase = createAdminClient()
```

With a helper that creates client lazily inside each handler. Since every handler in the `Webhooks()` config needs `supabase`, the cleanest approach is to call `createAdminClient()` at the start of each handler function body. But since the `Webhooks` wrapper calls these as callbacks, and `createAdminClient` internally caches, the safest fix is:

```typescript
function getSupabase() {
    return createAdminClient()
}
```

Then replace every `supabase` usage with `getSupabase()` call — OR — just move the declaration inside the POST handler scope. Given the Webhooks wrapper pattern, the simplest fix: keep the lazy getter pattern.

Actually, the simplest and safest: just move the `const supabase = createAdminClient()` to a lazy getter function, so env vars are read at call time not import time:

```typescript
// Lazy initialization — avoids module-scope crash if env vars missing
function getAdminClient() {
    return createAdminClient()
}
```

Then replace all `supabase.` calls with `getAdminClient().` throughout the file.

- [ ] **Step 3: Verify the file compiles**

Run: `cd C:/coding/mygangbyantig && npx tsc --noEmit src/app/api/webhook/dodo-payments/route.ts 2>&1 | head -20`

- [ ] **Step 4: Commit**

```
git add src/app/api/webhook/dodo-payments/route.ts
git commit -m "fix: C1 dispute handler finds correct user, M2 lazy admin client"
```

---

### Task 2: Chat Route Fixes (H1, H2, H3, M10, M8)

**Files:**
- Modify: `src/app/api/chat/route.ts`

**Audit refs:** `07-business-logic-security.md` H1/H2/M10, `02-sre-production-readiness.md` H3, `05-data-engineering.md` M8

- [ ] **Step 1: H1 — Enforce squad size limit server-side**

After line 759 (`const profileTier = getTierFromProfile(...)`) the tier is known. But `filteredIds` was created at line 651 before auth. We need to re-slice after auth.

Add after line 759 (after `profileTier` is determined):
```typescript
// H1 FIX: Enforce tier-based squad limit server-side
const squadLimit = getSquadLimit(profileTier)
const tierFilteredIds = filteredIds.slice(0, squadLimit)
```

Then replace all subsequent uses of `filteredIds` with `tierFilteredIds`:
- Line 663: `const activeGangSafe = CHARACTERS.filter((c) => tierFilteredIds.includes(c.id))`
- Line 664: `const allowedSpeakers = new Set<string>(['user', ...tierFilteredIds])`
- And all other references to `filteredIds` after this point.

Import `getSquadLimit` — already imported at line 9.

- [ ] **Step 2: H2 — Remove `purchaseCelebration` from client schema, read from DB**

**2a.** Remove from Zod schema (line 530):
```typescript
// DELETE this line:
// purchaseCelebration: z.enum(['basic', 'pro']).optional(),
```

**2b.** Add `purchase_celebration_pending` to profile SELECT (line 755):
```typescript
.select('user_profile, relationship_state, session_summary, summary_turns, daily_msg_count, last_msg_reset, subscription_tier, abuse_score, custom_character_names, purchase_celebration_pending')
```

**2c.** After profile is fetched, read celebration from DB (after line 759):
```typescript
// H2 FIX: Read purchase celebration from DB, not client
const purchaseCelebration = (profile?.purchase_celebration_pending === 'basic' || profile?.purchase_celebration_pending === 'pro')
    ? profile.purchase_celebration_pending
    : null
```

**2d.** Remove the destructured `purchaseCelebration` from the parsed body (line 642). It's already in the destructuring — just remove it from there.

**2e.** In the fire-and-forget persistence block, clear the flag after use:
```typescript
// Clear purchase celebration flag after it's been used in prompt
if (purchaseCelebration) {
    await supabase.from('profiles').update({ purchase_celebration_pending: null }).eq('id', user.id)
}
```

- [ ] **Step 3: H3 — Add LLM timeout with AbortController**

Wrap the `generateObject` call (line 1132) with an AbortController:

```typescript
const llmController = new AbortController()
const llmTimeout = setTimeout(() => llmController.abort(), 25_000)
try {
    const result = await generateObject({
        model: openRouterModel,
        schema: responseSchema,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: conversationPayload },
        ],
        maxOutputTokens: llmMaxOutputTokens,
        maxRetries: LLM_MAX_RETRIES,
        abortSignal: llmController.signal,
    })
    object = result.object
    providerUsed = 'openrouter'
} finally {
    clearTimeout(llmTimeout)
}
```

The existing `catch` block after the try already handles errors — keep it, just wrap the try with `finally` for cleanup.

- [ ] **Step 4: M10 — Remove internal metadata from response**

Replace the usage object in the response (lines 1393-1398):

```typescript
// OLD:
// usage: {
//     promptChars: llmPromptChars,
//     responseChars: JSON.stringify(object.events).length,
//     historyCount: historyForLLM.length,
//     provider: providerUsed,
// },

// NEW: Remove usage entirely from response (already logged server-side via logChatRouteMetric)
```

Just delete the `usage` key from the response object.

- [ ] **Step 5: M8 — Remove vestigial daily_msg_count from profile SELECT**

In the profile SELECT (line 755), remove `daily_msg_count, last_msg_reset` from the select string:

```typescript
.select('user_profile, relationship_state, session_summary, summary_turns, subscription_tier, abuse_score, custom_character_names, purchase_celebration_pending')
```

Also find and remove any references to `daily_msg_count` in the chat route (the `p_daily_msg_increment: 1` in the RPC call).

- [ ] **Step 6: Verify compilation**

Run: `cd C:/coding/mygangbyantig && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 7: Commit**

```
git add src/app/api/chat/route.ts
git commit -m "fix: H1 squad limit, H2 purchase celebration from DB, H3 LLM timeout, M10 strip metadata, M8 remove vestigial counter"
```

---

### Task 3: Clear Cooldown on Tier Change (H5)

**Files:**
- Modify: `src/app/chat/page.tsx`

**Audit ref:** `03-qa-edge-cases.md` H5

- [ ] **Step 1: Add useEffect that clears cooldown when subscriptionTier changes**

Add after the cooldown countdown effect (after line 388):

```typescript
// H5 FIX: Clear cooldown when subscription tier changes (user just upgraded)
useEffect(() => {
    setCooldownUntil(0)
    setCooldownLabel(null)
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('mygang-cooldown-until')
    }
}, [subscriptionTier])
```

- [ ] **Step 2: Commit**

```
git add src/app/chat/page.tsx
git commit -m "fix: H5 clear cooldown timer on tier change"
```

---

## Chunk 2: Phase 2 — First Week Fixes

### Task 4: Retry Counter Resets (M4)

**Files:**
- Modify: `src/hooks/use-chat-api.ts`

**Audit ref:** `03-qa-edge-cases.md` M4

- [ ] **Step 1: Add counter resets to handleRetryMessage**

In `handleRetryMessage` (line 683), add after line 694 (`clearIdleAutonomousTimerRef.current()`):

```typescript
// M4 FIX: Reset autonomous counters like enqueueUserMessage does
silentTurnsRef.current = 0
burstCountRef.current = 0
```

- [ ] **Step 2: Commit**

```
git add src/hooks/use-chat-api.ts
git commit -m "fix: M4 reset autonomous counters on message retry"
```

---

### Task 5: Fix Rehydration Mutation (M5)

**Files:**
- Modify: `src/stores/chat-store.ts`

**Audit ref:** `03-qa-edge-cases.md` M5

- [ ] **Step 1: Replace in-place mutation with immutable map**

Replace lines 191-206 in `onRehydrateStorage`:

```typescript
onRehydrateStorage: () => (state) => {
    if (state?.messages) {
        // M5 FIX: Create new objects instead of mutating in-place
        // (mutation defeats MessageItem memo — same ref = skip re-render)
        const fixed = state.messages.map(m =>
            m.deliveryStatus === 'sending'
                ? { ...m, deliveryStatus: 'failed' as const, deliveryError: 'Message interrupted. Please retry.' }
                : m
        )
        const hadStale = fixed.some((m, i) => m !== state.messages[i])
        rebuildIdSet(fixed)
        if (hadStale) {
            useChatStore.setState({ messages: fixed })
        } else {
            rebuildIdSet(state.messages)
        }
    }
    // Enrich activeGang from catalog to restore avatar URLs lost during serialization
    if (state?.activeGang?.length) {
        const enriched = state.activeGang.map(char => {
            const catalog = CHARACTERS.find(c => c.id === char.id)
            return catalog ? { ...catalog, ...char, avatar: catalog.avatar } : char
        })
        useChatStore.setState({ activeGang: enriched })
    }
},
```

- [ ] **Step 2: Commit**

```
git add src/stores/chat-store.ts
git commit -m "fix: M5 immutable message rehydration for correct memo behavior"
```

---

### Task 6: Customer Portal Module-Level Client (M2)

**Files:**
- Modify: `src/app/api/customer-portal/route.ts`

**Audit ref:** `02-sre-production-readiness.md` M2

- [ ] **Step 1: Move DodoPayments client creation inside handler**

Replace lines 6-9:

```typescript
// OLD module-level:
// const portalHandler = CustomerPortal({
//     bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
//     environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
// })
```

With lazy initialization:

```typescript
// M2 FIX: Lazy init to avoid module-scope crash on missing env vars
let _portalHandler: ReturnType<typeof CustomerPortal> | null = null
function getPortalHandler() {
    if (!_portalHandler) {
        _portalHandler = CustomerPortal({
            bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
            environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
        })
    }
    return _portalHandler
}
```

Then in the GET handler, replace `return portalHandler(newReq)` with `return getPortalHandler()(newReq)`.

- [ ] **Step 2: Commit**

```
git add src/app/api/customer-portal/route.ts
git commit -m "fix: M2 lazy customer portal client initialization"
```

---

### Task 7: Env Var Validation (H4)

**Files:**
- Create: `src/lib/env.ts`

**Audit ref:** `02-sre-production-readiness.md` H4

- [ ] **Step 1: Create src/lib/env.ts**

```typescript
import { z } from 'zod'

const envSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    DODO_PAYMENTS_API_KEY: z.string().min(1),
    DODO_PAYMENTS_WEBHOOK_KEY: z.string().min(1),
    DODO_PRODUCT_BASIC: z.string().min(1),
    DODO_PRODUCT_PRO: z.string().min(1),
    ADMIN_PANEL_SESSION_SECRET: z.string().min(32),
    // Optional — Redis not required for dev
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

export function getEnv(): Env {
    if (!_env) {
        const result = envSchema.safeParse(process.env)
        if (!result.success) {
            const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n')
            throw new Error(`Missing or invalid environment variables:\n${missing}`)
        }
        _env = result.data
    }
    return _env
}

// Validate at import time in production
if (process.env.NODE_ENV === 'production') {
    getEnv()
}
```

- [ ] **Step 2: Commit**

```
git add src/lib/env.ts
git commit -m "feat: H4 env var validation with Zod schema"
```

---

### Task 8: Database Migrations (M1, M7)

**Files:**
- Create: `supabase/migrations/20260310200000_audit_phase2_fixes.sql`

**Audit refs:** `05-data-engineering.md` M1, M7

- [ ] **Step 1: Create migration for M1 (relationship_state merge) and M7 (subscriptions unique index)**

```sql
-- M7: Partial unique index preventing multiple active subscriptions per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_active
ON subscriptions(user_id)
WHERE status IN ('active', 'cancelled_pending');

-- M1: Fix relationship_state race condition in increment_profile_counters
-- Change from full COALESCE replacement to jsonb merge (||) so concurrent calls
-- merge deltas instead of overwriting
CREATE OR REPLACE FUNCTION increment_profile_counters(
  p_user_id UUID,
  p_daily_msg_increment INT DEFAULT 0,
  p_abuse_score_increment NUMERIC DEFAULT 0,
  p_session_summary TEXT DEFAULT NULL,
  p_summary_turns INT DEFAULT NULL,
  p_user_profile JSONB DEFAULT NULL,
  p_relationship_state JSONB DEFAULT NULL,
  p_last_active_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(daily_msg_count INT, last_msg_reset TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_daily_msg_count INT;
  v_last_msg_reset TIMESTAMPTZ;
  _role text;
BEGIN
  _role := coalesce(current_setting('request.jwt.claim.role', true), '');
  IF _role NOT IN ('service_role', 'supabase_admin') THEN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Access denied: cannot update another user''s counters';
    END IF;
  END IF;

  SELECT p.daily_msg_count, p.last_msg_reset
    INTO v_daily_msg_count, v_last_msg_reset
    FROM profiles p
   WHERE p.id = p_user_id
     FOR UPDATE;

  IF v_last_msg_reset IS NULL OR (now() - v_last_msg_reset) > interval '24 hours' THEN
    v_daily_msg_count := 0;
    v_last_msg_reset := now();
  END IF;

  v_daily_msg_count := LEAST(10000, GREATEST(0, COALESCE(v_daily_msg_count, 0) + p_daily_msg_increment));

  UPDATE profiles SET
    daily_msg_count = v_daily_msg_count,
    last_msg_reset = v_last_msg_reset,
    abuse_score = LEAST(1000, GREATEST(0, COALESCE(abuse_score, 0) + p_abuse_score_increment)),
    session_summary = COALESCE(p_session_summary, session_summary),
    summary_turns = COALESCE(p_summary_turns, summary_turns),
    user_profile = COALESCE(p_user_profile, user_profile),
    -- M1 FIX: Merge relationship_state with || instead of full replace
    -- This ensures concurrent calls merge their deltas instead of last-writer-wins
    relationship_state = CASE
      WHEN p_relationship_state IS NOT NULL AND relationship_state IS NOT NULL
        THEN relationship_state || p_relationship_state
      ELSE COALESCE(p_relationship_state, relationship_state)
    END,
    last_active_at = COALESCE(p_last_active_at, last_active_at)
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_daily_msg_count, v_last_msg_reset;
END;
$$;
```

- [ ] **Step 2: Apply migration to Supabase**

Run: `cd C:/coding/mygangbyantig && npx supabase db push`

Or apply via Supabase MCP tool.

- [ ] **Step 3: Commit**

```
git add supabase/migrations/20260310200000_audit_phase2_fixes.sql
git commit -m "fix: M1 relationship_state merge, M7 subscriptions unique index"
```

---

## Summary

| Fix | Severity | Task | Description |
|-----|----------|------|-------------|
| C1 | CRITICAL | 1 | Dispute handler finds correct user |
| H1 | HIGH | 2 | Squad size enforced server-side |
| H2 | HIGH | 2 | Purchase celebration from DB not client |
| H3 | HIGH | 2 | LLM timeout 25s |
| H4 | HIGH | 7 | Env var validation |
| H5 | HIGH | 3 | Clear cooldown on tier change |
| M1 | MEDIUM | 8 | Relationship state merge not replace |
| M2 | MEDIUM | 1+6 | Module-level clients lazy init |
| M4 | MEDIUM | 4 | Retry counter resets |
| M5 | MEDIUM | 5 | Rehydration immutable |
| M7 | MEDIUM | 8 | Subscriptions unique constraint |
| M8 | MEDIUM | 2 | Remove vestigial counter |
| M10 | MEDIUM | 2 | Strip usage metadata from response |
