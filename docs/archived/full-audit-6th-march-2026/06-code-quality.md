# Code Quality & Architecture Audit

## Project Structure

**Status: GOOD**

```
src/
  app/           — Next.js app router pages & API routes
    chat/        — Main chat page
    pricing/     — Pricing page
    admin/       — Admin panel
    auth/        — Auth actions (server actions)
    api/chat/    — Chat API route
  components/
    chat/        — Chat UI components (header, input, messages, settings, vault)
    billing/     — Paywall popup
    holographic/ — Visual effects (glass card, background blobs)
    orchestrator/— Auth manager, error boundary, perf monitor, squad reconcile
    ui/          — shadcn/ui components
  constants/     — Character catalog, wallpapers
  hooks/         — Custom hooks (chat API, history, typing, capacity, autonomous)
  lib/           — Utilities (analytics, supabase clients, chat utils)
  stores/        — Zustand store
```

**Naming:** Consistent kebab-case for files, PascalCase for components
**Imports:** Clean, no barrel exports (good — avoids tree-shaking issues)

## TypeScript Quality

**Status: GOOD**

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | HIGH | **API route is ~900 lines** in a single file. Should be split into: prompt builder, response parser, rate limiter, and main handler. | `src/app/api/chat/route.ts` |
| 2 | MEDIUM | **Chat page is ~475 lines.** Hooks help, but the page still orchestrates many concerns. The ref-bridge pattern (`api.clearIdleAutonomousTimerRef.current = autonomous.clearIdleAutonomousTimer`) is clever but hard to follow. | `src/app/chat/page.tsx` |
| 3 | MEDIUM | **No `any` types found** in application code — strict TypeScript well maintained. |  |
| 4 | MEDIUM | **Database types** (`src/lib/database.types.ts`) should be regenerated periodically to stay in sync with Supabase schema. |  |

## State Management

**Status: GOOD**

- Single Zustand store (`chat-store.ts`) with `persist` middleware
- `useShallow` prevents over-subscription
- `partialize` controls what's persisted to localStorage
- `onRehydrateStorage` handles stale state recovery (just fixed: avatar enrichment)

### Considerations
- Store holds both UI state (chatWallpaper, showPersonaRoles) and data state (messages, activeGang). Could be split but current size is manageable.
- `customCharacterNames` stored separately from `activeGang` — clean separation

## Error Handling

**Status: GOOD**

- `ErrorBoundary` wraps chat message area
- API errors caught with try/catch in hooks
- Optimistic updates with rollback (memory vault)
- Network offline handling with visual feedback
- Stale "sending" messages recovered on rehydration

## Testing

**Status: NEEDS IMPROVEMENT**

| # | Severity | Finding |
|---|----------|---------|
| 5 | MEDIUM | **Test files exist** (`tests/chat-flow.spec.ts`, `tests/chat-scroll.spec.ts`) using Playwright. Coverage is limited to basic chat flow. |
| 6 | LOW | **No unit tests** for utility functions, hooks, or store logic. Adding tests for `chat-utils.ts`, message deduplication, and capacity manager would catch regressions. |

## Dependencies

**Status: CLEAN**

- `pnpm` used as package manager (per project convention)
- Key deps: Next.js, React 19, Zustand, Framer Motion, Supabase, AI SDK, Tailwind v4
- No deprecated packages detected
- `html-to-image` only loaded dynamically for screenshots — good

## Code Duplication

- Pro/Basic badge markup duplicated (desktop + mobile versions) in chat-header — acceptable for responsive design
- Wallpaper CSS now properly split between dark/light variants — clean
- Color utility functions in `message-item.tsx` could be extracted to `lib/color-utils.ts` if reused elsewhere
