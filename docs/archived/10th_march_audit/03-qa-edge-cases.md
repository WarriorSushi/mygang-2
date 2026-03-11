# QA Edge Cases & Race Conditions Review

## Summary

Well-defended for single-tab, happy-path usage. Debounce system, abort controllers, delivery status tracking, and history reconciliation are solid. Key real bugs: cooldown persists after tier upgrade (terrible UX for paying users), in-place message mutation on rehydration defeats memo (delivery status stuck), and retry handler doesn't reset autonomous counters (AI gets stale signals).

---

## Confirmed Bugs

### [HIGH] Tier Change Mid-Session Doesn't Clear Cooldown

**File(s):** `src/app/chat/page.tsx`, `src/components/orchestrator/auth-manager.tsx`

**Scenario:** User hits free tier rate limit, sees cooldown timer. Upgrades to Basic. Webhook fires, `subscriptionTier` updates in store. But `cooldownUntil` persists in sessionStorage independently.

**Issue:** After upgrade, user still sees "Resume in X:XX" and can't send messages for up to 60 minutes, even though their new tier has a separate rate limit bucket.

**Impact:** User who just paid is locked out. Terrible upgrade experience.

**Fix:**
```ts
useEffect(() => {
    setCooldownUntil(0)
    setCooldownLabel(null)
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('mygang-cooldown-until')
    }
}, [subscriptionTier])
```

---

### [MEDIUM] `onRehydrateStorage` Mutates Messages In-Place

**File:** `src/stores/chat-store.ts` (lines 191-205)

**Issue:** On page load, rehydration directly mutates message objects (`m.deliveryStatus = 'failed'`). The spread `[...state.messages]` creates a new array but keeps the same object references. `MessageItem`'s memo comparator checks `prev.message === next.message` — same reference = skip re-render, even though the object was mutated.

**Impact:** Messages stuck in "Sending..." after reload instead of showing "Message interrupted. Please retry." until another re-render trigger.

**Fix:**
```ts
state.messages = state.messages.map(m =>
    m.deliveryStatus === 'sending'
        ? { ...m, deliveryStatus: 'failed', deliveryError: 'Message interrupted. Please retry.' }
        : m
)
```

---

### [MEDIUM] `handleRetryMessage` Doesn't Reset Autonomous Counters

**File:** `src/hooks/use-chat-api.ts` (lines 683-703)

**Issue:** Retry sets delivery status back to `sending` and calls `scheduleDebouncedSend`, but doesn't reset `silentTurnsRef` or `burstCountRef` like `enqueueUserMessage` does. The AI prompt receives stale `silentTurns` count, causing it to "re-engage user directly" when it shouldn't.

**Fix:** Add `silentTurnsRef.current = 0` and `burstCountRef.current = 0` in `handleRetryMessage`.

---

### [MEDIUM] History Bootstrap Empty State Flash

**File(s):** `src/components/chat/message-list.tsx`, `src/hooks/use-chat-history.ts`

**Issue:** Between initial mount and `isBootstrappingHistory` state update, there's one render frame where `messages.length === 0 && !isBootstrappingHistory` is true, briefly flashing the EmptyStateWelcome confetti animation for returning users.

**Fix:** Pass `historyStatus` to MessageList. Only show EmptyStateWelcome when `historyStatus === 'empty'` (confirmed no server history).

---

## Lower Priority Issues

### [LOW] Multi-Tab `_messageIdSet` Drift

**File:** `src/stores/chat-store.ts`

**Issue:** Module-level `Set` is per-JS-context (per-tab). Two tabs can briefly show duplicate messages or miss messages between sync cycles (12-30s).

**Mitigated by:** History reconciliation in `use-chat-history.ts` self-corrects within one sync cycle.

**Fix if needed:** Listen for `storage` event to rebuild Set on cross-tab changes.

---

### [LOW] Input Draft Shared Across Tabs

**File:** `src/components/chat/chat-input.tsx`

**Issue:** Draft saved to `localStorage['mygang-chat-draft']` — shared across tabs. Cross-tab typing creates draft interference.

**Fix:** Use `sessionStorage` instead (drafts are inherently per-tab).

---

### [LOW] `updateUserDeliveryStatus` Race with History Sync

**File:** `src/hooks/use-chat-api.ts` (lines 173-205)

**Issue:** Both `updateUserDeliveryStatus` and `syncLatestHistory` do `getState()` → transform → `setMessages()` without locking. Overlapping async contexts could overwrite each other's results. Self-heals on next sync.

**Fix:** Use Zustand's `set((state) => ...)` for atomic read-modify-write.

---

### [LOW] Orphaned Typing Indicators on Unmount

**File:** `src/hooks/use-chat-api.ts` (lines 444-524)

**Issue:** If component unmounts during AI sequencer, `setTimeout` callbacks continue calling `addMessage` on Zustand store (no crash, but ghost messages). `clearTypingUsers()` in `finally` block runs, but scheduled timeouts are still in the event loop.

**Mitigated by:** Zustand handles stale updates gracefully. History sync on return reconciles.

**Fix if needed:** Add cancellation ref checked before each `addMessage` in sequencer loop.

---

### [LOW] Messages Briefly Flash Back After "Delete All Chat"

**Issue:** `deleteAllMessages` (server) is async. If history sync runs between the server delete starting and completing, cleared messages reappear briefly (~1-2s). The `timeline-cleared` event resets history state, but periodic/focus sync can override it.

**Fix if needed:** Suppress history sync for a few seconds after `clearChat`.

---

## What's Done Well

1. **Delivery status tracking with retry** — `sending` → `sent`/`failed` state machine with "Retry" buttons
2. **600ms debounce with pending interrupt** — rapid typing batches naturally
3. **AbortController for in-flight requests** — new messages abort stale fetches
4. **History reconciliation** — ID + signature matching, timestamp windows, preserved local tails
5. **Autonomous flow guards** — silentTurns cap (10), burst cap (3), total cap (15), backoff timer, visibility check
6. **Chat input safeguards** — 2000-char limit (client + server), 800ms send throttle, IME composition handling
7. **Capacity manager auto-recovery** — smooth low-cost ↔ normal transitions
8. **Scroll position preservation** — adjusts scrollTop on history prepend
