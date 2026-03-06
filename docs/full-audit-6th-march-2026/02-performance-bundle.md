# Performance & Bundle Size Audit

## Bundle Optimization

**Status: GOOD**

### Dynamic Imports (correctly used)
- `MemoryVault` — dynamically imported, SSR disabled
- `ChatSettings` — dynamically imported, SSR disabled
- `PaywallPopup` — dynamically imported, SSR disabled
- `SquadReconcile` — dynamically imported, SSR disabled
- `html-to-image` — dynamically imported only when screenshot taken

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | HIGH | **`framer-motion` is imported directly** in `message-list.tsx` and other components. This is a large library (~30KB gzipped). Consider using `lazy-motion` or a lighter alternative for simple fade/slide animations. | `src/components/chat/message-list.tsx:4` |
| 2 | MEDIUM | **Three Google fonts loaded** (Geist, Geist_Mono, Outfit). Outfit is used only for branding (weight 700-900). Consider if all three are needed on every page. | `src/app/layout.tsx:8-22` |
| 3 | MEDIUM | **`content-visibility: auto`** is correctly used on older messages (`content-auto` class). Good optimization. | `src/app/globals.css:312` |
| 4 | MEDIUM | **Chat route is ~900 lines.** The API route at `src/app/api/chat/route.ts` is very large. While this doesn't affect client bundle, it increases cold start time on serverless. | `src/app/api/chat/route.ts` |
| 5 | LOW | **PerfMonitor component** exists for development metrics tracking. Ensure it's no-op in production. | `src/components/orchestrator/perf-monitor.tsx` |

## Rendering Performance

**Status: GOOD**

- `MessageList` wrapped in `memo` — prevents re-render when parent state changes
- `MessageItem` wrapped in `memo` — individual messages don't re-render unnecessarily
- `ChatInput` wrapped in `memo`
- `ChatHeader` wrapped in `memo`
- `useShallow` used for Zustand subscriptions in chat page — prevents over-subscription
- `characterBySpeaker` computed with `useMemo` — no redundant lookups

### Potential Issues

| # | Severity | Finding |
|---|----------|---------|
| 6 | MEDIUM | `useMemo` for `seenByMessageId` recomputes on every message change. For large conversations this could be expensive. Consider debouncing or limiting to visible messages. |
| 7 | LOW | `useTypingSimulation` hook creates multiple timers. Cleanup is handled correctly via refs. |
| 8 | LOW | Avatar images use `next/image` with proper `sizes` attribute. Good. |

## Memory Leak Check

**Status: GOOD**

- Timer cleanup in `useEffect` return functions: confirmed in `chat page`, `typing simulation`, `autonomous flow`
- `_messageIdSet` (Set for dedup) grows unbounded but is cleared on `clearChat()` and rebuilt on rehydration. For typical sessions this is fine.
- `animatedMessageIdsRef` is cleared after 1200ms timeout — no leak.

## Core Web Vitals

| Metric | Assessment | Notes |
|--------|-----------|-------|
| LCP | Good | Chat page renders skeleton immediately, messages load fast |
| CLS | Good | Message skeletons reserve space, avatars have fixed dimensions |
| FID/INP | Good | No heavy synchronous JS on interaction |
