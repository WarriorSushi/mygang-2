# Full Project Audit Log

Date: 2026-02-07  
Scope: Full repository technical review and direct implementation pass.

## Baseline
- `npm run build`: PASS
- `npm run lint`: FAIL (`32` errors, `13` warnings at baseline)

## Final Verification
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS

## Findings Tracker

### Runtime, Logic, and Reliability
- [x] Chat history duplicate write risk on autonomous follow-up calls (`src/app/api/chat/route.ts`)
- [x] Memory Vault function-order hook issue and encoding artifact (`src/components/chat/memory-vault.tsx`)
- [x] Auth sync robustness and type-safety gaps in session/profile sync (`src/components/orchestrator/auth-manager.tsx`)
- [x] Idle autonomous flow hardening and state flow consistency (`src/app/chat/page.tsx`)

### Token Efficiency and AI Pipeline
- [x] Add prompt/token guardrails and no-op early returns where applicable (`src/app/api/chat/route.ts`)
- [x] Tighten object typing for LLM response sanitization and memory update handling (`src/app/api/chat/route.ts`)

### UI/UX and Content Quality
- [x] Escaped/unescaped text issues in JSX (`src/components/landing/landing-page.tsx`, `src/components/orchestrator/auth-wall.tsx`, `src/app/auth/auth-code-error/page.tsx`, `src/components/onboarding/selection-step.tsx`, `src/components/chat/memory-vault.tsx`)
- [x] Onboarding identity initialization pattern causing effect lint violation (`src/app/onboarding/page.tsx`)
- [x] Settings/theme/header mount patterns flagged by React lint rules (`src/components/chat/chat-header.tsx`, `src/components/settings/settings-panel.tsx`, `src/components/holographic/background-blobs.tsx`)

### Type Safety and Maintainability
- [x] Remove high-risk `any` usage in touched critical paths (`src/app/api/chat/route.ts`, `src/components/orchestrator/auth-manager.tsx`, `src/lib/ai/memory.ts`, `src/app/auth/actions.ts`, `src/components/orchestrator/perf-monitor.tsx`, `src/app/api/analytics/route.ts`, `src/components/chat/chat-settings.tsx`, `src/app/chat/page.tsx`)
- [x] Clean minor unused vars and warning-level hygiene in touched files (`src/components/orchestrator/error-boundary.tsx`, `tests/chat-flow.spec.ts`, `tests/visual-check.spec.ts`)

## Change Log
- Initialized audit document with baseline checks and actionable fix items.
- Hardened AI route accounting so autonomous follow-up turns no longer inflate memory updates, abuse score, summary-turn count, or daily message count.
- Reduced token/payload overhead by trimming client message payload to latest `24` entries and reducing LLM history window to `10` on idle-autonomous calls.
- Added response sanitization with strict typing across event variants in chat route.
- Added recent duplicate-user-message suppression in `chat_history` persistence (`30s` content/window check).
- Improved client auth synchronization typing and stability via typed profile/session handling and memoized Supabase client in `AuthManager`.
- Fixed Memory Vault effect/function ordering risk and added memoized filtering.
- Replaced effect-based state initialization patterns flagged by React lint rules in chat header, settings panel, onboarding page, and background blobs.
- Corrected JSX escaping and text artifacts in landing/onboarding/auth/memory components.

## Improvement Sprint (Post-Audit)
Date: 2026-02-07

### Functional Improvements Implemented
- Chat input draft persistence:
  - Added local draft save/restore in `src/components/chat/chat-input.tsx`.
  - Impact: accidental refresh/navigation no longer loses unsent user text.
- Better offline behavior:
  - Added online/offline state wiring in `src/app/chat/page.tsx`.
  - Disabled send while offline, added explicit banner and toast feedback.
  - Impact: clearer UX and fewer failed sends.
- Faster chat rendering path:
  - Removed per-message repeated scans from `src/components/chat/message-item.tsx`.
  - Moved quoted message + "seen by" derivation to memoized structures in `src/components/chat/message-list.tsx`.
  - Impact: lower render cost and smoother scrolling in longer chats.
- Scroll handler throttling:
  - Added `requestAnimationFrame` throttling in `src/components/chat/message-list.tsx`.
  - Impact: reduced scroll jank on mobile and low-end devices.
- Navigation snappiness:
  - Added route prefetch to landing and onboarding (`src/components/landing/landing-page.tsx`, `src/app/onboarding/page.tsx`).
  - Reduced onboarding transition wait from `3600ms` to `2200ms`.
  - Impact: faster-feeling path into chat.

### UI/UX and Responsiveness Improvements Implemented
- Chat input UX upgrade (`src/components/chat/chat-input.tsx`):
  - Auto-resizing textarea.
  - Inline send/newline hint.
  - Character counter (`0/2000`).
  - Safer mobile bottom padding with safe-area support.
  - Offline-aware placeholder text.
  - Impact: cleaner composing experience on both desktop and mobile.

### Verification (Post-Improvement Sprint)
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS

## Auth Journey Fix Sprint
Date: 2026-02-07

### Problem
- Returning users were sometimes routed to onboarding/welcome after successful login.
- Display name and gang persistence could fail in client-auth flows due server-action/session-cookie dependency mismatch.

### Fixes Implemented
- Added centralized post-auth resolver page: `src/app/post-auth/page.tsx`.
  - Resolves session, pulls profile + gang from Supabase client APIs, updates store, then routes:
    - Returning user with gang -> `/chat`
    - New user without gang -> `/onboarding`
    - Logged-out/invalid -> `/`
- Updated auth callback default destination:
  - `src/app/auth/callback/route.ts` now defaults to `/post-auth`.
- Updated auth success navigation:
  - `src/components/landing/landing-page.tsx` auth success now routes to `/post-auth`.
  - `src/app/onboarding/page.tsx` auth success now routes to `/post-auth`.
  - Logged-in CTA now targets `/post-auth` as the canonical journey resolver.
- Added robust client-side journey sync helper:
  - `src/lib/supabase/client-journey.ts` for fetching and persisting profile/gang data.
- Switched profile writes to `update` (not `upsert`) where appropriate:
  - `src/app/auth/actions.ts`
  - `src/lib/supabase/client-journey.ts`
  - This aligns with existing RLS update policy and prevents silent insert-path mismatches.
- Hardened chat guard:
  - `src/app/chat/page.tsx` now routes logged-in users missing local squad to `/post-auth` instead of directly to onboarding.
- Updated auth sync orchestration:
  - `src/components/orchestrator/auth-manager.tsx` now uses client journey sync helpers for profile/gang restoration and username fallback persistence.

### Outcome
- New and returning user journeys now diverge consistently after successful authentication.
- Display name persistence is aligned with current schema + RLS expectations.

## Open Items
- Remaining lint warnings are non-blocking:
  - `src/app/chat/page.tsx`: hook dependency/refs warnings in advanced timer/effect orchestration.
  - `src/components/chat/message-list.tsx`: React Compiler warning for `@tanstack/react-virtual` interoperability.

## Persona Role Labels Sprint
Date: 2026-02-07

### Problem
- Persona names in chat did not clearly communicate each character's role/archetype.
- No quick in-chat control existed for users who prefer simpler name-only labels.

### Fixes Implemented
- Added role labels for every persona in `src/constants/characters.ts`.
- Extended chat state with persisted preference in `src/stores/chat-store.ts`:
  - `showPersonaRoles` (default `true`)
  - `setShowPersonaRoles` action
- Updated chat rendering to show role labels beside persona names:
  - Message headers in `src/components/chat/message-item.tsx`
  - Activity + typing indicators in `src/components/chat/typing-indicator.tsx`
  - Wiring in `src/components/chat/message-list.tsx`
- Added settings toggle in `src/components/chat/chat-settings.tsx`:
  - "Show role next to name"
  - Persists locally through Zustand persistence.

### Verification (Persona Role Labels Sprint)
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS

## Status Realism Sprint
Date: 2026-02-07

### Problem
- Activity status lines felt fake (examples like "is smiling", "is excited") and reduced believability.

### Fixes Implemented
- Restricted all temporary status lines to exactly three options:
  - `is reading your message`
  - `saw your message`
  - `opened your message`
- Updated local client status generation in `src/app/chat/page.tsx` to use only these statuses.
- Added normalization guard in `src/constants/character-greetings.ts`.
- Added API-side enforcement in `src/app/api/chat/route.ts`:
  - Prompt now instructs model to use only allowed status strings.
  - Sanitizer drops any non-compliant `status_update` content.

### Verification (Status Realism Sprint)
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS
