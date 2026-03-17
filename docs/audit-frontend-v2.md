# Frontend Audit v2 — MyGang

**Date:** 2026-03-18
**Scope:** Accessibility, new components, responsive design, loading/error/empty states, design consistency, theme support, touch targets.

---

## Summary

The frontend is in strong shape. Previous v1 audit fixes are well-applied — WCAG contrast utilities, focus management, reduced-motion support, aria labels, and safe-area-inset handling are all present. A few issues remain, mostly minor.

### v1 Improvements Confirmed
- ✅ WCAG AA contrast: `pickReadableTextColor()` + `ensureReadablePersonaNameOnLight()` ensure all dynamic persona colors meet 7:1 for names, 4.5:1 for bubbles
- ✅ `prefers-reduced-motion: reduce` disables all CSS animations (`globals.css:418-438`)
- ✅ Focus-visible rings on all buttons via CVA base class (`button.tsx:8`)
- ✅ `aria-live` regions for new messages (`message-list.tsx:330`), rate limit banner (`messages-remaining-banner.tsx:27`), char counter (`chat-input.tsx:173`)
- ✅ Safe-area-insets on chat input (`chat-input.tsx:112`), header (`chat-header.tsx:240`), cookie consent (`cookie-consent.tsx:42`)
- ✅ 44px touch targets on all header buttons via `min-w-[44px] min-h-[44px]` (`chat-header.tsx:397,431,451,463,479`)
- ✅ iOS zoom prevention with `text-[16px]` on textarea (`chat-input.tsx:169`)
- ✅ Focus trap + Escape + focus restoration in `avatar-lightbox.tsx:18-43`
- ✅ `role="dialog"` + `aria-modal` + `aria-label` on lightbox (`avatar-lightbox.tsx:54-56`)
- ✅ `role="log"` + `aria-label` on message list (`message-list.tsx:337`)
- ✅ `role="alertdialog"` on cookie consent (`cookie-consent.tsx:44`)
- ✅ Screen reader announcements for new AI messages (`message-list.tsx:294-298`)
- ✅ Loading skeletons with `role="status"` + `aria-label` (`message-list.tsx:16`, `chat/loading.tsx:5`)
- ✅ Empty state welcome with confetti (`message-list.tsx:55-120`)
- ✅ History error + retry button (`message-list.tsx:360-375`)
- ✅ WYWA divider with `role="separator"` (`message-list.tsx:417`)

---

## 1. Accessibility

### 1.1 Issues Found

| # | Severity | Component | Line | Issue | Fix |
|---|----------|-----------|------|-------|-----|
| A1 | Low | `avatar-lightbox.tsx` | 85 | Close button `py-1.5` = ~30px tall; below 44px touch target minimum | Add `min-h-[44px] min-w-[44px]` or increase padding |
| A2 | Low | `pwa-install-prompt.tsx` | 51-53 | Install button `py-1.5` = ~30px tall; below 44px | Add `min-h-[44px]` |
| A3 | Low | `pwa-install-prompt.tsx` | 57-63 | Dismiss X button `p-1` = ~20px; far below 44px | Change to `p-2.5` or add `min-w-[44px] min-h-[44px]` |
| A4 | Low | `message-item.tsx` | 367-381 | Like/Reply/Flag action buttons: icon `w-3 h-3` with `p-2 -m-1.5` = effective ~28px tap area | Increase to `p-2.5` or add `min-w-[44px] min-h-[44px]` |
| A5 | Low | `cookie-consent.tsx` | 52-57 | "Got it" button `py-1.5` = ~30px | Add `min-h-[44px]` |
| A6 | Info | `messages-remaining-banner.tsx` | 35-39 | "Upgrade" link has no min touch target | Wrap in larger tap area or add padding |
| A7 | Info | `landing-page.tsx` | 778 | Demo carousel `tabIndex={0}` on div — consider `role="region"` already present, good |
| A8 | Low | `chat-header.tsx` | 342-370 | Mobile avatar buttons are `w-8 h-8` = 32px, below 44px minimum. The `-space-x-2` overlap further reduces effective tap area | Consider `w-10 h-10` or add transparent padding |

### 1.2 No Issues (Confirmed Good)
- All form inputs have `aria-label` (auth-wall, chat-input, settings)
- Dialog components use Radix primitives with built-in focus trap
- Error pages use `role="alert"` (`error.tsx:17`)
- Theme toggle has `aria-label` everywhere
- Report flag button has `aria-label` with state (`message-item.tsx:393`)
- Retry button for failed messages is accessible (`message-item.tsx:448-458`)

---

## 2. New Components

### 2.1 `avatar-lightbox.tsx`
- ✅ Portal rendering, focus trap, Escape handling, focus restoration
- ✅ `aria-modal`, `role="dialog"`, `aria-label` with character name
- ✅ Backdrop click to close
- ⚠️ A1: Close button touch target undersized

### 2.2 `pwa-install-prompt.tsx`
- ✅ Dismissal persists to localStorage
- ✅ `aria-label` on dismiss button
- ✅ Animate-in on appear
- ⚠️ A2/A3: Both buttons below 44px touch target
- ⚠️ Missing `role="alert"` or `aria-live` — prompt appears dynamically but isn't announced to screen readers

### 2.3 Account Settings Forms (settings-panel.tsx)
- ✅ Change Email form: input validation, loading state, success/error feedback
- ✅ Change Password form: min-length validation, feedback messages
- ✅ All destructive actions (Delete Chat, Delete Memories, Delete Account) behind confirmation dialogs
- ✅ `DialogDescription` present in all modals (Radix accessibility)
- ✅ Theme buttons use `aria-pressed`
- ✅ Notifications section handles all states: unsupported, denied, loading, subscribed, unsubscribed

### 2.4 Message Report Flag (`message-item.tsx`)
- ✅ `aria-label` changes between "Report message" / "Message reported"
- ✅ Disabled after reporting
- ✅ Hidden by default, visible on hover/focus (`opacity-0 group-hover:opacity-100 focus:opacity-100`)
- ✅ Analytics tracking on report

### 2.5 History Retry Button (`message-list.tsx:364-372`)
- ✅ Visible only when `historyError` is true
- ✅ Clear error messaging "Could not load chat history"
- ✅ Styled consistently with rounded-full pill pattern

### 2.6 Message Retry Button (`message-item.tsx:448-458`)
- ✅ Only shown when `deliveryStatus === 'failed'`
- ✅ Destructive styling with border + hover state
- ✅ Text label "Retry" is clear

---

## 3. Responsive Design

| Aspect | Status | Notes |
|--------|--------|-------|
| Chat bubbles | ✅ | `max-w-[82vw] sm:max-w-[66vw] lg:max-w-[34rem]` — good breakpoints |
| Chat input | ✅ | Safe-area padding, `max-w-3xl mx-auto`, responsive text size |
| Header | ✅ | Desktop avatar preview (hover card) hidden on mobile, mobile gets tap-to-lightbox |
| Landing page | ✅ | Hero responsive `text-5xl sm:text-7xl lg:text-[5.5rem] xl:text-[7.9rem]`, flex→grid layouts |
| Demo carousel | ✅ | Single carousel for all breakpoints, arrow + dot nav |
| Settings panel | ✅ | `flex-col sm:flex-row` patterns throughout |
| Paywall popup | ✅ | `max-h-[90dvh] overflow-y-auto` prevents cutoff on small screens |
| PWA prompt | ✅ | Fixed bottom position with safe-area offset (`bottom-24`) |
| Cookie consent | ✅ | `flex-col sm:flex-row`, safe-area bottom |
| 404 / Error pages | ✅ | Centered layout, `min-h-dvh`, responsive text |

---

## 4. Loading / Error / Empty States

| Route/Component | Loading | Error | Empty |
|----------------|---------|-------|-------|
| `/chat` | ✅ `loading.tsx` (LottieLoader) | ✅ `error.tsx` | ✅ `EmptyStateWelcome` with confetti |
| `/pricing` | ✅ `loading.tsx` | ✅ `error.tsx` | N/A |
| `/settings` | ✅ `loading.tsx` | ✅ `error.tsx` | N/A |
| `/checkout/success` | ✅ `loading.tsx` | ✅ `error.tsx` | N/A |
| `/onboarding` | N/A | ✅ `error.tsx` | N/A |
| `/about`, `/privacy`, `/terms` | N/A | ✅ `error.tsx` each | N/A |
| Global | N/A | ✅ `global-error.tsx` | N/A |
| 404 | N/A | N/A | ✅ `not-found.tsx` |
| Message list | ✅ `ChatSkeleton` | ✅ `historyError` with retry | ✅ `EmptyStateWelcome` |
| History loading | ✅ "Loading earlier messages" button | ✅ Retry on error | N/A |
| Notifications | ✅ "Checking notification status..." | ✅ "blocked" and "unsupported" states | N/A |

**Coverage: Complete.** Every route has error boundaries. Loading states cover all async routes.

---

## 5. Design Consistency

### 5.1 Spacing
- ✅ Consistent `p-6` for settings sections, `p-8` for dialogs
- ✅ `gap-2` / `gap-3` / `gap-4` used consistently within component families
- ✅ Section labels always `text-[10px] uppercase tracking-widest text-muted-foreground`

### 5.2 Colors
- ✅ OKLCH color system in `globals.css` for both light/dark
- ✅ Semantic tokens used everywhere (`text-foreground`, `bg-card`, `text-muted-foreground`)
- ✅ Destructive actions use `text-destructive` / `bg-destructive`
- ✅ Wallpapers have both light + dark variants for all 7 options

### 5.3 Typography
- ✅ Message text: `text-[14px] sm:text-[14.5px]` consistent
- ✅ Meta text: `text-[10px]` / `text-[11px]` for timestamps, labels
- ✅ Headings in settings: `text-2xl font-black` for username
- ✅ Section labels: `text-[10px] uppercase tracking-widest`

### 5.4 Border Radius
- ✅ Sections: `rounded-3xl` consistently
- ✅ Buttons: `rounded-full` for pills, `rounded-xl` for form buttons
- ✅ Chat input: `rounded-[22px]` per design system
- ✅ Dialogs: `rounded-[2rem]` for auth-wall and paywall
- ✅ Message bubbles: `rounded-[20px]` with WhatsApp-style corner flattening

### 5.5 Minor Inconsistency
| # | Component | Issue |
|---|-----------|-------|
| D1 | `error.tsx:23` | "Try again" button uses `rounded-lg` — inconsistent with `rounded-full` pill pattern used everywhere else |
| D2 | `not-found.tsx:18` | Same `rounded-lg` inconsistency on "Back to MyGang" |

---

## 6. Theme Support

| Component | Light | Dark | Notes |
|-----------|-------|------|-------|
| Message bubbles | ✅ | ✅ | Dynamic RGB with light/dark branches in `message-item.tsx:229-231` |
| Persona names | ✅ | ✅ | `ensureReadablePersonaNameOnLight` for light, white-mix for dark |
| Chat header | ✅ | ✅ | `chat-header-desktop` CSS overrides in `globals.css:318-325` |
| Chat input | ✅ | ✅ | `chat-input-desktop` CSS overrides |
| Landing page | ✅ | ✅ | All sections use semantic tokens + `dark:` variants |
| Cookie consent | ✅ | ✅ | Semantic tokens |
| Paywall | ✅ | ✅ | Semantic tokens with `dark:` text variants |
| Settings | ✅ | ✅ | Theme toggles with `aria-pressed` |
| Wallpapers | ✅ | ✅ | Full light+dark CSS for all 7 wallpapers |
| Film grain | ✅ | ✅ | `.dark .landing-grain` reduces opacity |
| Inline toast | ✅ | ✅ | Explicit `dark:text-white` / `dark:border-white/10` |

**All components fully support both themes.**

---

## 7. Touch Targets

| Component | Size | Pass? |
|-----------|------|-------|
| Chat header buttons (refresh, vault, theme, settings) | `min-w-[44px] min-h-[44px]` | ✅ |
| Chat send button | `w-11 h-11` (44px) | ✅ |
| Chat textarea | `min-h-[44px]` | ✅ |
| Starter chips | `px-3.5 py-2` (~36px tall) | ⚠️ Borderline |
| Landing CTA buttons | `py-6 sm:py-10` | ✅ |
| Demo carousel arrows | `w-11 h-11` (44px) | ✅ |
| Demo carousel dots | `min-w-[44px] min-h-[44px]` | ✅ |
| Message like/reply/flag | `p-2 -m-1.5` (~28px effective) | ❌ A4 |
| Avatar lightbox close | `px-4 py-1.5` (~30px) | ❌ A1 |
| PWA install button | `px-4 py-1.5` (~30px) | ❌ A2 |
| PWA dismiss button | `p-1` (~20px) | ❌ A3 |
| Cookie "Got it" | `px-4 py-1.5` (~30px) | ❌ A5 |
| Mobile header avatars | `w-8 h-8` (32px) | ❌ A8 |
| Settings panel buttons | Standard Button sizes | ✅ |
| Auth-wall form buttons | `h-12 sm:h-14` | ✅ |

---

## 8. Action Items (Priority Order)

### High Priority
None — no critical accessibility or usability blockers.

### Medium Priority
1. **A4**: Increase message action button tap targets to 44px (`message-item.tsx:367-408`)
2. **A8**: Increase mobile avatar tap targets in header (`chat-header.tsx:342-370`)

### Low Priority
3. **A1**: Lightbox close button touch target (`avatar-lightbox.tsx:85`)
4. **A2/A3**: PWA prompt button touch targets (`pwa-install-prompt.tsx:51-63`)
5. **A5**: Cookie consent button touch target (`cookie-consent.tsx:52`)
6. **D1/D2**: Standardize error/404 button radius to `rounded-full` (`error.tsx:23`, `not-found.tsx:18`)
7. Add `role="status"` or `aria-live="polite"` to PWA install prompt wrapper (`pwa-install-prompt.tsx:47`)

---

## Overall Grade: **A-**

Strong accessibility foundation, complete loading/error/empty state coverage, consistent design system, full theme support. The remaining issues are minor touch target sizing and two cosmetic radius inconsistencies. The v1 audit improvements are all properly implemented and verified.
