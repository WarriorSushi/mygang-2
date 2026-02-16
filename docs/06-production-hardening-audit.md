# Production Hardening Audit - Round 2
**Date:** 2026-02-16
**Scope:** Full codebase audit across security, performance, code quality, UX, and architecture

---

## Executive Summary

4 parallel audit agents scanned the entire codebase. **0 Critical**, **3 High**, **14 Medium**, **19 Low** issues found. This round focuses on runtime correctness, unhandled errors, accessibility, and production polish.

---

## HIGH SEVERITY (3)

### H1. Unhandled Promise Rejections in Autonomous Chat Flow
**Files:** `src/hooks/use-chat-api.ts:416,425,439`
- `sendToApi()` called recursively without `await` or `.catch()` in autonomous continuation and finally blocks
- **Risk:** Unhandled promise rejections can crash the app in strict mode
- **Fix:** Add `.catch()` to all fire-and-forget sendToApi calls

### H2. `pickRandom` on Empty Array Returns Undefined
**Files:** `src/hooks/use-typing-simulation.ts:8`, `src/hooks/use-autonomous-flow.ts:8`
- `items[Math.floor(Math.random() * items.length)]` returns `undefined` when array is empty
- Called in `triggerLocalGreeting` and typing simulation where empty arrays are possible
- **Fix:** Add empty-array guard

### H3. Stale Closure Over `messages` in Guest Gate
**File:** `src/hooks/use-chat-api.ts:477`
- `enqueueUserMessage` uses closure-captured `messages` instead of `useChatStore.getState().messages`
- Can cause incorrect guest-gate behavior if messages changed between renders
- **Fix:** Use store getter for fresh state

---

## MEDIUM SEVERITY (14)

### M1. Memory Vault Optimistic Update Not Reverted on Failure
**File:** `src/app/auth/actions.ts:253-258` + `src/components/chat/memory-vault.tsx:90`
- `updateMemory` fails silently on embedding error; UI shows success

### M2. Settings Panel `lowCostMode` Not Synced to Zustand
**File:** `src/components/settings/settings-panel.tsx:51`
- `handleLowCostModeToggle` updates server but not the Zustand store; only works after refresh

### M3. `cachedDbPromptBlocks` Never Invalidates
**File:** `src/app/api/chat/route.ts:64`
- Module-level cache with no TTL; admin character prompt changes require redeployment

### M4. No Error State for Memory Vault Load Failure
**File:** `src/components/chat/memory-vault.tsx:33-61`
- Loading spinner stops but no error message shown on fetch failure

### M5. No Feedback for "Save to Memory" from Chat
**File:** `src/components/chat/message-item.tsx:511`
- `saveMemoryManual()` called with zero user feedback

### M6. Missing `role="alert"` on Toast
**File:** `src/components/chat/inline-toast.tsx`
- Not announced to screen readers

### M7. Missing `aria-label` on Memory Vault Buttons
**File:** `src/components/chat/memory-vault.tsx:130,193-206`
- Close, edit, delete icon buttons have no accessible labels

### M8. Deprecated `substr` Usage
**File:** `src/hooks/use-chat-api.ts:367`
- `Math.random().toString(36).substr(2, 9)` should use `.slice(2, 11)`

### M9. `html-to-image` Imported Statically
**File:** `src/app/chat/page.tsx:7`
- `toPng` is a heavy import loaded for every chat page visit, but only used on screenshot

### M10. Unsafe `as unknown as string` Casts for Embeddings
**Files:** `src/lib/ai/memory.ts:87,110`

### M11. In-Memory Rate Limiter Ineffective in Serverless
**File:** `src/lib/rate-limit.ts:10-25`
- Without Redis, rate limiter resets on every cold start

### M12. Module-Level Mutable Cooldown State (Serverless)
**File:** `src/app/api/chat/route.ts:39-44`
- Cooldown timers not shared across serverless instances

### M13. Missing Search Input `aria-label`
**File:** `src/components/chat/memory-vault.tsx:139`

### M14. Unhandled Promise in Autonomous Flow setTimeout
**File:** `src/hooks/use-autonomous-flow.ts:110`

---

## LOW SEVERITY (19)

- L1. Unused `isAllowedActivityStatus` export (`character-greetings.ts:60`)
- L2. Unused `ACTIVITY_STATUS_SET` (`character-greetings.ts:50`)
- L3. Duplicate `pickRandom` in 2 hooks
- L4. Duplicate `hasOpenFloorIntent` client/server
- L5. Duplicate color utils in `message-item.tsx` / `typing-indicator.tsx`
- L6. `console.log` in production client code (`use-chat-api.ts:167,172,347`)
- L7. Mixed server action return styles (some return `{ok,error}`, others return void)
- L8. Inconsistent Supabase client creation patterns
- L9. No loading indicator for memory edit/delete
- L10. Missing `aria-label` on search input
- L11. No keyboard focus trap in message action popup
- L12. `char.name[0]` without empty string guard
- L13. No error state for `historyStatus === 'error'` in chat page
- L14. `deleteAccount` in settings-panel has no redirect fallback
- L15. `isHydrated` may be set prematurely during rapid syncs
- L16. Missing `lang` attribute verification on root html
- L17. No loading state for account deletion in settings panel
- L18. `updateUserSettings` fire-and-forget without error handling
- L19. Excessive `console.error` in chat route (use structured logger)

---

## FIXES APPLIED THIS SESSION

| # | Issue | Fix |
|---|-------|-----|
| 1 | H1 | Added `.catch()` to all unhandled `sendToApi` calls |
| 2 | H2 | Added empty-array guard to `pickRandom` in both hooks |
| 3 | H3 | Used `useChatStore.getState().messages` instead of stale closure |
| 4 | M2 | Synced `lowCostMode` toggle to Zustand store in settings-panel |
| 5 | M5 | (Deferred - requires toast plumbing through message-item) |
| 6 | M6 | Added `role="alert"` to inline toast |
| 7 | M7 | Added `aria-label` to memory vault close/edit/delete buttons |
| 8 | M8 | Replaced `substr` with `slice` |
| 9 | M9 | Dynamic import for `html-to-image` |
| 10 | M13 | Added `aria-label` to memory vault search input |
| 11 | L1+L2 | Removed unused `isAllowedActivityStatus` and `ACTIVITY_STATUS_SET` |
| 12 | L6 | Guarded `console.log` behind NODE_ENV check |
| 13 | L12 | Added fallback for empty `char.name` |
| 14 | M14 | Added `.catch()` to autonomous flow setTimeout |
| 15 | SEC-H | Admin proxy now verifies HMAC signature + expiry (was cookie-exists only) |
| 16 | SEC-M | `updateMemory` now validates content with memoryContentSchema |

---

## NOT FIXED (Documented / Deferred)

| Issue | Reason |
|-------|--------|
| M1 (memory vault optimistic revert) | Requires server action return refactor |
| M3 (cached DB prompt blocks TTL) | Requires cache strategy discussion |
| M10 (embedding casts) | Supabase type mismatch - cosmetic |
| M11 (in-memory rate limiter) | By design when Redis unavailable |
| M12 (module cooldowns) | Acceptable degradation in serverless |
| L3-L5 (code duplication) | Refactor candidate for future sprint |
| L7 (mixed return styles) | Consistency improvement, non-breaking |
