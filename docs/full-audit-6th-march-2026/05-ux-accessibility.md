# UX & Accessibility Audit

## WCAG Compliance

**Status: STRONG**

### ARIA Labels (well-implemented)
- Chat input: `aria-label="Message input"`, `aria-required="true"`
- Send button: `aria-label="Send message"`
- All header buttons have `aria-label`
- Gang member avatars have `role="group"` with count
- Memory vault: `role="dialog"`, `aria-modal="true"`, `aria-label`
- Capacity info: `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`

### Screen Reader Announcements
- New messages announced via `aria-live="polite"` region in MessageList
- Delivery status uses `aria-live="polite"`
- Toast notifications use `role="alert"`

### Keyboard Navigation
- Memory vault has focus trap implementation
- Escape key closes modals/drawers
- Enter sends messages (Shift+Enter for newlines)
- Tab navigation through header buttons

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | MEDIUM | **ChatSettings drawer** should have a focus trap like MemoryVault does. Currently focus can escape the drawer. | `src/components/chat/chat-settings.tsx` |
| 2 | MEDIUM | **PaywallPopup** uses Dialog component (shadcn) which likely has built-in focus trap. Verify. | `src/components/billing/paywall-popup.tsx` |
| 3 | MEDIUM | **Skip navigation link** not present. For keyboard users, a "Skip to chat" link would be helpful. | `src/app/layout.tsx` |
| 4 | MEDIUM | **Color contrast** — All issues found and fixed in this session's light mode contrast audit. 19 issues resolved. | See `docs/design-changes-6th-march-2026/` |

## Mobile UX

**Status: STRONG**

- `h-dvh` used for main container (handles mobile browser chrome correctly)
- `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for notch/home indicator
- `text-[16px]` on textarea prevents iOS Safari auto-zoom
- Touch targets: Buttons use `size-9` (36px) minimum — slightly under 44px recommended
- Responsive breakpoints: Consistent `sm:` (640px), `lg:` (1024px) usage
- Offline detection with visual feedback

### Findings

| # | Severity | Finding |
|---|----------|---------|
| 5 | LOW | Touch targets on heart/reply icons (`w-3 h-3`) are very small. The `p-0.5` padding helps but total area is still ~20px. Consider wrapping in a larger hit area. |
| 6 | LOW | Starter chips use `active:scale-95` for feedback — good haptic feel. |
| 7 | LOW | Chat wallpaper previews in settings could be larger on mobile for easier selection. |

## Loading & Error States

**Status: GOOD**

- `ChatSkeleton` component for initial load
- `ErrorBoundary` wraps MessageList
- Loading indicators on: memory vault load, older history load, refresh button spin
- Optimistic updates: memory edit/delete with rollback on failure
- Draft message auto-saved to localStorage
- "Sending" / "Sent" / "Failed" delivery status indicators
- Failed messages show retry button
