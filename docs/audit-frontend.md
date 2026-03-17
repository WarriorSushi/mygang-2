# Frontend UX & Accessibility Audit

**Date:** 2026-03-17
**Scope:** All components in `src/components/`, `src/app/`, and `src/app/globals.css`

---

## 1. Accessibility Issues

### 1.1 [HIGH] Character modal in selection-step lacks focus trap and Escape handling
**File:** `src/components/onboarding/selection-step.tsx:27-121`
The `CharacterModal` component renders a fullscreen overlay but has no focus trap, no Escape key handler, and no focus restoration on close. Compare with `MemoryVault` and `MessageItem` lightbox which both implement these correctly.

**Fix:** Add `useEffect` for Escape key, focus trap on Tab, and restore focus to the trigger button on close.

---

### 1.2 [HIGH] Selection step bottom bar has hardcoded dark-mode text colors
**File:** `src/components/onboarding/selection-step.tsx:268-273`
The bottom bar uses `rgba(0,0,0,...)` background and `text-white/40` text regardless of theme. In light mode, the dark backdrop-filter overlay and white text create a jarring appearance. Other components use theme-aware `text-muted-foreground` and `bg-card` tokens.

**Fix:** Replace inline `rgba(0,0,0,...)` background with theme-aware classes like `bg-card/90 backdrop-blur-xl` and use `text-muted-foreground` instead of `text-white/40`.

---

### 1.3 [MEDIUM] Cookie consent banner has no keyboard focus management
**File:** `src/components/ui/cookie-consent.tsx:33-49`
The cookie consent banner appears at the bottom of the screen but does not announce itself to screen readers (no `role="alert"` or `aria-live`), and the "Got it" button is not auto-focused. Users relying on screen readers may not notice it.

**Fix:** Add `role="alertdialog"` and `aria-label="Cookie consent"` to the container, and auto-focus the "Got it" button on mount.

---

### 1.4 [MEDIUM] Landing page demo carousel keyboard navigation fires on any context
**File:** `src/components/landing/landing-page.tsx:772-776`
The carousel div has `tabIndex={0}` and `onKeyDown` for ArrowLeft/ArrowRight, but does not prevent default on these keys, which causes the page to scroll when arrows are pressed while the carousel is focused.

**Fix:** Add `e.preventDefault()` inside the ArrowLeft/ArrowRight handlers.

---

### 1.5 [MEDIUM] Chat header avatar lightbox in `chat-header.tsx` lacks focus trap
**File:** `src/components/chat/chat-header.tsx:525-573`
The expanded avatar lightbox traps Escape and restores focus, but does not implement a Tab focus trap. A user can Tab out of the lightbox into the background content. Compare with `message-item.tsx:222-228` which correctly traps Tab.

**Fix:** Add Tab key trapping logic matching the pattern in `message-item.tsx`.

---

### 1.6 [LOW] FAQ `aria-expanded` is set on first item only, not toggled on others
**File:** `src/components/landing/landing-page.tsx:561`
The `aria-expanded` attribute is set to `true` for the first FAQ item but not set at all for others. The `onClick` handler tries to update it via DOM manipulation which is fragile and doesn't work reliably with React's rendering model.

**Fix:** Use React state to track which FAQ items are open and set `aria-expanded` declaratively.

---

### 1.7 [LOW] `AiDisclaimer` is not rendered anywhere in the chat page
**File:** `src/components/chat/ai-disclaimer.tsx:1-10` and `src/app/chat/page.tsx`
The `AiDisclaimer` component exists but is never imported or rendered in the chat page. If it's required for compliance (AI-generated content disclosure), it should be visible.

**Fix:** Render `<AiDisclaimer />` below the `ChatInput` in the chat page, or remove the dead component.

---

## 2. Responsive Design Issues

### 2.1 [MEDIUM] Paywall popup content can overflow on short mobile screens
**File:** `src/components/billing/paywall-popup.tsx:108-315`
The paywall dialog has significant padding (`p-8`) and multiple stacked sections (progress bar, feature lists, CTAs, cooldown suggestions). On devices with <667px height (iPhone SE), the content overflows without scrolling since `DialogContent` doesn't have `overflow-y-auto`.

**Fix:** Add `max-h-[90dvh] overflow-y-auto` to the inner content wrapper.

---

### 2.2 [LOW] Chat settings sheet content is very long on mobile
**File:** `src/components/chat/chat-settings.tsx` (full file, ~1300 lines)
The chat settings panel (wallpaper picker, rename, gang customization) renders inside a `Sheet` but the scrollable area may not account for safe-area-inset-bottom on iOS, causing the last items to be hidden behind the home indicator.

**Fix:** Ensure the scrollable container has `pb-safe` or `pb-[env(safe-area-inset-bottom)]`.

---

## 3. Loading & Error States

### 3.1 [MEDIUM] Memory vault edit/delete operations show no loading indicator
**File:** `src/components/chat/memory-vault.tsx:165-179`
When saving an edited memory (`handleSave`) or confirming delete (`handleDeleteConfirm`), the operations are optimistic but if the network call takes time, there's no visual feedback that the save is in progress. The edit mode closes immediately, giving the impression the save succeeded even if it hasn't completed.

**Fix:** Add a brief saving state or use a subtle inline spinner during the async operation, and show an error toast on rollback.

---

### 3.2 [LOW] Hydration loading state is a plain text "Loading..."
**File:** `src/app/chat/page.tsx:493-497`
The pre-hydration state shows a simple `animate-pulse` text "Loading...". This is functional but doesn't match the polished skeleton pattern used in `MessageList`'s `ChatSkeleton` component.

**Fix:** Replace with a branded loading skeleton or the existing `ChatSkeleton` component for visual consistency.

---

## 4. Empty States

### 4.1 [LOW] Settings page usage section shows "Send a message to see your usage" for new users
**File:** `src/components/settings/settings-panel.tsx:473-478`
When `messagesRemaining` is null/undefined (new user, no messages sent yet), the usage section shows a generic text. This is adequate but could be more informative about what the usage counter represents.

**Severity:** Low -- functional, just not polished.

---

## 5. Design Consistency Issues

### 5.1 [MEDIUM] Inconsistent border-radius across modals
Multiple modals use different border-radius values:
- Auth wall: `rounded-[2rem]` (line 101)
- Paywall popup: `rounded-[2rem]` (line 108)
- Delete chat modal: `rounded-[1.5rem]` (line 663)
- Character modal (onboarding): `rounded-2xl` (Tailwind default ~1rem) (line 43)
- Start fresh modal: `rounded-[1.5rem]` (line 737)

**Fix:** Standardize modal border-radius to a single design token. Suggest `rounded-[2rem]` to match the most premium-looking modals.

---

### 5.2 [LOW] Inconsistent button text sizing in settings vs chat
The settings panel uses `text-[10px] uppercase tracking-widest` for all buttons, while the chat header buttons use icon-only patterns with `size-9 sm:size-10 lg:size-9`. This is intentional (different contexts) but the settings page also mixes `text-[10px]`, `text-[11px]`, and `text-xs` for descriptive text within the same card.

**Severity:** Low -- minor visual inconsistency within settings cards.

---

### 5.3 [LOW] Light mode AI bubble border vs dark mode inconsistency
**File:** `src/components/chat/message-item.tsx:345`
In light mode, AI bubbles get `border: 1px solid ${toRgbString(aiBorderLight)}` via inline style, while dark mode bubbles have no border. This is intentional (light bubbles need definition) but the transition between themes feels abrupt since the border appears/disappears instantly.

**Fix:** Add a subtle border in dark mode too (e.g., `rgba(255,255,255,0.06)`) for smoother theme transitions.

---

## 6. Performance Concerns

### 6.1 [LOW] Landing page Lottie + animation data loaded eagerly in empty state
**File:** `src/components/chat/message-list.tsx:49-88`
The `EmptyStateWelcome` component fetches `/lottie/confetti.json` and dynamically imports `lottie-react` as soon as the chat is empty. Module-level caching mitigates re-fetches, but this still adds ~50-100KB to the initial chat experience before the user has even sent a message.

**Fix:** Consider deferring the Lottie load with `requestIdleCallback` or loading it only after a short delay.

---

## 7. Positive Findings (No Action Needed)

These areas are well-implemented:

- **Screen reader support in MessageList:** `aria-live="polite"` announcements for new AI messages, `role="log"` on the scroll container, typing indicator `role="status"`.
- **Focus management in MemoryVault:** Proper focus trap, Escape key handling, focus restoration on close.
- **Touch targets:** All header buttons have `min-w-[44px] min-h-[44px]`, meeting WCAG 2.5.5 AAA target size.
- **Reduced motion support:** `globals.css` has comprehensive `@media (prefers-reduced-motion: reduce)` rules disabling all custom animations.
- **Color contrast utilities:** `message-item.tsx` has proper WCAG contrast ratio calculation (`contrastRatio`, `pickReadableTextColor`, `ensureReadablePersonaNameOnLight`) ensuring text is readable on all persona-colored bubbles.
- **Keyboard navigation:** Character selection cards support Enter/Space, chat input handles Enter to send with Shift+Enter for newlines, IME composition handling via `isComposing` check.
- **iOS zoom prevention:** Chat input uses `text-[16px]` to prevent Safari auto-zoom on focus.
- **Safe area handling:** Both chat header and input respect `env(safe-area-inset-*)` for notched devices.
- **Error boundaries:** Chat page wraps `MessageList` in an `ErrorBoundary`, and all major routes have `error.tsx` files.
- **Loading states:** Chat skeleton, history loading button, memory vault loader, settings page loading.tsx all present.
- **Empty states:** Welcome message with Lottie animation for empty chat, "No memories found" in vault, informative text for usage before first message.
- **Offline handling:** Clear offline banner, disabled input, toast notification on disconnect.
- **Theme consistency:** Both light and dark themes use well-defined CSS custom properties with oklch color space for perceptual uniformity.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 2     |
| Medium   | 5     |
| Low      | 7     |

The app has strong fundamentals -- good a11y patterns (focus traps, aria labels, live regions, reduced motion), solid responsive design, and comprehensive loading/error/empty states. The issues found are mostly edge cases: missing focus traps in 2 modals, a theme-unaware bottom bar in onboarding, and minor design token inconsistencies across modals.
