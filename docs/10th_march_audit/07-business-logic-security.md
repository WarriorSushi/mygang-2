# Business Logic Security Review

## Summary

Strong security fundamentals — server-side tier enforcement on rate limits, webhook idempotency via DB constraints, proper auth gating on all routes. Three real exploitable issues found: dispute handler downgrades the wrong user, squad size limit not enforced server-side, and client-controlled `purchaseCelebration` injects fake events into AI prompts.

---

## Findings

### [CRITICAL] Dispute Handler Downgrades Wrong User

**Attack Vector:** `dispute.opened` webhook fires. Handler queries for ANY `payment.succeeded` event — no filter on the disputed payment/customer.

**File:** `src/app/api/webhook/dodo-payments/route.ts` lines 394-416

**Issue:**
```typescript
const { data: event } = await supabase
    .from('billing_events')
    .select('user_id')
    .eq('event_type', 'payment.succeeded')
    .not('user_id', 'is', null)
    .limit(1)
    .single()
```
Grabs the first `payment.succeeded` event it finds. An innocent user gets downgraded to free with `pending_squad_downgrade: true`.

**Impact:** Any dispute webhook downgrades a random paying user. Data integrity failure that directly harms innocent users.

**Fix:** Extract `customer_id` or `payment_id` from dispute payload. Use `findUserByCustomerId` + `findUserByEmailFallback` pattern. If no match, log as orphaned and do NOT downgrade anyone.

---

### [HIGH] Squad Size Not Enforced Server-Side

**Attack Vector:** Free-tier user sends `POST /api/chat` with `activeGangIds` containing 6 character IDs.

**File:** `src/app/api/chat/route.ts` lines 648-661

**Issue:** Code comment says "tier-based limit enforced after auth" but it never is. `filteredIds` accepts up to 6 regardless of tier. All 6 characters appear in the system prompt SQUAD section, giving free users pro-level context.

**Impact:** Free users get pro-level squad sizes via direct API calls. Increases LLM costs per request.

**Fix:** After auth: `filteredIds = filteredIds.slice(0, getSquadLimit(tier))`.

---

### [HIGH] Client-Controlled `purchaseCelebration` Enables Fake Celebrations

**Attack Vector:** Any user sends `{ "purchaseCelebration": "pro" }` in chat request body.

**File:** `src/app/api/chat/route.ts` lines 530, 1025-1031

**Issue:** Field accepted from client with `z.enum(['basic', 'pro']).optional()` and injected into system prompt as "SPECIAL EVENT - PURCHASE CELEBRATION" without verifying any purchase occurred. Server never checks `purchase_celebration_pending` in profile.

**Impact:** Free users trigger fake celebrations, manipulating AI behavior. Wastes prompt tokens.

**Fix:** Remove `purchaseCelebration` from client schema. Read `purchase_celebration_pending` from profile DB row (already fetched). Clear flag in persistence block.

---

### [MEDIUM] Chat API Response Leaks Internal Metadata

**File:** `src/app/api/chat/route.ts` lines 1393-1398

**Issue:** Response includes `usage` object with `promptChars`, `responseChars`, `historyCount`, and `provider`. Reveals infrastructure details and enables prompt size reverse-engineering.

**Fix:** Remove `usage` from production responses or strip to only `messages_remaining`. Data already logged server-side via `logChatRouteMetric`.

---

### [LOW] Activation Endpoint Leaks Subscription Status via Distinct Error Codes

**File:** `src/app/api/checkout/activate/route.ts`

**Issue:** Returns distinct `customer_mismatch`, `missing_customer`, `subscription_not_found` errors. Confirms subscription existence even for non-owners. UUIDs make enumeration impractical, but more info than necessary.

**Fix:** Return single `activation_failed` for all non-success cases.

---

### [LOW] Prompt Injection via `userName` / `userNickname` / `customCharacterNames`

**File:** `src/app/api/chat/route.ts` lines 964-970, 996

**Issue:** User-controlled strings injected into system prompt without newline/special character sanitization. Could break out of prompt template context. Impact limited to attacker's own session (no cross-user effect). LLMs have built-in resistance + anti-injection instructions in the prompt.

**Fix:** Sanitize before prompt injection: strip newlines, limit 32 chars, alphanumeric + spaces only.

---

### [INFORMATIONAL] `source` Parameter Client-Controlled

**Issue:** `source` and `autonomousIdle` from client control response mode (shorter responses, skip memory). Attacker can only self-degrade. Server-side rate limiting uses `hasFreshUserTurn` as authoritative signal, independent of `source`.

**No action needed.** Client can only give themselves a worse experience.

---

### [INFORMATIONAL] Memory Functions Create Own Supabase Clients

**File:** `src/lib/ai/memory.ts`

**Issue:** `storeMemories()` and `retrieveMemoriesHybrid()` create their own Supabase clients via `createClient()` instead of receiving one from the caller. In `waitUntil` background execution, cookie/session state may not be reliably available.

**Impact:** Reliability concern (memory writes may silently fail in background), NOT a security/isolation issue. RLS prevents cross-user access regardless.

**Recommendation:** Pass authenticated client from route handler for consistency.

---

## What's Done Well

1. **Server-side tier enforcement** — tier read from DB, not client. Rate limiting via Redis with proper tier buckets.
2. **Webhook idempotency** — `dodo_event_id` unique constraints, atomic INSERT ON CONFLICT
3. **Webhook signature verification** — Dodo SDK `Webhooks()` wrapper handles it
4. **Customer portal ownership** — reads `dodo_customer_id` from authenticated profile, not client
5. **Checkout race handling** — conditional update `is('dodo_customer_id', null)` prevents double-click
6. **Zod validation on all routes** — strict schemas with max lengths, allowed enums, array limits
7. **Content safety filtering** — input + output, Unicode normalization, leet-speak detection
8. **`subscriptionTier` NOT in localStorage** — correctly excluded from Zustand `partialize`, always fetched from server
9. **Auth-first architecture** — all routes check `getUser()`, proxy redirects unauthenticated users
10. **Abuse scoring** — server-side, automatic throttling at score >= 12
11. **Rate limiting on all endpoints** — separate limits per route
12. **Mock AI properly gated** — requires both `NODE_ENV !== 'production'` AND `ENABLE_MOCK_AI === 'true'`
