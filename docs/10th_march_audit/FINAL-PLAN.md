# 10th March 2026 — Final Audit Plan (Revised)

Revised after Codex review. Disproven findings removed, severities corrected, counts updated.

## Audit Team

| # | Role | Report |
|---|------|--------|
| 1 | Principal Software Architect | `01-architecture-review.md` |
| 2 | Senior SRE / DevOps Engineer | `02-sre-production-readiness.md` |
| 3 | Senior QA Engineer | `03-qa-edge-cases.md` |
| 4 | Senior Frontend Performance Engineer | `04-frontend-performance.md` |
| 5 | Senior Data Engineer | `05-data-engineering.md` |
| 6 | Senior Product Strategist | `06-product-flows.md` |
| 7 | Senior Fullstack Security Reviewer | `07-business-logic-security.md` |

## Overall Assessment

The codebase is **production-ready with targeted fixes needed**. Previous audits hardened security, legal, RLS, and UX thoroughly. This fresh audit found **1 critical bug, 5 high-priority issues, ~12 medium items, and ~12 low items**. The critical bug (dispute handler) must be fixed immediately. High items are real bugs or security gaps affecting users today.

---

## CRITICAL — Fix Immediately

### C1. Dispute Handler Downgrades Wrong User
- **Source:** Security + Data Engineering (independently confirmed)
- **File:** `src/app/api/webhook/dodo-payments/route.ts` lines 394-416
- **Bug:** `onDisputeOpened` queries for ANY `payment.succeeded` event — no filter on disputed payment/customer. Grabs first row and downgrades that user.
- **Fix:** Extract `customer_id` / `payment_id` from dispute payload. Use `findUserByCustomerId` + email fallback. If no match, log as orphaned and do NOT downgrade.
- **Risk:** Paying users lose subscription due to someone else's dispute.

---

## HIGH — Fix Before Launch

### H1. Squad Size Not Enforced Server-Side
- **Source:** Security Review
- **File:** `src/app/api/chat/route.ts` lines 648-661
- **Bug:** Free users can send 6 character IDs via API. No tier-based truncation after auth.
- **Fix:** `filteredIds = filteredIds.slice(0, getSquadLimit(tier))`

### H2. Fake Purchase Celebrations via Client Parameter
- **Source:** Security Review
- **File:** `src/app/api/chat/route.ts` lines 530, 1025-1031
- **Bug:** `purchaseCelebration` trusted from client. Any user can inject celebration prompts.
- **Fix:** Remove from client schema. Read `purchase_celebration_pending` from profile DB row.

### H3. No LLM Timeout
- **Source:** SRE Review
- **File:** `src/app/api/chat/route.ts` line 1132
- **Bug:** No timeout on `generateObject()`. Slow provider burns 40+ seconds per request.
- **Fix:** `AbortController` with 25s timeout passed as `abortSignal`.

### H4. No Env Var Validation at Startup
- **Source:** SRE Review
- **Files:** All — includes webhook, checkout, customer-portal, proxy module-level env access
- **Bug:** Missing env vars pass build, crash on first request.
- **Fix:** Create `src/lib/env.ts` with Zod schema for all required vars.

### H5. Tier Change Doesn't Clear Cooldown
- **Source:** QA Review
- **File:** `src/app/chat/page.tsx`
- **Bug:** Upgraded user stays locked by old cooldown timer for up to 60 minutes.
- **Fix:** `useEffect` watching `subscriptionTier` that clears cooldown state + sessionStorage.

---

## MEDIUM — Fix Soon

### M1. Relationship State Race Condition
- **Source:** Data Engineering
- **Bug:** `increment_profile_counters` does full JSON replace. Concurrent calls clobber each other.
- **Fix:** Use `jsonb_set` or `||` merge in the RPC.

### M2. Module-Level Clients in Webhook + Customer Portal
- **Source:** SRE + Architecture
- **Fix:** Move `createAdminClient()` and `new DodoPayments()` inside handler functions.

### M3. Unstructured Logging
- **Source:** SRE Review
- **Fix:** Create `src/lib/logger.ts`. Replace key sites. Include stack traces.

### M4. handleRetryMessage Missing Counter Resets
- **Source:** QA Review
- **Fix:** Reset `silentTurnsRef` and `burstCountRef` in retry handler.

### M5. onRehydrateStorage In-Place Mutation
- **Source:** QA Review
- **Fix:** Use `messages.map(m => ...)` to create new objects instead of mutating.

### M6. History Bootstrap Empty State Flash
- **Source:** QA Review
- **Fix:** Pass `historyStatus` to MessageList. Show welcome only when confirmed empty.

### M7. Subscriptions No Unique Constraint
- **Source:** Data Engineering
- **Fix:** Partial unique index on `(user_id) WHERE status IN ('active', 'cancelled_pending')`.

### M8. daily_msg_count Vestigial Counter
- **Source:** Data Engineering
- **Fix:** Remove from `increment_profile_counters` RPC and chat route profile SELECT.

### M9. persistUserJourney Non-Atomic
- **Source:** Data Engineering
- **Fix:** Use upsert-then-delete-stale pattern (same as `saveGang`).

### M10. Chat API Leaks Internal Metadata
- **Source:** Security Review
- **Fix:** Remove `usage.provider`, `usage.promptChars`, `usage.historyCount` from responses.

### M11. No Squad Management for Paid Users
- **Source:** Product Review
- **Fix:** Add squad management UI in chat-settings or settings page.

### M12. Pricing Not Linked From Landing Page
- **Source:** Product Review
- **Fix:** Add "Pricing" to landing page nav/footer.

---

## LOW — Nice to Have

| # | Item | Source |
|---|------|--------|
| L1 | Consolidate duplicated functions (hasOpenFloorIntent, toLegacyHistoryRows, isFarewellMessage, pickRandom, ChatHistoryInsertRow, updatePurchaseCelebration) | Architecture |
| L2 | Multi-tab _messageIdSet drift | QA |
| L3 | Input draft uses localStorage (should be sessionStorage) | QA |
| L4 | updateUserDeliveryStatus race with history sync | QA |
| L5 | Orphaned typing indicators on unmount | QA |
| L6 | Webhook/chat body size not checked before processing | SRE |
| L7 | In-memory caches no size bounds | SRE |
| L8 | No health check endpoint | SRE |
| L9 | Embedding failure silent (no degradation signal) | SRE |
| L10 | Onboarding max squad hardcoded to 4 | Product |
| L11 | Free users see "Memory active" misleadingly | Product |
| L12 | Email signup confirmation leaves user in limbo | Product |
| L13 | Settings path from chat buried | Product |
| L14 | Activation endpoint leaks subscription status via distinct errors | Security |
| L15 | Prompt injection surface via userName/characterNames (own-session only) | Security |
| L16 | Remove dead `cooldownSeconds` from Zustand store | Architecture |

---

## Refactoring (Not Bugs — When Convenient)

| # | Item | Source |
|---|------|--------|
| R1 | Split chat API god file (~1600 lines) into focused modules | Architecture |
| R2 | Consolidate hook ref-bridge pattern | Architecture |
| R3 | ChatPage messages subscription → MessageListConnected wrapper | Frontend Perf |
| R4 | Stabilize sendToApi with useCallback + refs | Frontend Perf |
| R5 | Self-contained useTypingSimulation cleanup | Frontend Perf |
| R6 | analytics_events retention policy (pg_cron 30-day delete) | Data Engineering |
| R7 | chat_history partitioning at scale | Data Engineering |
| R8 | Memory compaction timestamp-based auto-recovery | Data Engineering |

---

## Implementation Priority

**Phase 1 — Must fix (blocks launch):**
C1, H1, H2, H3, H5

**Phase 2 — Should fix (first week):**
H4, M1, M2, M4, M5, M7, M10

**Phase 3 — Nice to have (first month):**
M3, M6, M8, M9, M11, M12, L1-L16

**Phase 4 — Ongoing (when touching related code):**
R1-R8

---

## What's Done Well (Cross-Audit Consensus)

All 7 specialists independently praised:
1. **Idempotent webhook processing** — DB unique constraints, no TOCTOU
2. **Fail-closed rate limiting** — Redis down = deny, not allow
3. **Server-side tier enforcement** — client can't bypass via state manipulation
4. **subscriptionTier NOT in localStorage** — excluded from Zustand persist
5. **Three-layer auth guards** — proxy + API route + server action
6. **Fire-and-forget persistence** — `waitUntil` pattern
7. **Memory compaction with optimistic locking** — claim/release pattern
8. **Zod validation on all inputs** — consistent, thorough
9. **Comprehensive security headers** — CSP, HSTS, Permissions-Policy
10. **Chat history reconciliation** — ID + signature matching, adaptive polling
11. **Paywall UX** — progress bar, activities, ghost memories conversion hook
