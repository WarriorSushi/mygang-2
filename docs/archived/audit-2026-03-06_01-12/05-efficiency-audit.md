# Efficiency & Performance Audit

**Date:** 2026-03-06
**Scope:** Bundle size, API efficiency, React performance, Supabase usage, CSS/animations, chat performance, image/asset optimization

---

## 1. Bundle Size & Loading

### Dependencies Review

| Dependency | Size Impact | Verdict |
|---|---|---|
| `framer-motion` (~140kB min) | Heavy | Used extensively on landing page + chat. Justified for landing but consider `motion/react` (the lighter v12+ import). |
| `radix-ui` (v1.4.3, umbrella package) | Heavy | **Problem.** The umbrella `radix-ui` package bundles ALL Radix primitives. You only use Dialog, Switch, Tabs, ScrollArea, Avatar, Label. Switch to individual packages (`@radix-ui/react-dialog`, etc.) to save ~50-80kB. |
| `html-to-image` | Medium | Already dynamically imported in `takeScreenshot()`. Good. |
| `dodopayments` + `dodopayments-checkout` | Medium | Two packages for billing. Only used server-side and in billing flows. Acceptable. |
| `@ai-sdk/google` + `@ai-sdk/openai` | Low (server only) | Server-only, no client bundle impact. But neither appears to be used for chat -- only `@openrouter/ai-sdk-provider` is. `@ai-sdk/google` is used solely for embeddings in `memory.ts`. **`@ai-sdk/openai` appears unused** -- verify and remove if so. |
| `lucide-react` | Medium | Tree-shakes well per-icon. Good usage pattern. |

### Code Splitting

**Good practices found:**
- `MemoryVault`, `ChatSettings`, `SquadReconcile`, `PaywallPopup` are all `dynamic()` imports with `ssr: false` in `chat/page.tsx` (line 15-21).
- `html-to-image` is dynamically imported only when screenshot is taken.

**Issues:**
- **Landing page is monolithic.** `LandingPage` (~900 lines) includes `LiveDemoCard`, `DemoCarousel`, `Section`, `Testimonial` all inline. The `DemoCarousel` with its animated threads could be dynamically imported since it's below the fold.
- **`"use client"` boundaries are appropriate.** Only 7 UI primitives (sheet, dialog, label, switch, avatar, scroll-area, tabs) have `"use client"` from Radix, which is expected. Components that need client are properly marked.

### next.config.ts
- `images.minimumCacheTTL: 60` -- consider increasing to 3600 (1 hour) or higher for avatar images that rarely change.
- No `webpack` customization or bundle analyzer configured.

**Estimated Impact:**
- Removing `radix-ui` umbrella => individual packages: **-50-80kB** bundle reduction (HIGH)
- Removing unused `@ai-sdk/openai`: **-10-20kB** server bundle (LOW)
- Splitting landing page below-fold content: **-30-50kB** from initial landing page load (MEDIUM)

---

## 2. API Efficiency

### `/api/chat/route.ts` (the critical path)

**Architecture:** Single POST endpoint, ~800+ lines. Handles auth, rate limiting, safety checks, memory retrieval, LLM call, history persistence, profile updates, and metrics logging.

**Issues found:**

1. **Sequential database calls that could be parallelized.** The profile fetch (line ~677), memory retrieval (line ~765), and character prompt block fetch happen sequentially. The profile fetch and character prompt blocks could run in parallel with `Promise.all`.
   - **Impact: MEDIUM** -- saves 50-150ms per request.

2. **Rate limiter instantiates Redis client on every call.** In `rate-limit.ts` (lines 43-50), when Upstash is configured, it creates a new `Redis` instance and `Ratelimit` instance per invocation via dynamic `import()`. These should be cached as module-level singletons.
   - **Impact: HIGH** -- dynamic imports add ~20-50ms overhead per rate limit check, and there can be 2-3 rate limit calls per chat request (user rate limit + tier-based limit).

3. **Memory retrieval fetches 50 rows then filters client-side.** `retrieveMemoriesLite()` (memory.ts line 122-128) fetches the 50 most recent memories and scores them in JS. This is fine for small datasets but will degrade as memory count grows. A server-side full-text search or the existing `match_memories` RPC with embeddings would be more efficient.
   - **Impact: LOW** (currently) -- becomes MEDIUM at scale.

4. **History persistence uses `waitUntil` well.** The chat history insert and profile update are deferred with `waitUntil` from `@vercel/functions`, so they don't block the response. This is good.

5. **Admin settings cache is effective.** Module-level cache for `globalLowCostOverride` and `dbPromptBlocks` with stampede prevention. Well done.

6. **Duplicate Supabase client creation in webhook route.** `webhook/dodo-payments/route.ts` creates its own `createClient` at module level (line 4-7) instead of using the shared `createAdminClient()`. This is a minor code smell but functionally fine since webhooks need the service role key.

### `/api/analytics/route.ts`
- Simple insert, rate-limited. No issues.

### `/api/checkout/route.ts` + `/api/checkout/activate/route.ts`
- Two separate DB calls (auth + profile fetch) that could potentially use a single query, but these are infrequent endpoints. Not a priority.

### `/api/customer-portal/route.ts`
- Creates a new `NextRequest` to add `customer_id` param (line 38-43). Minor allocation overhead but acceptable.

---

## 3. React Performance

### Re-render Analysis

1. **`useChatStore` selector in `ChatPage` pulls many fields.** Using `useShallow` is good, but `messages` is an array that changes reference on every message add. This causes the entire page to re-render on every incoming message. The `MessageList` is `memo`'d which helps, but the parent still re-renders.
   - **Impact: LOW-MEDIUM** -- mitigated by memo on children.

2. **`MessageItem` is properly `memo`'d.** Good.

3. **`MessageList` is properly `memo`'d.** Good.

4. **`ChatInput` is properly `memo`'d.** Good.

5. **`ChatHeader` is properly `memo`'d.** Good.

6. **`useChatApi` creates new function closures on every render.** The `sendToApi`, `handleSend`, `enqueueUserMessage`, and `scheduleDebouncedSend` functions are recreated on every call. However, they capture stale values via refs (`isGeneratingRef`, `pendingUserMessagesRef`, etc.), which is the correct pattern. The actual handlers are exposed via refs (`sendToApiRef`, `handleSendRef`), so downstream consumers read the latest version. This is intentional and correct.

7. **`updateUserDeliveryStatus` creates new message arrays.** In `use-chat-api.ts` line 134, it maps over ALL messages to update delivery status of specific ones. With 100 messages, this creates 100 new objects even if only 1 changed.
   - **Recommendation:** Filter first, only create new array if a match exists.
   - **Impact: LOW** -- messages capped at 100.

8. **`seenByMessageId` computation in `MessageList` (line 108-127).** This is an O(n*m) nested loop that runs on every messages change. For 100 messages it's fine, but the algorithm is quadratic.
   - **Impact: LOW** -- capped at 100 messages.

9. **`Testimonial` component applies per-frame `transform` via `onMouseMove`.** This is direct DOM manipulation (no state update), which is the correct approach. No re-render issue.

10. **`collapseLikelyDuplicateMessages` runs on every history sync.** Called from `useChatHistory` on interval (every 12s). For 100 messages, this is negligible.

### Missing Optimizations

- **No `useCallback` on `handleScroll` in `MessageList` (line 139).** It creates a new function ref on every render, but since it's on a DOM element and uses a RAF guard, the perf impact is negligible.

---

## 4. Supabase Usage

### Connection Management

- **Server client** (`lib/supabase/server.ts`): Creates a new client per request using `cookies()`. This is the correct Next.js App Router pattern.
- **Admin client** (`lib/supabase/admin.ts`): Singleton pattern with module-level cache. Good.
- **Browser client** (`lib/supabase/client.ts`): Creates a new client per call. The `@supabase/ssr` `createBrowserClient` internally deduplicates, so this is fine.

### Query Efficiency

1. **Chat route profile query is a single `.select().eq().single()`.** Efficient -- single row, indexed by primary key.

2. **Memory retrieval fetches 50 rows without pagination concern.** The `retrieveMemoriesLite` query uses `.limit(50)` with no index hint for the content-based scoring. As memory tables grow, adding a `created_at` index filter (e.g., last 30 days) would help.

3. **Chat history persistence uses batch insert.** The chat route builds an array of rows and inserts them in one call. Good.

4. **No real-time subscriptions detected.** The app uses polling (`useChatHistory` syncs every 12s) instead of Supabase Realtime. This is a deliberate architectural choice -- simpler, avoids WebSocket connection management overhead. For a chat app, Realtime channels could reduce latency for multi-device sync, but the current polling approach is perfectly adequate for single-user-to-AI chat.

### RLS Policies
- The server routes use `createClient()` (anon key + user cookies) for user-scoped operations, which properly leverages RLS.
- The webhook route and admin client use the service role key to bypass RLS, which is correct for those contexts.

---

## 5. CSS/Styling Performance

### Animation Inventory

| Animation | Element | Performance |
|---|---|---|
| `blob-drift-1/2/3` | Background blobs | GPU-composited (`transform` only). `will-change-transform` set. Good. |
| `grain-shift` | Landing grain overlay | `transform` only, `steps(6)`. Efficient. |
| `gradient-shift` | CTA buttons, borders | `background-position` -- does NOT trigger layout but may cause paint. Low impact since it's on small elements. |
| `marquee` | Landing marquee | `transform: translateX`. GPU-composited. Good. |
| `floaty` | Feature icons | `transform: translateY`. GPU-composited. Good. |
| `msg-appear` | Chat messages | Opacity only. Very lightweight. |
| `bounce-short` | Reactions | `transform: translateY`. Runs twice then stops. Good. |
| `animate-pulse` (Tailwind) | Skeletons, status dots | Opacity-based. Lightweight. |

### Good Practices
- `prefers-reduced-motion` media query disables ALL custom animations (line 377-392). Excellent accessibility.
- `BackgroundBlobs` component detects low-end devices and disables motion. Smart.
- Chat wallpaper layer uses pure CSS gradients (no images). Efficient.
- `content-visibility: auto` class exists (line 314-317) but is not applied to chat messages. **Applying this to off-screen message items could improve scroll performance.**

### Potential Issues
- **Film grain SVG in CSS uses an inline data URI with `feTurbulence` filter.** This is rendered by the browser's SVG engine and composited. On some GPUs this can be expensive. The element has `opacity: 0.18` and `mix-blend-mode: soft-light`, which forces compositing. On low-end mobile devices, this could cause jank during scrolling.
  - **Recommendation:** Consider disabling the grain overlay on mobile or when `detectLowEndDevice()` returns true.
  - **Impact: MEDIUM on low-end mobile.**

- **Unused CSS:** Several sidebar-related custom properties (`--sidebar-*`) are defined but no sidebar component exists. Minor dead code.

---

## 6. Chat Performance

### Message List Virtualization

**The message list is NOT virtualized.** All messages (up to 100, capped by `MAX_PERSISTED_MESSAGES`) are rendered as DOM nodes simultaneously.

For 100 messages with avatars, timestamps, delivery statuses, and quoted replies, this is approximately 500-1000 DOM nodes. This is within acceptable limits for modern browsers but:

- **At 100 complex messages, initial render could take 50-100ms.** Scrolling should be smooth since there's no per-frame JS (the `handleScroll` uses RAF throttling).
- **The `AnimatePresence` on the scroll-to-bottom button** is lightweight (single element).
- **No `content-visibility: auto`** is applied to message items, which could help the browser skip layout/paint for off-screen messages.

**Recommendation:** Add `content-visibility: auto` and `contain-intrinsic-size` to message containers for messages above the fold. This is a low-effort, high-reward optimization.

**Impact: MEDIUM** -- improves initial render and scroll perf for long conversations.

### Streaming

The chat API does NOT use streaming (SSE/WebSocket). It returns the complete response as JSON, which the client then "plays back" with simulated typing delays. This is architecturally sound for this use case:
- Simulated typing with delays is the core UX feature
- A single JSON response is simpler and more reliable than streaming
- The `maxDuration: 45` on the route handles timeout

### Memory Usage

- Messages capped at 100 (`MAX_PERSISTED_MESSAGES`). Good.
- Message IDs tracked in a `Set` for O(1) dedup. Good.
- Zustand persist serializes to localStorage. With 100 messages, this is roughly 50-100KB of JSON. Acceptable.
- `useChatHistory` reconciliation creates temporary arrays for dedup but they are short-lived. No memory leak concern.

### Timer/Interval Management

- All timers in hooks are properly cleaned up in `useEffect` return functions.
- The chat page cleanup effect (line 211-223) explicitly clears greeting timers, status timers, typing timers, and idle timers. Good.
- History sync interval (12s) is cleared on unmount. Good.

---

## 7. Image/Asset Optimization

### Critical Issue: Unoptimized Avatar PNGs

**Total public image size: ~109 MB** -- this is extremely large.

| File | Size |
|---|---|
| `public/avatars/*.png` (14 files) | ~7-8.8 MB each |
| `public/logo.png` | ~456 KB |
| `public/logo.webp` | ~2.7 KB |
| `public/icon.png` | ~456 KB |
| `public/icon-512.png` | ~236 KB |

**The avatar PNGs are 7-8 MB each.** These are served through Next.js `<Image>` component which provides on-demand optimization, so actual served sizes will be smaller. However:

1. **Build and deployment size is massively inflated.** 109MB of public assets slows deploys and increases cold start times.
2. **Next.js Image optimization happens on-demand** and is cached, but the first request for each size variant hits the optimization pipeline, adding latency.
3. **The original files are unnecessarily large for avatars displayed at 28-40px.** Even with responsive `sizes` attributes, the source images don't need to be 7MB.

**Recommendations:**
- **Resize avatar source PNGs to max 512x512px** and compress. This should reduce each file from ~7MB to ~50-200KB. Total savings: **~95% (~100MB)**.
- **Convert to WebP format** (like `logo.webp`). WebP at 512px would be ~20-50KB per avatar.
- **Consider a sprite sheet** or CSS-based avatars for the landing page where no actual avatar is shown.

**Impact: VERY HIGH** -- reduces repository size, deploy times, and initial optimization latency.

### Next.js Image Usage

- Avatars use `<Image>` with `width={28} height={28}` and `sizes="28px"`. Good -- Next.js will serve appropriately sized variants.
- Chat header avatars use `sizes="(max-width: 640px) 36px, 40px"`. Good responsive sizing.
- Landing page logo uses `priority` flag for above-fold image. Good.
- Avatar images set `priority={false}`. Correct for below-fold/deferred content.

---

## Summary: Priority Recommendations

### Immediate (High Impact, Low Effort)

| # | Recommendation | Est. Impact | Effort |
|---|---|---|---|
| 1 | **Compress/resize avatar PNGs** from ~7MB to <200KB each | -100MB deploy, faster loads | 30 min |
| 2 | **Replace `radix-ui` umbrella with individual packages** | -50-80KB bundle | 20 min |
| 3 | **Cache Redis/Ratelimit instances** in `rate-limit.ts` | -60-150ms per chat request | 15 min |

### Short-Term (Medium Impact)

| # | Recommendation | Est. Impact | Effort |
|---|---|---|---|
| 4 | **Add `content-visibility: auto`** to message list items | Faster initial render, smoother scroll | 10 min |
| 5 | **Parallelize profile + memory + character prompt fetches** in chat API | -50-150ms per request | 30 min |
| 6 | **Increase `images.minimumCacheTTL`** to 3600+ | Fewer re-optimization hits | 2 min |
| 7 | **Disable grain overlay on mobile/low-end** | Better mobile scroll perf | 15 min |

### Long-Term (Lower Priority)

| # | Recommendation | Est. Impact | Effort |
|---|---|---|---|
| 8 | **Dynamic import below-fold landing page sections** | -30-50KB initial load | 1 hr |
| 9 | **Verify and remove `@ai-sdk/openai`** if unused | Cleaner deps | 5 min |
| 10 | **Add server-side memory search** (full-text or embedding) | Better perf at scale | 2-4 hrs |
| 11 | **Consider Supabase Realtime** for multi-device chat sync | Lower sync latency | 4-8 hrs |

---

## Overall Assessment

The application is **well-architected for its current scale**. Key patterns are sound:
- Zustand with persistence and dedup is clean
- Dynamic imports for modal/overlay components
- `memo` on all hot-path chat components
- `waitUntil` for non-blocking DB writes
- Module-level caching with stampede prevention on server
- GPU-composited CSS animations with reduced-motion support

The **two biggest wins** are (1) compressing the avatar images (~100MB savings) and (2) caching the Redis rate limiter instances (removing per-request overhead on the critical chat path). Both are quick fixes with outsized impact.
