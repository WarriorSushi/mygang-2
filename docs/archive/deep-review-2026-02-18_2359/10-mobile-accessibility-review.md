# Mobile Responsiveness & Accessibility Deep Review

**Project:** MyGang.ai (Next.js)
**Date:** 2026-02-18
**Reviewer:** Senior Accessibility & Mobile UX Specialist
**Scope:** All 17 key component files across landing, chat, onboarding, settings, auth, and UI primitives

---

## Executive Summary

The project demonstrates strong mobile-first awareness in many areas -- safe area insets, `dvh` usage, `text-[16px]` to prevent iOS zoom, and decent ARIA labeling on interactive elements. However, there are **critical accessibility gaps** (no skip link, no `prefers-reduced-motion` CSS fallback, missing live regions for chat messages, carousel dots failing touch target minimums) and **several mobile UX issues** (action popup positioning, landscape orientation gaps, no service worker for PWA). Overall quality is above average for a startup product but falls short of WCAG 2.1 AA compliance in specific areas.

---

## 1. What's GREAT

### 1.1 Safe Area Handling (A)
- `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` are used consistently in:
  - `chat-header.tsx` (line 112): `pt-[calc(env(safe-area-inset-top)+0.75rem)]`
  - `chat-input.tsx` (line 93): `pb-[calc(env(safe-area-inset-bottom)+0.35rem)]`
  - `landing-page.tsx` nav (line 252): `pt-[calc(env(safe-area-inset-top)+1rem)]`
  - `selection-step.tsx` bottom bar (line 184): `pb-[calc(env(safe-area-inset-bottom)+0.75rem)]`
  - `message-list.tsx` scroll-to-bottom button (line 343): `bottom-[calc(env(safe-area-inset-bottom)+0.6rem)]`
- `globals.css` defines `.pb-safe` and `.pt-safe` utility classes.

### 1.2 iOS Input Zoom Prevention (A)
- `chat-input.tsx` (line 127) uses `text-[16px]` -- the exact threshold to prevent Safari auto-zoom on input focus. Drops to `md:text-[15px]` on desktop. Correctly done.
- Auth wall inputs use `text-base sm:text-lg` which resolves to 16px base. Correct.

### 1.3 Dynamic Viewport Height (A)
- `h-dvh` is used for the chat page layout (`src/app/chat/page.tsx` line 329) and `min-h-dvh` for the landing page. This correctly handles mobile browser chrome (address bar) resizing.

### 1.4 Dark Mode Implementation (A-)
- `ThemeProvider` with `attribute="class"`, `enableSystem`, and `defaultTheme="dark"` in `layout.tsx` (lines 93-98).
- Full light/dark CSS custom properties in `globals.css` using oklch color space.
- Theme toggle available on both landing page and chat header.
- `useTheme` and `resolvedTheme` pattern correctly handles SSR hydration.
- Color contrast calculations in `message-item.tsx` dynamically ensure readable text on persona-tinted bubbles (lines 86-102 with `contrastRatio` and `pickReadableTextColor`).

### 1.5 Reduced Motion Support (B+)
- `useReducedMotion()` from framer-motion is used in `landing-page.tsx` (line 206), `welcome-step.tsx` (line 13), `loading-step.tsx`, and `background-blobs.tsx`.
- Hero logo rotation animation respects reduced motion preference (line 362).
- Welcome step conditionally disables entrance animations (lines 17-19).

### 1.6 Touch Interaction Design (B+)
- Long-press to reveal message actions in `message-item.tsx` (350ms threshold, line 235) -- appropriate for mobile.
- `active:scale-95` / `active:scale-[0.98]` on buttons provides tactile press feedback.
- `enterKeyHint="send"` on chat textarea (line 124) -- shows "Send" on mobile keyboards.

### 1.7 ARIA Labeling on Key Interactions (B+)
- Message bubble: `role="button"`, `aria-label="Open message actions"`, `aria-haspopup="menu"`, `aria-expanded` (lines 360-364).
- Message action popup: `role="menu"`, `aria-label="Message actions"` (line 413).
- Chat input: `aria-label="Message input"` (line 123).
- Send button: `aria-label="Send message"` (line 140).
- All header icon buttons have `aria-label` attributes.
- Character selection cards: `role="button"`, `aria-pressed`, descriptive `aria-label` (lines 64-66).
- Settings switches: `aria-label` on all `Switch` components.
- Capacity info popup: `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls` (lines 171-173).

### 1.8 Keyboard Support (B)
- Message bubbles support Enter/Space to toggle actions and Escape to dismiss (lines 250-261).
- Character selection cards handle Enter/Space via `handleCharacterKeyDown` (lines 23-28).
- Chat input handles Enter to send, Shift+Enter for newline (lines 84-89).
- Composition event awareness (`e.nativeEvent.isComposing`) prevents premature send during IME input (line 85).
- Escape key dismisses action popups and capacity info via document-level listeners.

### 1.9 Semantic HTML (B)
- Proper heading hierarchy on landing page: `h1` for hero, `h2` for sections, `h3` for cards.
- `<nav>`, `<main>`, `<footer>`, `<section>` used correctly on landing page.
- `<header>` used for chat header.
- `<form>` wrapping the chat input with `onSubmit`.
- Structured data (JSON-LD) on the home page for SEO.

### 1.10 Responsive Layout Patterns (B+)
- Consistent responsive breakpoint usage: `sm:`, `md:`, `lg:` throughout.
- Landing hero switches from stacked to side-by-side at `lg:` breakpoint.
- Character grid: 2 columns mobile, 2 at `sm:`, 4 at `lg:`.
- Message bubbles: `max-w-[82vw] sm:max-w-[66vw] lg:max-w-[34rem]` -- appropriate width clamping.
- CTA button width clamped with `w-[min(92vw,22rem)]`.

---

## 2. What FAILS Accessibility Standards (WCAG 2.1 AA)

### 2.1 CRITICAL: No Skip Navigation Link
**Files:** `src/app/layout.tsx`
**WCAG:** 2.4.1 Bypass Blocks (Level A)

There is no skip link anywhere in the application. Users relying on keyboard navigation must tab through the entire nav and header to reach the main content.

**Fix:** Add a visually hidden skip link as the first child of `<body>`:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg">
  Skip to main content
</a>
```
Then add `id="main-content"` to the `<main>` elements.

### 2.2 CRITICAL: Chat Messages Lack Live Region Announcements
**Files:** `src/components/chat/message-list.tsx`
**WCAG:** 4.1.3 Status Messages (Level AA)

New incoming messages are rendered into a virtualized list but are never announced to screen readers. A blind user would have no idea when new messages arrive.

**Fix:** Add an `aria-live="polite"` visually hidden region that receives a text summary of each new message (e.g., "Luna says: hey, what is on your mind?").

### 2.3 CRITICAL: Carousel Dot Buttons Below Minimum Touch Target
**File:** `src/components/landing/landing-page.tsx`, lines 727-735
**WCAG:** 2.5.8 Target Size (Level AA, min 24x24px), also Apple/Google recommend 44x44px

The carousel dot buttons are `h-2 w-2` (8x8px) or `h-2 w-6` (8x24px active). These are far below the 24px minimum required by WCAG and the 44px recommended for comfortable mobile tapping.

**Fix:** Increase the tap target to at least 44x44px using padding:
```tsx
<button className="p-4 -m-4"> {/* visual dot stays small, tap area is 44px */}
  <span className={cn("block h-2 rounded-full ...", ...)} />
</button>
```

### 2.4 HIGH: No `prefers-reduced-motion` CSS Media Query Fallback
**Files:** `src/app/globals.css`
**WCAG:** 2.3.3 Animation from Interactions (Level AAA), 2.3.1 Three Flashes (Level A)

While framer-motion's `useReducedMotion` is used in some components, **all CSS animations** (`animate-marquee`, `animate-gradient`, `animate-floaty`, `animate-spin-slow`, `animate-bounce-short`, `animate-pulse`) run unconditionally. Users with vestibular disorders who set `prefers-reduced-motion: reduce` at the OS level will still see continuous marquee, floating, pulsing, and spinning animations.

**Fix:** Add to `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-marquee,
  .animate-gradient,
  .animate-floaty,
  .animate-spin-slow,
  .animate-bounce-short,
  .animate-pulse {
    animation: none !important;
  }
}
```

### 2.5 HIGH: Focus Not Trapped in Action Popup
**File:** `src/components/chat/message-item.tsx`, lines 409-456
**WCAG:** 2.4.3 Focus Order (Level A)

The message action popup (`role="menu"`) appears above the bubble but focus is not trapped within it. Tab key will move focus to elements behind/below the popup. Also, when the popup opens, focus is not moved to the first menu item.

**Fix:** Use a focus trap (e.g., `@radix-ui/react-focus-scope` or manual focus management) and auto-focus the first button on open.

### 2.6 HIGH: FAQ Section Uses Non-Semantic Markup
**File:** `src/components/landing/landing-page.tsx`, lines 498-514
**WCAG:** 1.3.1 Info and Relationships (Level A)

FAQ items are rendered as plain `<div>` elements without `<details>`/`<summary>`, `role="heading"`, or any ARIA accordion pattern. Screen readers cannot identify these as question-answer pairs despite the structured data in `page.tsx` declaring them as `FAQPage`.

**Fix:** Use native `<details>` / `<summary>` elements or implement the WAI-ARIA accordion pattern.

### 2.7 MEDIUM: `onLogin` Button in Onboarding is Not a Semantic Link
**Files:** `src/components/onboarding/welcome-step.tsx` (line 34), `src/components/onboarding/identity-step.tsx` (line 49)

The "Already have an account? Log in" uses a bare `<button>` with no role distinction. While technically functional, it resembles a link visually (small text, no button styling) which may confuse screen reader users expecting a link.

### 2.8 MEDIUM: Dialog Close Button Has Tiny Hit Area
**File:** `src/components/ui/dialog.tsx`, line 71-77
**WCAG:** 2.5.8 Target Size

The dialog close button inherits `rounded-xs` and has no explicit size. The SVG icon defaults to `size-4` (16px) with no padding. Effective tap target is likely ~20x20px, below the 24px WCAG minimum and far below the 44px recommendation.

### 2.9 MEDIUM: Color-Only Status Indicators
**File:** `src/components/chat/chat-header.tsx`, line 141

The online/typing status dot (`bg-emerald-500` vs `bg-amber-400`) communicates state through color alone. Users with color vision deficiency cannot distinguish these states.

**Fix:** Add shape differentiation (e.g., a ring/pulse for typing) or a text label always visible (not just when typing).

### 2.10 MEDIUM: Heading Level Skips on Chat Page
**File:** `src/components/chat/chat-header.tsx`, line 138

The chat page uses `<h1>` for "My Gang" in the header but there is no `<h2>` or lower heading for message groups or sections. The settings panel sections use `<div>` with styling classes instead of heading elements.

---

## 3. What's BROKEN on Mobile

### 3.1 HIGH: Message Action Popup Can Overflow Viewport
**File:** `src/components/chat/message-item.tsx`, lines 410-413

The action popup is positioned `absolute bottom-full mb-1.5` -- it renders above the bubble. For messages near the top of the viewport, this popup will overflow above the screen and be unreachable. There is no boundary detection or flip logic.

**Fix:** Use a popover library with viewport-aware positioning (e.g., Radix Popover, Floating UI) or implement manual boundary detection to flip the popup below when near the top.

### 3.2 HIGH: Onboarding Selection Bottom Bar Occludes Content
**File:** `src/components/onboarding/selection-step.tsx`, lines 183-231

The bottom bar is `fixed bottom-0 left-0 right-0 z-40`. The scrollable grid has `pb-36 sm:pb-28` to compensate, but on devices with large system navigation gestures (e.g., iPhone 15 Pro Max in landscape), the bottom padding may be insufficient, causing the last row of character cards to be hidden behind the fixed bar.

**Fix:** Calculate padding dynamically or use `pb-[calc(env(safe-area-inset-bottom)+10rem)]` to account for variable safe areas.

### 3.3 MEDIUM: Landscape Orientation Not Specifically Handled
**Files:** All layout files

No `@media (orientation: landscape)` queries or landscape-specific adjustments exist. On mobile landscape:
- The chat header's `pt-[calc(env(safe-area-inset-top)+0.75rem)]` may be excessive, wasting precious vertical space.
- The hero section with its large logo (`w-64 h-64`) will dominate the screen.
- The onboarding character grid at 2 columns will show minimal content.

**Fix:** Add landscape-specific styles to reduce header height and adjust grid columns.

### 3.4 MEDIUM: No Swipe Gesture Support for Demo Carousel
**File:** `src/components/landing/landing-page.tsx`, lines 688-748

The demo carousel only has arrow buttons for navigation. On mobile, users expect to swipe left/right to change slides. There are no touch event handlers (`onTouchStart`, `onTouchEnd`) or pointer event swipe detection.

**Fix:** Add swipe gesture detection or use a library like `use-gesture`.

### 3.5 MEDIUM: Virtual Keyboard May Obscure Chat Input
**File:** `src/components/chat/chat-input.tsx`

While `text-[16px]` prevents zoom, there is no handling for the `visualViewport` API or `window.visualViewport.resize` event. On iOS Safari, when the virtual keyboard opens, the chat input may be obscured because the `h-dvh` layout does not automatically resize.

**Fix:** Use the `visualViewport` API to adjust layout when the keyboard appears, or use `interactive-widget=resizes-content` viewport meta tag.

### 3.6 LOW: Selected Avatar "Remove" Hover State Non-Functional on Touch
**File:** `src/components/onboarding/selection-step.tsx`, lines 192-206

The remove overlay on selected avatars uses `hover:bg-black/40` and the X icon uses `hover:opacity-100`. On touch devices, hover states don't work, so the "remove" affordance is invisible. Users must know to tap the avatar to deselect.

**Fix:** Show the X icon always on small screens with a `sm:opacity-0 sm:hover:opacity-100` pattern.

---

## 4. Improvements Recommended (Prioritized by Impact)

### P0 -- Critical (Must Fix)

| # | Issue | Files | Effort |
|---|-------|-------|--------|
| 1 | Add skip navigation link | `layout.tsx` | 15 min |
| 2 | Add `aria-live` region for new chat messages | `message-list.tsx` | 1 hr |
| 3 | Add `@media (prefers-reduced-motion: reduce)` for all CSS animations | `globals.css` | 20 min |
| 4 | Increase carousel dot touch targets to 44px | `landing-page.tsx` | 15 min |
| 5 | Add viewport-aware positioning to message action popup | `message-item.tsx` | 2 hr |

### P1 -- High (Should Fix)

| # | Issue | Files | Effort |
|---|-------|-------|--------|
| 6 | Trap focus inside message action popup | `message-item.tsx` | 1 hr |
| 7 | Make FAQ section accessible (accordion or `<details>`) | `landing-page.tsx` | 1 hr |
| 8 | Enlarge dialog close button tap target | `dialog.tsx`, `sheet.tsx` | 15 min |
| 9 | Add non-color status indicator differentiation | `chat-header.tsx` | 30 min |
| 10 | Add swipe gestures to demo carousel | `landing-page.tsx` | 1.5 hr |
| 11 | Handle virtual keyboard with `visualViewport` | `chat-input.tsx` / chat page | 2 hr |

### P2 -- Medium (Recommended)

| # | Issue | Files | Effort |
|---|-------|-------|--------|
| 12 | Add landscape orientation styles | Multiple | 2 hr |
| 13 | Fix selection bottom bar padding for all safe areas | `selection-step.tsx` | 30 min |
| 14 | Add proper heading hierarchy to settings panel | `settings-panel.tsx` | 30 min |
| 15 | Show remove affordance on touch for selected avatars | `selection-step.tsx` | 15 min |
| 16 | Add service worker for PWA offline support | New file | 4 hr |
| 17 | Add `role="heading"` or semantic headings in settings sections | `settings-panel.tsx` | 30 min |

### P3 -- Low (Nice to Have)

| # | Issue | Files | Effort |
|---|-------|-------|--------|
| 18 | Add RTL support readiness (`dir="auto"` on text containers) | Multiple | 2 hr |
| 19 | Add `maskable` icon to manifest for Android adaptive icons | `manifest.json` | 15 min |
| 20 | Add `orientation` field to manifest | `manifest.json` | 5 min |
| 21 | Add `scope` and `id` fields to manifest for better installability | `manifest.json` | 10 min |
| 22 | Consider adding `<noscript>` fallback | `layout.tsx` | 15 min |

---

## 5. Detailed Category Analysis

### 5.1 Mobile Responsiveness

| Area | Grade | Notes |
|------|-------|-------|
| Viewport handling | A | `dvh` used correctly, safe areas handled |
| Touch targets | C | Carousel dots too small, dialog close too small, action buttons borderline |
| Thumb-friendly zones | B+ | Primary actions (send, CTA) in thumb reach; header buttons require stretch |
| Landscape support | D | No landscape-specific styles |
| Safe areas (notch/home) | A | Consistently applied with `env()` |
| Scroll behavior | B+ | Virtual scrolling, scroll-to-bottom button, auto-scroll on new messages |
| Virtual keyboard | C | Font size correct but no `visualViewport` handling |
| Horizontal overflow | A- | `overflow-hidden` on root containers, `max-w-[82vw]` on messages |

### 5.2 Accessibility (WCAG 2.1 AA)

| Area | Grade | Notes |
|------|-------|-------|
| Semantic HTML | B | Good structure on landing, weaker in chat/settings |
| ARIA labels/roles | B+ | Present on most interactive elements |
| Keyboard navigation | B | Works but missing focus trapping in popups |
| Focus management | C | No skip link, no focus trap in action popup |
| Heading hierarchy | C+ | Some skips, settings has no headings |
| Alt text | A | All images have descriptive alt text |
| Color contrast | B+ | Dynamic contrast calculation is sophisticated; status dots color-only |
| Screen reader compat. | C | No live regions for messages, no landmark labels |

### 5.3 PWA Readiness

| Area | Grade | Notes |
|------|-------|-------|
| Manifest | C+ | Present but missing `scope`, `id`, `orientation`, maskable icons |
| Service worker | F | None exists; no offline support |
| Installability | C | Manifest referenced in metadata; missing SW blocks install prompt |
| Offline support | F | No offline strategy |

### 5.4 Dark Mode

| Area | Grade | Notes |
|------|-------|-------|
| Consistency | A | Full light/dark variable sets in oklch |
| System preference | A | `enableSystem` on ThemeProvider |
| Manual toggle | A | Available in nav, header, and settings |
| Contrast in both modes | A- | Dynamic contrast calc; some muted-foreground opacities may be low |

### 5.5 Performance on Mobile

| Area | Grade | Notes |
|------|-------|-------|
| Animations | B- | Many continuous animations (marquee, gradient, spin) lack reduced-motion |
| Images | A- | Next.js `<Image>` with `sizes`, `priority` on hero only |
| Virtualization | A | TanStack Virtual for message list |
| `content-visibility` | A | `.content-auto` utility defined |
| Bundle considerations | B | framer-motion is a large dependency for mobile |

### 5.6 Internationalization

| Area | Grade | Notes |
|------|-------|-------|
| RTL readiness | D | No `dir` attributes, no logical properties (`ms-`/`me-` instead of `ml-`/`mr-`) |
| Text truncation | B | `truncate`, `line-clamp-2` used appropriately |
| Dynamic sizing | B+ | Flexible layouts accommodate varying text lengths |
| Language | C | Hardcoded to `lang="en"`, no i18n framework |

---

## 6. Component-by-Component Summary

| Component | Mobile | A11y | Notes |
|-----------|--------|------|-------|
| `globals.css` | A | C | Great variables; missing `prefers-reduced-motion` |
| `layout.tsx` | A | D | No skip link |
| `page.tsx` | A | A | Good structured data |
| `landing-page.tsx` | B+ | C+ | Carousel dots too small, FAQ not accessible, no swipe |
| `message-item.tsx` | B | B+ | Action popup can overflow; good ARIA on bubble |
| `message-list.tsx` | A- | C | Great virtualizer; no live region for new messages |
| `chat-input.tsx` | A | B+ | Correct font size, safe area padding, `aria-live` on limit |
| `chat-header.tsx` | B+ | B | Color-only status; good ARIA on buttons |
| `settings-panel.tsx` | B | C+ | No heading elements; `aria-pressed` on theme toggle is good |
| `auth-wall.tsx` | A- | B | Radix dialog handles focus; inputs sized well |
| `welcome-step.tsx` | B+ | B | Respects reduced motion; login button semantics |
| `identity-step.tsx` | A | A- | Has `sr-only` label, keyboard enter support |
| `selection-step.tsx` | B | B+ | Good `aria-pressed`; bottom bar padding concern; hover-only remove |
| `button.tsx` | A | A | Focus ring, disabled states, proper variants |
| `dialog.tsx` | B | B+ | Radix provides focus trap; close button too small |
| `sheet.tsx` | B | B | Similar to dialog; proper slide animations |
| `input.tsx` | A | A- | Focus ring, disabled, `aria-invalid` support; `text-base` prevents zoom |

---

## 7. Specific Code References

### Missing `prefers-reduced-motion` -- `globals.css` line 128+
All `@keyframes` definitions lack a reduced-motion override. The `animate-marquee` on the landing page runs a 24-second infinite loop that can cause motion sickness.

### Chat Input Font Size -- `chat-input.tsx` line 127
```
text-[16px] md:text-[15px]
```
This is correctly 16px on mobile (prevents iOS zoom) and 15px on desktop. Well implemented.

### Message Action Popup -- `message-item.tsx` lines 410-413
```tsx
className="absolute z-50 bottom-full mb-1.5 flex items-center gap-0.5 ..."
```
Uses `bottom-full` without any boundary detection. Will overflow above viewport for top messages.

### Carousel Dots -- `landing-page.tsx` lines 727-735
```tsx
<button className={cn("h-2 rounded-full ...", i === activeIndex ? 'w-6' : 'w-2')} />
```
8px height is critically below touch target minimums.

### No Skip Link -- `layout.tsx` lines 87-106
The `<body>` immediately contains `ThemeProvider > AuthManager > PerfMonitor > {children}` with no skip navigation mechanism.

### Manifest Gaps -- `public/manifest.json`
Missing: `scope`, `id`, `screenshots`, `categories`, `orientation`, `prefer_related_applications`, maskable icons. No service worker referenced.

---

## 8. Testing Recommendations

1. **Automated:** Run axe-core or Lighthouse accessibility audit on landing, chat, onboarding, and settings pages.
2. **Screen reader:** Test with VoiceOver (iOS Safari) and TalkBack (Android Chrome) through the complete onboarding-to-chat flow.
3. **Keyboard-only:** Navigate the entire app without a mouse. Verify all interactive elements are reachable and operable.
4. **Mobile devices:** Test on iPhone SE (small screen), iPhone 15 Pro Max (large notch/Dynamic Island), and a budget Android device (performance).
5. **Landscape:** Test chat page in landscape on a phone -- verify header doesn't consume excessive vertical space.
6. **Reduced motion:** Enable "Reduce Motion" in OS settings and verify no continuous animations remain.
7. **Color blindness simulation:** Use Chrome DevTools color vision deficiency emulation to check status indicators.
8. **Slow network:** Throttle to 3G and verify the landing page loads progressively without layout shifts from images.
