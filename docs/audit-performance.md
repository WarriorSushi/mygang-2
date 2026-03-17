# Performance Audit — MyGang.ai

**Date:** 2026-03-17
**Scope:** Bundle size, rendering, API, assets, config, dynamic imports

---

## Summary

The codebase is **well-optimized overall**. Previous audits clearly addressed many performance issues (LazyMotion, optimizePackageImports, dynamic imports, memo, CSS-only animations, low-end device detection). The findings below are incremental improvements — no critical performance issues found.

---

## Findings

### 1. `html-to-image` is a dependency but only used for screenshots

- **File:** `package.json:37`, used in `src/app/chat/page.tsx:454`
- **Impact:** Medium — adds ~25KB gzipped to the client bundle
- **Current state:** Already dynamically imported (`await import('html-to-image')`) ✅
- **Status:** ✅ Already handled correctly. No action needed.

### 2. `lottie-react` double-loading pattern

- **Files:** `src/components/chat/message-list.tsx:81` and `src/components/effects/confetti-celebration.tsx:5`
- **Impact:** Low — both use lazy loading already
- **Detail:** `message-list.tsx` has a manual lazy-load with module-level cache. `confetti-celebration.tsx` uses `React.lazy()`. Both correctly lazy-load lottie only when needed. The message-list also lazy-loads the JSON animation data. This is well done.
- **Status:** ✅ No action needed.

### 3. Three Google Fonts loaded in root layout

- **File:** `src/app/layout.tsx:11-25`
- **Impact:** Medium — Geist, Geist_Mono, and Outfit all loaded at root level
- **Detail:** `Geist_Mono` is declared but only used as a CSS variable. Outfit is loaded with weights `[700, 800, 900]` (only used for brand headings). Next.js font optimization handles this well (self-hosted, subset to latin), but Geist_Mono may be entirely unused.
- **Recommended fix:** Audit if `--font-geist-mono` is used anywhere in the app. If only used in code blocks or nowhere, remove it.
- **Effort:** S
- **Estimated savings:** ~5-15KB (font file)

### 4. `radix-ui` monorepo package instead of individual packages

- **File:** `package.json:42` — `"radix-ui": "^1.4.3"`
- **Impact:** Medium — The monorepo package `radix-ui` may include more components than needed
- **Detail:** `optimizePackageImports` in next.config doesn't list `radix-ui`. However, Tailwind v4 + modern bundlers tree-shake well. Radix UI v1.4+ uses the monorepo approach intentionally. Next.js should tree-shake unused components.
- **Recommended fix:** Add `'radix-ui'` to `optimizePackageImports` in `next.config.ts:8` to ensure barrel-file tree-shaking works correctly.
- **Effort:** S

### 5. Pricing page: heavy `use client` with many lucide icons

- **File:** `src/app/pricing/page.tsx:1-16`
- **Impact:** Low — imports 20+ lucide icons at top level for a `use client` page
- **Detail:** `optimizePackageImports` already covers `lucide-react` ✅. Each icon is tree-shaken individually. No issue here.
- **Status:** ✅ Already optimized.

### 6. `useShallow` adoption is inconsistent

- **Files:** `src/app/chat/page.tsx:69` uses `useShallow` ✅, but several components use individual selectors
- **Impact:** Low
- **Detail:** `chat-header.tsx:95-97` uses three separate `useChatStore(s => s.X)` calls. `message-list.tsx:176-177` uses two separate calls. Each individual selector is fine (Zustand v5 uses `Object.is` by default), but grouping with `useShallow` avoids multiple subscribe/unsubscribe cycles.
- **Recommended fix:** Combine adjacent single-field selectors into `useShallow` groups where 3+ fields are read from the same component.
- **Effort:** S

### 7. `MessageItem` creates new objects per render for color calculations

- **File:** `src/components/chat/message-item.tsx:256-290`
- **Impact:** Low — every render recomputes `parseColorToRgb`, `mixRgb`, etc.
- **Detail:** These are simple math operations (no DOM, no allocations beyond small objects). With the custom memo comparator on line 529, MessageItem only re-renders when props actually change. The color computation cost is negligible per render.
- **Status:** ✅ Acceptable. Memo prevents unnecessary renders.

### 8. Landing page is large but loads via dynamic import

- **File:** `src/app/page.tsx:5` — `const LandingPage = dynamic(..., { ssr: true })`
- **Impact:** Low
- **Detail:** The landing page component (~924 lines) is dynamically imported with SSR enabled. This means it's server-rendered but code-split from other routes. The `BackgroundBlobs` component correctly detects low-end devices and disables animations.
- **Status:** ✅ Well handled.

### 9. Chat page dynamic imports are well done

- **File:** `src/app/chat/page.tsx:17-27`
- **Impact:** N/A — positive finding
- **Detail:** Heavy components (MemoryVault, ChatSettings, SquadReconcile, PaywallPopup, ConfettiCelebration, UpgradePickerModal, DowngradeKeeperModal) are all dynamically imported with `{ ssr: false }`. Core components (ChatHeader, MessageList, ChatInput) are statically imported for fast initial render. This is the correct pattern.
- **Status:** ✅ Excellent.

### 10. `LazyMotionProvider` uses `domAnimation` — correct

- **File:** `src/components/lazy-motion-provider.tsx:3`
- **Impact:** N/A — positive finding
- **Detail:** Uses `domAnimation` (smaller) instead of `domMax`. Wrapped at layout level so framer-motion features are loaded once.
- **Status:** ✅ Correct.

### 11. Next.js config: image optimization well configured

- **File:** `next.config.ts:10-13`
- **Impact:** N/A — positive finding
- **Detail:** `formats: ['image/avif', 'image/webp']` with 30-day cache TTL. `optimizePackageImports` includes the three heaviest deps. Sentry tree-shaking enabled.
- **Status:** ✅ Good.

### 12. Static pages properly marked

- **Files:** `privacy/page.tsx:5`, `terms/page.tsx:5`, `about/page.tsx:6`
- **Impact:** N/A — positive finding
- **Detail:** All use `export const dynamic = 'force-static'`. These are server components (no `use client`). Settings page is a proper server component fetching data.
- **Status:** ✅ Correct.

### 13. Chat store persists 100 messages max to localStorage

- **File:** `src/stores/chat-store.ts:7` — `MAX_PERSISTED_MESSAGES = 100`
- **Impact:** Low
- **Detail:** With the O(1) dedup set on line 87 and `.slice(-100)` on writes, this is well-bounded. `partialize` correctly excludes non-essential state from persistence.
- **Status:** ✅ Well designed.

### 14. CSS: sidebar variables are unused

- **File:** `src/app/globals.css:74-81, 108-115`
- **Impact:** Low — ~20 unused CSS custom properties for sidebar theming
- **Detail:** No sidebar component exists in the app. These were likely from a shadcn/ui template.
- **Recommended fix:** Remove `--sidebar-*` variables and their `@theme` mappings (lines 11-18 in globals.css) to reduce CSS size slightly.
- **Effort:** S
- **Estimated savings:** Negligible (< 1KB), but cleaner.

### 15. `web-push` in client bundle concern

- **File:** `package.json:46` — `"web-push": "^3.6.7"`
- **Impact:** Low-Medium
- **Detail:** `web-push` is a Node.js-only library (uses crypto). It should only be imported server-side. Checking usage:
  - `src/lib/push/send.ts` and `src/lib/push/vapid.ts` — these are server-only files
  - Not imported by any `use client` component
- **Status:** ✅ Correctly used server-side only. Next.js tree-shakes it from client bundles.

### 16. `dodopayments-checkout` loaded as regular dependency

- **File:** `package.json:34` — `"dodopayments-checkout": "^1.8.0"`
- **Impact:** Low
- **Detail:** This is the Dodo Payments frontend checkout SDK. Only used via `@dodopayments/nextjs` integration. Should be fine as Next.js tree-shakes unused exports.
- **Status:** ✅ Acceptable.

### 17. `will-change-transform` on blob elements

- **File:** `src/components/holographic/background-blobs.tsx:38,46,54`
- **Impact:** Low
- **Detail:** `will-change-transform` on 3 blob elements promotes them to GPU layers. This is correct for continuously animated elements. The low-end device detection properly disables animations.
- **Status:** ✅ Correct usage.

---

## Actionable Recommendations (sorted by impact)

| # | Issue | Impact | Effort | File |
|---|-------|--------|--------|------|
| 1 | Add `'radix-ui'` to `optimizePackageImports` | Medium | S | `next.config.ts:8` |
| 2 | Audit if `Geist_Mono` font is actually used; remove if not | Medium | S | `src/app/layout.tsx:16-18` |
| 3 | Group adjacent single-field zustand selectors into `useShallow` | Low | S | `chat-header.tsx`, `message-list.tsx` |
| 4 | Remove unused `--sidebar-*` CSS variables | Low | S | `src/app/globals.css` |

---

## Things Already Done Well

- ✅ `LazyMotion` with `domAnimation` (not `domMax`)
- ✅ `optimizePackageImports` for lucide-react, framer-motion, lottie-react
- ✅ Heavy components dynamically imported with `{ ssr: false }` on chat page
- ✅ `html-to-image` dynamically imported at usage site
- ✅ `lottie-react` lazy-loaded with module-level caching
- ✅ `MessageItem` and `MessageList` properly memoized with custom comparators
- ✅ O(1) message dedup via Set in chat store
- ✅ Low-end device detection disables animations
- ✅ `prefers-reduced-motion` respected in CSS and JS
- ✅ Static pages use `force-static` / server components
- ✅ Image optimization: AVIF+WebP, 30-day cache, proper `sizes` attributes
- ✅ Sentry tree-shaking enabled (`removeDebugLogging`)
- ✅ Chat store bounded to 100 messages with `partialize`
- ✅ Scroll handler uses `requestAnimationFrame` throttling
- ✅ Draft save debounced (500ms) to avoid localStorage thrashing
- ✅ CSS-only animations for blob backgrounds (zero JS per frame)
- ✅ `PerfMonitor` is opt-in (requires localStorage flag)
