# Code Quality & Architecture Audit v2

**Date:** 2026-03-18
**Scope:** `src/` directory -- components, hooks, stores, lib, app
**Previous audit:** `docs/audit-code-quality.md` (2026-03-17)

---

## Improvements Since v1

1. **`normalizeSource` extracted to `src/lib/utils.ts`** -- was only in `use-chat-history.ts`, now properly shared. (v1 item 1.1 -- fixed)
2. **`getTierUsageHeading` / `getTierMessagesLabel` unexported** -- no longer exported, but still dead (see 1.1 below). (v1 item 1.5 -- partially fixed)
3. **Error boundaries added** to about, chat, checkout/success, onboarding, pricing, privacy, settings, terms. Good coverage improvement.
4. **`types/shared.ts` created** -- `TokenUsage` properly typed and used across chat-header, use-chat-api, chat route.
5. **Store uses `useShallow`** in the highest-frequency components (chat page, chat-settings, messages-remaining-banner, autonomous-flow).
6. **Dev pages properly guarded** -- `src/app/dev/layout.tsx` returns `notFound()` in production.

---

## 1. Dead Code

### 1.1 `getTierUsageHeading` and `getTierMessagesLabel` -- never called
- **File:** `src/lib/billing.ts:85,89`
- **Severity:** low
- **Detail:** Defined as private functions but never called anywhere in the codebase. Safe to delete.

### 1.2 `collapseLikelyDuplicateMessages` -- exported but only used internally
- **File:** `src/hooks/use-chat-history.ts:101`
- **Severity:** low
- **Detail:** Still exported, only consumed within the same file. Remove `export` keyword.

### 1.3 `isLiveChatMessage` and `getPayloadWindowLimit` -- exported but only used internally
- **File:** `src/hooks/use-chat-api.ts:12,16`
- **Severity:** low
- **Detail:** Still exported, only consumed within the same file. Remove `export` keyword unless tests import them.

### 1.4 `countUnseenMessages` and `buildPresenceTitle` -- exported but only used internally
- **File:** `src/hooks/use-tab-presence.ts:10,29`
- **Severity:** low
- **Detail:** Same as v1. Only internal usage.

### 1.5 `normalizeSource` re-exported from `use-chat-history.ts`
- **File:** `src/hooks/use-chat-history.ts:9`
- **Severity:** low
- **Detail:** `export { normalizeSource }` re-exports from utils, but no file imports `normalizeSource` from `use-chat-history`. The only consumer (`message-list.tsx`) imports directly from `@/lib/utils`. Remove the re-export.

### 1.6 Empty dev preview directories
- **Directories:** `src/app/dev/chat-header-preview/`, `src/app/dev/squad-reconcile-preview/`
- **Severity:** low
- **Detail:** Directories exist but contain no `page.tsx`. Either orphans from deleted previews or incomplete. Delete both.

---

## 2. TypeScript Strict Mode

### 2.1 `any` types in admin overview
- **File:** `src/app/admin/(protected)/overview/page.tsx:84,114,133,134,347,367`
- **Severity:** medium
- **Detail:** 5 uses of `row: any` and 1 `as any[]`. This is the admin dashboard querying Supabase RPC results. Define a `ChatRouteMetricRow` and `AuditRow` interface to type the query results instead of casting.

### 2.2 `as any[]` cast for Supabase query results
- **File:** `src/app/admin/(protected)/overview/page.tsx:84`
- **Severity:** medium
- **Detail:** `]) as any[]` -- cast result of parallel Supabase queries. Type the promise results explicitly.

### 2.3 `e as BeforeInstallPromptEvent` in PWA install prompt
- **File:** `src/components/ui/pwa-install-prompt.tsx:23`
- **Severity:** low
- **Detail:** `setDeferredPrompt(e as BeforeInstallPromptEvent)` -- unavoidable since the browser event is not typed in lib.dom. The custom `BeforeInstallPromptEvent` interface is correctly defined. Acceptable.

**Summary:** `any` usage is confined to admin pages only. Production code is clean.

---

## 3. Error Boundaries

### Coverage Map

| Route | `error.tsx` | Notes |
|-------|:-----------:|-------|
| `/` (root) | yes | `src/app/error.tsx` |
| `global-error` | yes | With Sentry integration |
| `/about` | yes | |
| `/chat` | yes | + inline `ErrorBoundary` wrapping message-list, chat-input, settings |
| `/checkout/success` | yes | |
| `/onboarding` | yes | |
| `/pricing` | yes | |
| `/privacy` | yes | |
| `/settings` | yes | |
| `/terms` | yes | |
| `/admin` | **NO** | Missing |
| `/admin/login` | **NO** | Missing |
| `/post-auth` | **NO** | Missing -- critical auth flow |
| `/refund` | **NO** | Missing |
| `/status` | **NO** | Missing |

### 3.1 Missing error boundaries -- 5 routes
- **Severity:** medium (post-auth is critical path)
- **Detail:** `/post-auth` handles auth hydration after login. An unhandled error there with no error boundary will show the root error page, losing auth context. Add `error.tsx` to at minimum `/post-auth`.

### 3.2 Error boundary duplication
- **Severity:** low
- **Detail:** 6 route `error.tsx` files share nearly identical "Something went wrong" + Try again UI with minor variations (h1 vs h2, different wording). Consider extracting a shared `GenericRouteError` component to reduce boilerplate.

---

## 4. Inconsistent Patterns

### 4.1 `SubscriptionTier` type inlined in 7 places instead of importing
- **Files:** `src/stores/chat-store.ts:42,65`, `src/components/chat/chat-header.tsx:24`, `src/components/chat/memory-vault.tsx:21`, `src/app/pricing/page.tsx:26`, `src/lib/supabase/client-journey.ts:18`, `src/app/admin/actions.ts:35`
- **Severity:** medium
- **Detail:** `'free' | 'basic' | 'pro'` is duplicated as inline union types. The canonical `SubscriptionTier` type exists in `src/lib/billing.ts`. All these should import and use it. If a tier value changes, 7 files need updating.

### 4.2 Relative imports in 2 files
- **Files:** `src/app/status/page.tsx:1`, `src/components/ui/lottie-loader.tsx:4`
- **Severity:** low
- **Detail:** Use `../../../` relative paths instead of `@/` alias. Inconsistent with the rest of the codebase. The status page imports `package.json` and lottie-loader imports a public JSON file -- both are outside `src/`, so `@/` alias may not reach them. Acceptable but worth noting.

### 4.3 Store selector style inconsistency
- **Severity:** low
- **Detail:** `src/app/onboarding/page.tsx` uses 9 individual `useChatStore((s) => s.xxx)` selectors instead of a single `useShallow` object selector. This causes 9 subscriptions instead of 1. Not a bug but inconsistent with chat page pattern.

---

## 5. State Management

### 5.1 Store bloat -- 25+ fields in single flat store
- **File:** `src/stores/chat-store.ts`
- **Severity:** low
- **Detail:** `ChatState` has 25 state fields + 23 setters in a single flat store. The store mixes concerns: messages, user identity, billing, UI preferences, squad conflicts, memory counts, upgrade tours. Consider splitting into slices (e.g., `userSlice`, `chatSlice`, `billingSlice`, `uiSlice`) using zustand's slice pattern for better maintainability. Not urgent since `useShallow` prevents unnecessary re-renders.

### 5.2 `characterStatuses` not persisted but `lowCostMode` is
- **Severity:** info
- **Detail:** `characterStatuses` is ephemeral (correct -- activity statuses are transient). `lowCostMode` is persisted (correct -- user preference). Both choices are intentional and correct.

### 5.3 `subscriptionTier` not persisted
- **Severity:** info
- **Detail:** `subscriptionTier` is excluded from `partialize`, meaning it resets to `'free'` on page load until `AuthManager` re-hydrates it. This is correct -- server is source of truth, avoids stale tier display.

---

## 6. Code Duplication

### 6.1 Error boundary boilerplate (6 near-identical files)
- **Files:** `about/error.tsx`, `pricing/error.tsx`, `privacy/error.tsx`, `settings/error.tsx`, `terms/error.tsx`, `checkout/success/error.tsx`
- **Severity:** low
- **Detail:** All follow the same pattern: centered div, "Something went wrong", try again button. Only the function name and small wording differences. Extract a `RouteErrorFallback` component and re-export from each file.

### 6.2 No other significant duplication detected
- **Detail:** The M4-M6 extractions were effective. `normalizeSource`, `sanitizeMessageId`, `pickRandom`, `truncateText` are all properly centralized in `src/lib/utils.ts` and `src/lib/chat-utils.ts`.

---

## 7. New Code Quality

### 7.1 `src/types/shared.ts` -- good but minimal
- **Severity:** info
- **Detail:** Contains only `TokenUsage`. Well-typed and properly used. As more cross-cutting types emerge, this is the right home for them. The `SubscriptionTier` type from billing.ts could also live here or be re-exported.

### 7.2 `src/components/chat/avatar-lightbox.tsx` -- well implemented
- **Severity:** info
- **Detail:** Proper focus trap, Escape key handling, focus restoration via `triggerRef`, portal rendering, accessibility attributes (`role="dialog"`, `aria-modal`, `aria-label`). Uses Next.js `Image` component. Clean code.

### 7.3 `src/components/ui/pwa-install-prompt.tsx` -- clean implementation
- **Severity:** info
- **Detail:** Correctly handles `beforeinstallprompt` event lifecycle, persists dismissal to localStorage, proper cleanup. Only concern: the `BeforeInstallPromptEvent` type cast is unavoidable (see 2.3).

### 7.4 Settings panel -- large but well-structured
- **File:** `src/components/settings/settings-panel.tsx`
- **Severity:** low
- **Detail:** At ~800+ lines, this is the largest component. It contains `UpgradeCard`, `AccountSection`, and other sub-components defined in the same file. Consider extracting `UpgradeCard` and modal dialogs into separate files under `src/components/settings/` if it grows further.

---

## 8. File Organization

### 8.1 Overall structure -- good
- `src/lib/` -- pure logic, server utilities, AI prompts
- `src/lib/ai/` -- AI-specific (prompts, memory, openrouter)
- `src/lib/admin/` -- admin auth/session
- `src/lib/supabase/` -- client/server/admin Supabase helpers
- `src/lib/push/` -- push notification logic
- `src/hooks/` -- React hooks
- `src/stores/` -- single zustand store
- `src/components/` -- organized by feature (chat, billing, onboarding, orchestrator, squad, ui)
- `src/constants/` -- characters, wallpapers, greetings
- `src/types/` -- shared types

### 8.2 `src/components/orchestrator/` -- good organizational choice
- **Detail:** Groups cross-cutting concerns (auth-manager, error-boundary, perf-monitor, squad-reconcile, sw-register). Clear purpose.

### 8.3 Single store file
- **Detail:** Only one store (`chat-store.ts`) in `src/stores/`. If/when splitting into slices, the directory is ready.

---

## Priority Summary

| Priority | Item | Effort |
|----------|------|--------|
| **Medium** | 4.1: Import `SubscriptionTier` type instead of inlining | 15 min |
| **Medium** | 3.1: Add `error.tsx` to `/post-auth`, `/admin`, `/refund`, `/status` | 15 min |
| **Medium** | 2.1: Type admin dashboard query results | 20 min |
| **Low** | 1.1-1.5: Remove dead code / unnecessary exports | 10 min |
| **Low** | 1.6: Delete empty dev preview directories | 1 min |
| **Low** | 6.1: Extract shared `RouteErrorFallback` component | 15 min |
| **Low** | 4.3: Use `useShallow` in onboarding page | 5 min |
| **Low** | 5.1: Consider store slices (future) | 30 min |
| **Low** | 7.4: Extract settings sub-components (when it grows) | 20 min |

**Total estimated effort for all medium items: ~50 minutes**
**Total estimated effort for all items: ~2 hours**
