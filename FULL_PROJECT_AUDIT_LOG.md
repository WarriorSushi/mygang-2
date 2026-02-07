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

## Chat UX Reliability Sprint
Date: 2026-02-07

### Problems
- Theme toggle could appear to flip back to dark due remote sync overriding local preference.
- Wallpaper options (`default`, `neon`, `soft`) were under-explained.
- Persona role labels were easy to miss in message-only contexts.
- No native-feeling per-message quick actions (like/reply) on mobile.
- Consecutive messages from the same speaker did not merge naturally.
- Desktop keyboard hint text under composer was cluttering mobile UI.

### Fixes Implemented
- Theme stability:
  - `src/components/chat/chat-header.tsx`: theme toggle now derives from `resolvedTheme ?? theme`.
  - `src/components/orchestrator/auth-manager.tsx`: remote theme is only applied if local theme is unset or `system`, preventing involuntary local override.
- Wallpaper clarity:
  - `src/components/chat/chat-settings.tsx`: renamed section to `Chat Wallpaper` and added concrete descriptions for `Default`, `Neon`, `Soft`.
  - `src/components/settings/settings-panel.tsx`: mirrored same descriptions and clarified that wallpaper is visual-only.
- Persona labels visibility:
  - `src/components/chat/chat-header.tsx`: added top-bar persona chips (`Name - role`) when role-label toggle is enabled.
- Long-press actions + reply flow:
  - `src/components/chat/message-item.tsx`: long-press/context menu now reveals `Like` and `Reply` action pill.
  - `src/components/chat/message-list.tsx`: wired `onReplyMessage` and `onLikeMessage` callbacks.
  - `src/app/chat/page.tsx`: added reply target state, quick-like enqueue path, and send pipeline support for `replyToId`.
  - `src/components/chat/chat-input.tsx`: added reply-preview strip with cancel control.
  - `src/app/api/chat/route.ts`: accepts `replyToId` in payload and passes `target_message_id` context into LLM history.
- Bubble grouping:
  - `src/components/chat/message-list.tsx`: computes group position (`single/first/middle/last`) for consecutive messages.
  - `src/components/chat/message-item.tsx`: bubble corner geometry now adapts per group position for molded chains.
- Mobile composer cleanup:
  - `src/components/chat/chat-input.tsx`: `Enter to send - Shift+Enter newline` hint is hidden on mobile, retained on desktop.

### Verification (Chat UX Reliability Sprint)
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS

## Chat Scroll UX Sprint
Date: 2026-02-07

### Problem
- "Jump to latest" appeared as a top sticky strip and did not match expected chat-app behavior.
- Initial load could open above the latest message for resumed chats.
- Auto-scroll needed stronger, app-like rules for incoming vs self-sent messages while scrolled up.

### Fixes Implemented
- Reworked message list scroll controls in `src/components/chat/message-list.tsx`:
  - Removed top sticky "Jump to latest" banner.
  - Added bottom-right floating arrow-only button (mobile + desktop responsive).
- Added deterministic initial bottom pinning:
  - On first render with messages, auto-scrolls to latest entry.
- Implemented message-app style auto-scroll rules:
  - If user is at bottom, new messages keep viewport pinned to latest.
  - If user is scrolled up, incoming messages do not force-scroll.
  - If a new user-authored message is appended while scrolled up, viewport snaps back to latest.
  - Typing/status row appearance keeps bottom pin only when already at bottom.
- Tightened bottom detection threshold for smoother behavior (`48px`).

### Verification (Chat Scroll UX Sprint)
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS

## Visual System and Settings Navigation Sprint
Date: 2026-02-07

### Problems
- Chat top bar showed persona chips under online status, creating clutter and confusion with role-label toggle behavior.
- Role labels above message bubbles could disappear for users with older persisted gang data.
- Chat wallpaper controls were flat and unclear; wallpaper visuals were weak and often appeared not to change.
- Settings UX lacked submenu navigation pattern expected from side drawers.
- Dark mode lacked clear elevation hierarchy and appeared too flat/dark.

### Fixes Implemented
- Role-label behavior and header cleanup:
  - Removed top-bar persona chips from `src/components/chat/chat-header.tsx`.
  - Kept `show role next to name` toggle focused on persona/message context.
  - Increased role-label visibility above message bubbles and added fallback to archetype in `src/components/chat/message-item.tsx`.
  - Added character metadata fallback merge in `src/components/chat/message-list.tsx` so older persisted gang objects still show modern role labels.
- Settings drawer navigation redesign:
  - Rebuilt chat settings into a root menu + sliding submenus with back navigation in `src/components/chat/chat-settings.tsx`.
  - Added dedicated wallpaper submenu and explicit visual-only explanation.
  - Outside click now closes the sheet and resets submenu state through sheet open-state handling.
- Wallpaper system expansion + reliability:
  - Added shared wallpaper catalog in `src/constants/wallpapers.ts` with six presets:
    - `default`, `neon`, `soft`, `aurora`, `sunset`, `graphite`
  - Updated wallpaper typing across store/profile/settings:
    - `src/stores/chat-store.ts`
    - `src/lib/supabase/client-journey.ts`
    - `src/components/settings/settings-panel.tsx`
    - `src/app/settings/page.tsx`
  - Improved wallpaper rendering strength and added texture/elevation overlays in `src/app/globals.css`.
  - Fixed chat layering so wallpaper/blob visuals sit behind content but remain visible:
    - `src/app/chat/page.tsx`
    - `src/components/holographic/background-blobs.tsx`
- Theme/elevation refinement:
  - Rebalanced dark palette tokens in `src/app/globals.css` for clearer depth separation (`background`, `card`, `muted`, `border`, `input`, `ring`).

### Verification (Visual System and Settings Navigation Sprint)
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS

## Chat Polish and Accessibility Sprint
Date: 2026-02-07

### Problems
- Radix console warnings reported missing dialog title/description semantics for settings drawer content.
- Composer area showed overly strong shadow/banding around the input surface.
- AI bubble rendering felt soft/muddy and text too heavy for chat readability.
- Requested legacy dark wallpaper option was missing from wallpaper presets.
- Wallpaper picker needed stronger mobile scroll handling.

### Fixes Implemented
- Accessibility:
  - Added hidden `SheetTitle` + `SheetDescription` to `src/components/chat/chat-settings.tsx` to satisfy dialog accessibility requirements.
- Composer cleanup:
  - Refined composer container and form surfaces in `src/components/chat/chat-input.tsx`:
    - removed heavy `shadow-2xl` treatment
    - switched to crisp `card` + border styling
    - reduced visual banding at the bottom area
- Bubble readability and crispness:
  - Updated `src/components/chat/message-item.tsx`:
    - reduced blur-heavy look (`backdrop-blur-none`)
    - tightened AI tint opacity for cleaner edges
    - adjusted typography to more messaging-standard weights/spacing
    - mobile-first text sizing (`14px` mobile, `15px` desktop)
- Legacy wallpaper:
  - Added `midnight` wallpaper preset in `src/constants/wallpapers.ts`.
  - Added matching rendering rules in `src/app/globals.css` for deep legacy dark background.
- Wallpaper list UX:
  - Made wallpaper options region explicitly scrollable in `src/components/chat/chat-settings.tsx` for smaller screens.

### Verification (Chat Polish and Accessibility Sprint)
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS

## Chat Modes and Composer Layout Sprint
Date: 2026-02-07

### Problems
- `midnight` wallpaper stayed dark in light theme.
- Bottom composer area still looked like a floating boxed panel, especially on mobile.
- Intelligence mode toggle feedback felt weak and mode behavior differences were not obvious enough.
- Status rows showed persona role tags (e.g. `Kael (the hype man)`) when only names were desired.

### Fixes Implemented
- Wallpaper light/dark parity:
  - `src/app/globals.css`: `midnight` now has a light-theme variant and a dark-theme override.
  - `src/components/chat/chat-settings.tsx`: updated `midnight` preview tile to match light-mode look.
- Composer and bottom bar behavior:
  - `src/app/chat/page.tsx`: bottom composer container now behaves as a solid anchored bottom bar on mobile and removes extra outer rectangle on desktop.
  - `src/components/chat/chat-input.tsx`: removed extra floating shell effect and tightened spacing for clean single-input presentation.
- Stronger intelligence mode UX + behavior:
  - `src/components/chat/chat-settings.tsx`: replaced basic tabs with a satisfying animated segmented control in Intelligence submenu.
  - `src/app/api/chat/route.ts`: stricter mode enforcement:
    - `entourage` now uses stricter user-centric rules and single responder planning.
    - `entourage` hard-disables auto-continue and strips typing-ghost chatter.
    - `entourage` anchors outbound events to the latest user message id where possible.
  - `src/app/chat/page.tsx`: autonomous activity pulses now only run in `ecosystem`.
- Status row naming:
  - `src/components/chat/typing-indicator.tsx`: removed persona role tags from status and typing lines.
  - `src/components/chat/message-list.tsx`: removed unused role-prop pass-through to typing indicator.

### Verification (Chat Modes and Composer Layout Sprint)
- `npm run lint`: PASS with warnings only (`0` errors, `5` warnings)
- `npm run build`: PASS

## Landing UX Refresh Sprint
Date: 2026-02-07.

### Request Goals.
- Fix broken/ugly appearance in light theme.
- Add light/dark toggle on landing top bar beside auth CTA.
- Improve mobile CTA proportions (`Continue` larger, `Watch It Flow` smaller).
- Increase rotating hero logo size by ~30% mobile and ~60% desktop.
- Rewrite landing copy for non-technical audience.
- Improve mobile marquee readability with two rows moving in opposite directions.
- Replace technical stat messaging with emotionally relevant outcomes.

### Implemented.
- Rebuilt landing presentation and copy in `src/components/landing/landing-page.tsx`.
- Added theme toggle button in nav using `next-themes` (`Sun`/`Moon`) beside login/dashboard.
- Converted landing surfaces to token-based color system (`bg-card`, `border-border`, `text-foreground`) to render correctly in light and dark themes.
- Updated hero CTA sizing logic:
  - Primary CTA width increased on mobile.
  - Secondary `Watch It Flow` width reduced on mobile.
- Enlarged rotating logo container:
  - Mobile from ~`w-48` to `w-64` (~+33%).
  - Desktop from `lg:w-72` to `lg:w-[29rem]` (~+61%).
- Replaced technical/dev-heavy copy across:
  - Hero subtitle.
  - Stats cards.
  - Steps, highlights, and FAQ.
  - Final conversion block.
- Implemented dual mobile marquee rows with opposite animation directions and smaller chips/text for better viewport fit.
- Added richer motion polish (hover-lift cards) without extra dependency footprint.

### Verification.
- `npm run lint`: PASS (warnings only, existing known warnings outside landing scope).
- `npm run build`: PASS.
