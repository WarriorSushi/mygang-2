# Performance Audit v2 — March 2026

Post-improvement audit of bundle, rendering, caching, and component optimization.

---

## Overall Assessment

The codebase is in **good shape** after prior audits. Dynamic imports, `useShallow`, `memo`, `optimizePackageImports`, and image optimization are already in place. The findings below are incremental improvements.

---

## 1. Bundle Size

### 1a. `html-to-image` only used in one screenshot codepath
- **File:** `src/app/chat/page.tsx` (line ~455)
- **Status:** Already dynamically imported via `await import('html-to-image')` — no bundle impact. **No action needed.**

### 1b. `lottie-react` correctly lazy-loaded everywhere
- `confetti-celebration.tsx` uses `React.lazy`, `lottie-loader.tsx` uses `next/dynamic`, `message-list.tsx` uses manual `import()` with module-level cache. **No action needed.**

### 1c. `@sentry/nextjs` tree-shaking enabled
- `next.config.ts` has `treeshake.removeDebugLogging: true`. **Good.**

### 1d. `optimizePackageImports` covers key packages
- Configured for `lucide-react`, `framer-motion`, `lottie-react`, `radix-ui`. **Good.**

### 1e. `dodopayments-checkout` (24KB gzip) ships to all users
- It's a direct dependency but only used on pricing/checkout flows.
- **Impact: Low.** Next.js code-splits per route, so it only loads on pricing page.
- **Recommendation:** Verify it's not imported from `layout.tsx` or shared components. Currently clean.

**Verdict: Bundle is well-managed. No high-impact issues.**

---

## 2. `use client` Components

### 2a. Layout-level client components loaded for every page
- `PwaInstallPrompt`, `CookieConsent`, `SwRegister`, `PerfMonitor`, `AuthManager` — all mounted in `layout.tsx`.
- They render `null` most of the time (dismissed/hidden state).
- **Impact: Low (~2-3KB combined).** These are small components and necessary for global functionality.
- **Recommendation (Low priority):** Could wrap `PwaInstallPrompt` and `CookieConsent` in `dynamic(() => ..., { ssr: false })` to defer their JS. Saves ~1KB from initial bundle. Estimated improvement: **~50ms on 3G.**

### 2b. `landing-page.tsx` is fully client-side
- Uses `framer-motion` scroll animations, `useTheme`, `useRouter`.
- **Impact: Medium.** Landing page is the entry point for new users. Heavy framer-motion usage prevents SSR.
- **Recommendation:** This is inherent to the animation-heavy design. No easy win without redesigning the landing page.

**Verdict: Client boundary usage is reasonable.**

---

## 3. React Re-renders

### 3a. MessageItem — properly memoized with custom comparator
- `src/components/chat/message-item.tsx` uses `memo()` with a comprehensive shallow comparison. **Excellent.**

### 3b. MessageList — two bare `useChatStore()` selectors
- **File:** `src/components/chat/message-list.tsx` (lines 180-181)
- `useChatStore((state) => state.showPersonaRoles)` and `useChatStore((state) => state.customCharacterNames)`
- The `showPersonaRoles` selector returns a primitive — fine.
- The `customCharacterNames` selector returns an object reference. If the store ever calls `set({ customCharacterNames: { ...old } })` with the same content, this triggers a re-render of the entire MessageList (which re-renders all messages).
- **Impact: Low-Medium.** Only matters if `customCharacterNames` is set frequently. Currently it's only set from settings panel, so low frequency.
- **Recommendation:** No change needed unless you see perf issues in profiling.

### 3c. Chat page — useShallow used correctly
- `src/app/chat/page.tsx` uses `useShallow` for multi-field store access. **Good.**

### 3d. Settings panel — individual selectors
- `src/components/settings/settings-panel.tsx` uses `useChatStore.getState()` for event handlers and individual selectors for render. **Good pattern.**

**Verdict: Re-render hygiene is solid.**

---

## 4. API Response Sizes and Caching

### 4a. Image cache TTL set to 30 days
- `next.config.ts`: `minimumCacheTTL: 2592000`. **Good.**

### 4b. Image formats include AVIF
- `formats: ['image/avif', 'image/webp']`. **Excellent** — AVIF is ~20% smaller than WebP.

### 4c. Chat API response — no explicit caching
- Chat messages are streamed and ephemeral — caching would be inappropriate. **Correct.**

### 4d. Persisted messages capped at 100
- `MAX_PERSISTED_MESSAGES = 100` in store. Prevents localStorage bloat. **Good.**

**Verdict: Caching strategy is appropriate.**

---

## 5. Image Optimization

### 5a. All avatar images use `next/image`
- `message-item.tsx`, `avatar-lightbox.tsx`, `message-list.tsx` typing indicator — all use `<Image>` with explicit `width`/`height`/`sizes`. **Good.**

### 5b. AvatarLightbox uses `priority` on the lightbox image
- `avatar-lightbox.tsx` line 73: `priority` is set. This is correct since the lightbox is user-triggered and the image should load immediately.

### 5c. MessageAvatar has `priority={false}`
- Correct — chat avatars should lazy load. **Good.**

**Verdict: Image optimization is thorough.**

---

## 6. Dynamic Imports

### 6a. Heavy/rare components are all dynamic
- `MemoryVault`, `ChatSettings`, `SquadReconcile`, `PaywallPopup`, `ConfettiCelebration`, `UpgradePickerModal`, `DowngradeKeeperModal` — all use `dynamic(() => ..., { ssr: false })`. **Excellent.**

### 6b. `AvatarLightbox` is NOT dynamically imported
- **File:** `src/components/chat/message-item.tsx` (line 9)
- It's statically imported into `message-item.tsx`, which is rendered for every message.
- However, `AvatarLightbox` only renders when `showAvatar` is true (user taps avatar), so the component tree cost is zero at rest.
- The JS module cost is ~1.5KB — included in the message-item chunk regardless.
- **Impact: Very Low.** Not worth the complexity of dynamic import here.

### 6c. `SettingsPanel` is NOT dynamically imported in chat page
- **File:** `src/app/chat/page.tsx` — `ChatSettings` is dynamic, and it internally renders `SettingsPanel`.
- So `SettingsPanel` is effectively lazy-loaded through `ChatSettings`. **Good.**

**Verdict: Dynamic import strategy is comprehensive.**

---

## 7. New Components Assessment

### 7a. PwaInstallPrompt
- Renders `null` until `beforeinstallprompt` fires. Uses `useCallback`. Clean. **No issues.**

### 7b. AvatarLightbox
- Uses `createPortal`, focus trap, escape handler. Clean implementation.
- Minor: `onClose` in the `useEffect` dependency array means the effect re-runs if parent re-renders with a new function reference. Since the parent (`MessageItemComponent`) creates `() => setShowAvatar(false)` inline, this is fine — the lightbox only mounts when visible.
- **No issues.**

### 7c. Settings Panel
- Large component (~400 lines) but only loaded via dynamic `ChatSettings`.
- Imports 16 Lucide icons — `optimizePackageImports` handles tree-shaking. **No issues.**

### 7d. BackgroundBlobs
- Pure CSS animations, `useSyncExternalStore` for low-end device detection, `will-change-transform` for GPU compositing. **Well optimized.**

### 7e. CookieConsent
- Renders `null` after acceptance. Small footprint. **No issues.**

**Verdict: All new components are well-optimized.**

---

## 8. CSS

### 8a. Tailwind v4 with PostCSS
- Using `@tailwindcss/postcss` — unused CSS is purged at build time. **Good.**

### 8b. `tw-animate-css` in devDependencies
- Animation utility classes. Small addition, purged if unused. **Fine.**

### 8c. No separate CSS files found beyond `globals.css`
- All styling via Tailwind utility classes. No risk of dead CSS accumulation. **Good.**

**Verdict: CSS is clean.**

---

## Summary Table

| # | Finding | Impact | Priority | Action |
|---|---------|--------|----------|--------|
| 2a | `PwaInstallPrompt` + `CookieConsent` in layout could be dynamic | ~50ms on 3G | Low | Optional |
| 3b | `customCharacterNames` selector returns object ref | Low re-render risk | Low | Monitor |

**Total actionable items: 0 high, 0 medium, 2 low.**

The app's performance posture is strong. Prior audit work has addressed all the major wins. The remaining items are micro-optimizations with diminishing returns.
