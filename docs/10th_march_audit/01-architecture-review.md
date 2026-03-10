# Architecture Review — Principal Software Architect

## Summary

Well-structured Next.js app with mature patterns (idempotent webhooks, tiered rate limiting, hybrid memory retrieval, layered auth guards). Primary architectural debt is the chat API route — a 1600+ line monolith fusing 10+ responsibilities into one function. The client-side hook architecture uses mutable ref bridges between hooks, creating fragile implicit contracts. Several helper functions are duplicated across server/client boundaries with diverging logic.

---

## Findings

### [REFACTORING] Chat API Route is a God File (1600+ lines)

**File:** `src/app/api/chat/route.ts`

**Issue:** Single POST handler with 10+ responsibilities: validation, auth, rate limiting, billing, safety filtering, abuse scoring, profile loading, memory retrieval, LLM prompt construction, LLM call, response sanitization, responder limiting, metrics, and fire-and-forget persistence. ~35 module-level constants and ~15 helper functions trapped inside.

**Impact:** Any change to billing, safety, prompt engineering, or formatting touches this one file. Individual behaviors can't be unit-tested in isolation.

**Recommendation:** Extract when convenient:
- `src/lib/chat/safety.ts` — content filtering, abuse scoring
- `src/lib/chat/message-formatting.ts` — split/normalize/trim helpers
- `src/lib/chat/prompt-builder.ts` — system prompt construction
- `src/lib/chat/response-sanitizer.ts` — event sanitization, responder filtering
- `src/lib/chat/intent-detection.ts` — greeting/farewell/open-floor detection
- `src/lib/chat/constants.ts` — tier configs, limits

**Not a bug.** Design debt that increases refactor risk over time.

---

### [REFACTORING] Ref-Bridge Coupling Between Client Hooks

**File(s):** `src/hooks/use-chat-api.ts`, `src/hooks/use-autonomous-flow.ts`

**Issue:** `useChatApi` exports 12+ refs patched externally by the parent component after `useAutonomousFlow` initializes. Manual dependency injection via mutable refs with no TypeScript enforcement. If wiring order changes, system silently fails (refs default to no-op).

**Impact:** Hooks can't be tested in isolation. Fragile during refactors.

**Recommendation:** Consolidate into `useChatOrchestrator` or move shared state into Zustand. Not urgent — current wiring works correctly.

**Not a bug.** Architectural coupling that makes future changes harder.

---

### [MEDIUM] Duplicated `hasOpenFloorIntent` Function

**File(s):** `src/app/api/chat/route.ts` (lines 318-324), `src/hooks/use-autonomous-flow.ts` (lines 13-19)

**Issue:** Identical function on both server and client. If one is updated without the other, server/client disagree on whether to trigger autonomous continuation.

**Recommendation:** Move to `src/lib/chat-utils.ts`.

---

### [MEDIUM] Duplicated `toLegacyHistoryRows` Function

**File(s):** `src/app/api/chat/route.ts`, `src/app/api/chat/rendered/route.ts`

**Issue:** Both routes have identical functions stripping metadata columns. If one is updated, the other silently drifts.

**Recommendation:** Move to `src/lib/chat-utils.ts`.

---

### [MEDIUM] `isFarewellMessage` / `isFarewellLikeMessage` Near-Duplicate with Diverging Regex

**File(s):** `src/app/api/chat/route.ts` (line 414), `src/hooks/use-chat-api.ts` (line 65)

**Issue:** Server and client have similar but NOT identical farewell regexes. Client includes "goodbye", "see ya", "gotta go" which server doesn't. Client is case-insensitive, server anchors to start-of-string. They will disagree on farewell detection, affecting response length caps (server) and idle follow-up scheduling (client).

**Recommendation:** Consolidate into a single `isFarewellMessage` in `src/lib/chat-utils.ts`.

---

### [LOW] Inconsistent API Response Shapes

**File(s):** All API routes under `src/app/api/`

**Issue:** At least 3 different response conventions: chat route returns events (even for errors), analytics returns `{ ok }`, checkout returns `{ error }` / `{ checkout_url }`, activate uses custom `jsonResponse`. No shared envelope.

**Impact:** Client error handling is custom per route. Chat route's event-based errors are intentional (AI characters explain the error) but other routes have no consistency.

**Recommendation:** Standardize non-chat routes to `{ ok, data?, error? }`. Low priority.

---

### [LOW] Module-Level Singleton in Webhook Route

**File:** `src/app/api/webhook/dodo-payments/route.ts` (line 6)

**Issue:** `createAdminClient()` called at module scope, unlike every other route. Already a singleton internally so no behavioral impact, but inconsistent pattern.

**Recommendation:** Move inside handler functions for consistency. Better addressed by env validation (SRE H4).

---

### [LOW] Duplicated Helpers

Small duplications that should be consolidated when touching related code:
- `pickRandom<T>` — duplicated in `use-autonomous-flow.ts` and `use-typing-simulation.ts` → move to `src/lib/utils.ts`
- `ChatHistoryInsertRow` type — duplicated in chat route and rendered route → move to `src/lib/chat-utils.ts`
- `updatePurchaseCelebration` legacy fallback — duplicated in webhook and activate routes → extract to `src/lib/billing-server.ts`

---

### [LOW] Stale `cooldownSeconds` in Zustand Store

**File:** `src/stores/chat-store.ts`

**Issue:** `cooldownSeconds` and `setCooldownSeconds` declared but never written by any code. Dead state field from earlier design.

**Recommendation:** Remove if confirmed unused.

---

## What's Done Well

1. **Idempotent webhook handling** — DB unique constraints, no TOCTOU races, orphaned event tracking
2. **Tiered rate limiting** — 3 layers: global burst, tier-specific window, fail-closed without Redis
3. **Fire-and-forget with `waitUntil`** — correct serverless pattern for post-response persistence
4. **Zod validation on every API route** — consistent, thorough input validation
5. **Three-layer auth guards** — proxy + API route + server action defense-in-depth
6. **Zustand store design** — clean separation of persisted vs transient state, `subscriptionTier` correctly excluded from `partialize` (not persisted to localStorage)
7. **Chat history reconciliation** — sophisticated merge with ID + signature matching, adaptive polling
8. **Memory system** — hybrid retrieval with embedding similarity + recency, category-aware compaction with optimistic locking
9. **Billing state machine** — proper lifecycle: active → cancelled_pending → expired
10. **Safety layering** — input + output filtering, abuse scoring, Unicode normalization
