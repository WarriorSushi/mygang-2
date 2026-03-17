# Code Quality & Architecture Audit

**Date:** 2026-03-17
**Scope:** `src/` directory — components, hooks, stores, lib, app

---

## 1. Dead Code & Unused Exports

### 1.1 `normalizeSource` exported but never imported
- **Category:** dead-code
- **Severity:** low
- **File:** `src/hooks/use-chat-history.ts:11`
- **Detail:** `export function normalizeSource()` is exported but never imported anywhere. Only used internally in the same file (via `messageSignature`). Remove `export` keyword.

### 1.2 `collapseLikelyDuplicateMessages` — exported but only used internally
- **Category:** dead-code
- **Severity:** low
- **File:** `src/hooks/use-chat-history.ts:103`
- **Detail:** Exported but only consumed within the same file. No external imports found. The `export` was likely added for testing but no tests import it.

### 1.3 `isLiveChatMessage` and `getPayloadWindowLimit` — exported but never imported
- **Category:** dead-code
- **Severity:** low
- **File:** `src/hooks/use-chat-api.ts:11,15`
- **Detail:** Both functions are exported but only used within the same file. No external consumers.

### 1.4 `countUnseenMessages` and `buildPresenceTitle` — exported but only used internally
- **Category:** dead-code
- **Severity:** low
- **File:** `src/hooks/use-tab-presence.ts:10,29`
- **Detail:** Exported "for testing" (per comments) but no test files import them. Consider inlining or keeping export only if tests exist.

### 1.5 `getTierUsageHeading` and `getTierMessagesLabel` — never imported
- **Category:** dead-code
- **Severity:** low
- **File:** `src/lib/billing.ts:85,89`
- **Detail:** These two exported functions are not imported anywhere in the codebase. Dead wrapper functions.

### 1.6 `getOperationalErrorCode` — only used internally
- **Category:** dead-code
- **Severity:** low
- **File:** `src/lib/operational-telemetry.ts:10`
- **Detail:** Exported but only referenced within the same module (by `isSquadTierWriteError` and `getOperationalErrorMetadata`).

### 1.7 `TokenUsage` type duplicated and exported but never imported
- **Category:** dead-code / duplication
- **Severity:** medium
- **Files:** `src/components/chat/chat-header.tsx:13-18` and `src/hooks/use-chat-api.ts:30-35`
- **Detail:** `TokenUsage` is defined identically in both files. The one in `chat-header.tsx` is exported but never imported by anyone. Should be defined once in a shared location (e.g. `src/types/` or `src/lib/billing.ts`).

### 1.8 Dev preview pages — should be excluded from production
- **Category:** dead-code
- **Severity:** low
- **Files:** `src/app/dev/avatar-gift-preview/`, `src/app/dev/avatar-style-preview/`, `src/app/dev/vibe-quiz-preview/`
- **Detail:** These are development-only preview pages. They'll be included in the production bundle. Consider gating behind `NODE_ENV === 'development'` or using a build-time exclusion.

---

## 2. Type Safety

### 2.1 `any` types in memory module (5 instances, eslint-disabled)
- **Category:** type-safety
- **Severity:** high
- **File:** `src/lib/ai/memory.ts:125,296,655,700,778`
- **Detail:** Multiple `any` types with `eslint-disable` comments for Supabase insert data objects and the `supabase` parameter of `touchMemories`. These bypass strict mode and mask potential shape mismatches. Use proper Supabase-generated types from `database.types.ts` or define insert types.
- **Recommendation:** Define typed insert interfaces matching the DB schema. For `touchMemories` line 778, type the parameter as `SupabaseClient` instead of `{ from: (...args: any[]) => any }`.

### 2.2 `any` in admin overview page (6+ instances)
- **Category:** type-safety
- **Severity:** medium
- **File:** `src/app/admin/(protected)/overview/page.tsx:84,114,133,134,347,367`
- **Detail:** Multiple `any` casts for Supabase query results. These admin pages query raw data and cast entire result sets as `any[]`.
- **Recommendation:** Define lightweight row types for admin queries.

### 2.3 `any` in client-journey
- **Category:** type-safety
- **Severity:** medium
- **File:** `src/lib/supabase/client-journey.ts:87`
- **Detail:** `Record<string, any>` for profile update object. Should use a typed profile update shape.

### 2.4 `ComponentType<any>` for Lottie
- **Category:** type-safety
- **Severity:** low
- **File:** `src/components/chat/message-list.tsx:51,57`
- **Detail:** Lottie component typed as `ComponentType<any>`. Acceptable for a dynamically imported third-party lib, but could use `ComponentType<{ animationData: object; loop: boolean; autoplay: boolean; style?: React.CSSProperties }>`.

### 2.5 `_redisInstance` typed as `unknown` with later cast
- **Category:** type-safety
- **Severity:** low
- **File:** `src/lib/rate-limit.ts:38`
- **Detail:** `_redisInstance` is `unknown`, then cast to `InstanceType<typeof Redis>` at usage. This is intentional for lazy-load but the cast could be wrong if `Redis.fromEnv()` signature changes.

### 2.6 Missing `src/types/` directory
- **Category:** type-safety
- **Severity:** medium
- **Detail:** No `src/types/` directory exists. Shared types like `TokenUsage`, `ChatEvent`, `SubscriptionTier`, `Character`, `Message` are scattered across stores, hooks, and components. A centralized types module would improve discoverability and reduce duplication.

---

## 3. Code Duplication

### 3.1 `pickRandom<T>` duplicated in two hooks
- **Category:** duplication
- **Severity:** medium
- **Files:** `src/hooks/use-typing-simulation.ts:7-10` and `src/hooks/use-autonomous-flow.ts:10-13`
- **Detail:** Identical generic `pickRandom` function defined in both files. Extract to `src/lib/utils.ts`.

### 3.2 `normalizeSource` / `normalizeMessageSource` duplicated
- **Category:** duplication
- **Severity:** medium
- **Files:** `src/hooks/use-chat-history.ts:11` and `src/components/chat/message-list.tsx:141`
- **Detail:** Same logic (`return source || 'chat'`) with different names. Extract to `src/lib/chat-utils.ts`.

### 3.3 `truncateText` / `truncatePreviewText` — near-identical
- **Category:** duplication
- **Severity:** low
- **Files:** `src/components/chat/message-item.tsx:165` and `src/components/chat/chat-header.tsx:39`
- **Detail:** Both normalize whitespace and truncate with ellipsis. `truncatePreviewText` additionally handles `undefined` input and uses `...` instead of `…`. Merge into one utility.

### 3.4 Avatar lightbox duplicated in MessageItem and ChatHeader
- **Category:** duplication
- **Severity:** medium
- **Files:** `src/components/chat/message-item.tsx:478-523` and `src/components/chat/chat-header.tsx:525-573`
- **Detail:** Both components implement a nearly identical avatar lightbox portal with focus trap, escape-to-close, and a close button. Extract into a shared `<AvatarLightbox>` component.

### 3.5 Downgrade auto-removable ID fetch duplicated in AuthManager
- **Category:** duplication
- **Severity:** low
- **File:** `src/components/orchestrator/auth-manager.tsx:254-266` and `280-290`
- **Detail:** The same `squad_tier_members` query to fetch auto-removable IDs is written twice (for tier transition vs. webhook flag). Extract to a helper.

---

## 4. Inconsistent Patterns

### 4.1 `error.tsx` vs `global-error.tsx` naming conflict
- **Category:** inconsistency
- **Severity:** low
- **Files:** `src/app/error.tsx` and `src/app/global-error.tsx`
- **Detail:** Both are exported as `default function GlobalError` but `error.tsx` uses Tailwind classes while `global-error.tsx` uses inline styles (correct, since it can't rely on CSS loading). The function name in `error.tsx` should be `Error` or `RootError` to distinguish.

### 4.2 Inconsistent import style for `Message` type
- **Category:** inconsistency
- **Severity:** low
- **Files:** `src/hooks/use-chat-history.ts:4` uses value import (`import { ... Message }`), others use `import type { Message }` or mixed.
- **Detail:** `use-chat-history.ts` imports `Message` as a value (not `import type`), which is fine but inconsistent with files like `use-tab-presence.ts:4` that use `import type`.

### 4.3 Store selectors — mixed patterns
- **Category:** inconsistency
- **Severity:** medium
- **Detail:** Some components use `useShallow` for multi-field selects (e.g., `chat/page.tsx`), while others use multiple individual `useChatStore((s) => s.field)` calls (e.g., `auth-manager.tsx` with 10+ individual selectors). The latter causes more re-renders. The `auth-manager` pattern is acceptable since it renders `null`, but `chat-header.tsx` also uses individual selectors for `newMemoryCount`, `totalMemoryCount`, `showUpgradeTour` when these could be batched.

### 4.4 `'use client'` on utility files that don't need it
- **Category:** inconsistency
- **Severity:** low
- **Files:** `src/lib/analytics.ts:1`, `src/lib/operational-telemetry.ts:1`
- **Detail:** These are pure utility modules with no React hooks or browser APIs used at module level. The `'use client'` directive is technically harmless but misleading. `analytics.ts` does check `typeof window` internally, so it handles SSR — the directive isn't needed.

---

## 5. Architecture

### 5.1 Monolithic chat store — 30+ fields, 25+ setters
- **Category:** architecture
- **Severity:** high
- **File:** `src/stores/chat-store.ts`
- **Detail:** The `ChatState` interface has 30+ fields and 25+ setter actions in a single flat store. This means any state change (even `cooldownSeconds`) triggers re-evaluation of every subscriber's selector. Consider splitting into domain slices:
  - `useChatStore` — messages, typing
  - `useUserStore` — userId, userName, userNickname, subscriptionTier
  - `useUIStore` — chatWallpaper, showPersonaRoles, showUpgradeTour, chatMode
  - `useBillingStore` — messagesRemaining, cooldownSeconds, pendingUpgrade/Downgrade
- **Impact:** Performance improvement via reduced selector evaluations and better code organization.

### 5.2 ChatPage component — 650 lines, 15+ useState, 6 custom hooks
- **Category:** architecture
- **Severity:** high
- **File:** `src/app/chat/page.tsx`
- **Detail:** This is the largest client component and orchestrates everything: hooks wiring, ref patching, purchase celebrations, cooldown timers, screenshot capture, online/offline, resume banners, analytics, and rendering. The ref-patching pattern between `useChatApi` and `useAutonomousFlow` (lines 197-199) is fragile.
- **Recommendation:** Extract screenshot logic, cooldown timer, purchase celebration, and resume banner into separate hooks or components.

### 5.3 `useChatApi` returns too many refs (20+ items)
- **Category:** architecture
- **Severity:** medium
- **File:** `src/hooks/use-chat-api.ts`
- **Detail:** The hook returns 20+ items including refs that are then patched by the consuming component. This creates tight coupling and makes the hook's contract hard to understand. The "bridge ref" pattern (lines 178-183) where refs are created in one hook and `.current` is assigned externally is a code smell.

### 5.4 No error boundary on settings panel or memory vault
- **Category:** architecture
- **Severity:** medium
- **File:** `src/app/chat/page.tsx:565-574`
- **Detail:** `ErrorBoundary` wraps only `MessageList`. If `MemoryVault` or `ChatSettings` throw, the entire page crashes. These should also be wrapped.

### 5.5 `window` global mutation for cooldown notification timer
- **Category:** architecture
- **Severity:** medium
- **File:** `src/hooks/use-chat-api.ts:379-388`
- **Detail:** Stores a timer reference on `(window as unknown as Record<string, unknown>).__mygangCooldownNotif`. This is a brittle global mutation pattern. Use a module-level variable or a ref instead.

### 5.6 `lowCostMode` still persisted but settings UI was removed
- **Category:** architecture
- **Severity:** low
- **File:** `src/stores/chat-store.ts:47,106,171,198-199`
- **Detail:** Per MEMORY.md, the "redundant Low-Cost Mode" was removed from the settings panel. But `lowCostMode` is still in the store, still persisted to localStorage, and still used in logic paths. If it can only be set via auto-capacity-manager now, it may be vestigial state that can be simplified.

---

## 6. Summary

| Category | Critical | High | Medium | Low |
|---|---|---|---|---|
| Dead code | 0 | 0 | 1 | 7 |
| Type safety | 0 | 1 | 3 | 2 |
| Duplication | 0 | 0 | 3 | 2 |
| Inconsistency | 0 | 0 | 1 | 3 |
| Architecture | 0 | 2 | 3 | 1 |
| **Total** | **0** | **3** | **11** | **15** |

### Priority Recommendations (High)

1. **Split the monolithic chat store** into 3-4 domain slices — biggest win for maintainability and performance.
2. **Break up ChatPage** — extract screenshot, cooldown, celebration, resume banner into hooks/components.
3. **Type the `any` casts in `memory.ts`** — these are server-side data inserts and the most likely source of runtime bugs from schema drift.

### Quick Wins (can fix in one pass)
- Extract `pickRandom` to `src/lib/utils.ts`
- Extract `normalizeSource` to `src/lib/chat-utils.ts`
- Extract shared `AvatarLightbox` component
- Remove 5 unused exports from billing/history/telemetry
- Add `ErrorBoundary` around `MemoryVault` and `ChatSettings`
- Create `src/types/shared.ts` for `TokenUsage` and other duplicated types
