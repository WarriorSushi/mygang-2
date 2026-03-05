# Frontend UI/UX & Components Audit Report

**Project:** MyGang by Antig
**Date:** 2026-02-16
**Auditor:** Claude Opus 4.6

---

## CRITICAL Issues

### 1. CRITICAL: Label component uses deprecated `forwardRef` pattern

**File:** `src/components/ui/label.tsx` (lines 13-24)

Uses `React.forwardRef` which is deprecated in React 19. All other shadcn/ui components in the project use the modern function component pattern with `ref` as a regular prop. This inconsistency suggests the Label was generated from an older template.

**Recommendation:** Rewrite to match the pattern used in other components (e.g., `button.tsx`, `input.tsx`).

---

## HIGH Issues

### 2. HIGH: Landing page has no clear CTA hierarchy

**File:** `src/components/landing/landing-page.tsx`

The landing page uses animated blobs and glass cards but the primary call-to-action may not stand out enough against the visual noise. Users need to immediately understand:
- What the app is
- Why they should care
- What to do next (sign up / start chatting)

**Recommendation:** Ensure the primary CTA button has high contrast, larger size, and is above the fold on mobile.

### 3. HIGH: No loading skeletons for chat history

**File:** `src/components/chat/message-list.tsx`

When loading older history or bootstrapping, the user sees either nothing or a spinner. Premium apps use skeleton loading states that match the shape of the content.

**Recommendation:** Add skeleton message bubbles that animate during loading.

### 4. HIGH: Chat input lacks visual polish for premium feel

**File:** `src/components/chat/chat-input.tsx`

The chat input is functional but basic. To feel premium:
- Add subtle glow/focus animation
- Show character count approaching limit
- Add haptic-style visual feedback on send
- Smooth send button transition (disabled -> enabled)

### 5. HIGH: Settings panel may not feel polished

**File:** `src/components/settings/settings-panel.tsx`

Settings panels in premium apps need:
- Smooth transitions between options
- Visual confirmation of saved changes
- Grouped sections with clear hierarchy
- Responsive layout that works well on mobile sheets

### 6. HIGH: Onboarding flow lacks progress indication

**File:** `src/app/onboarding/page.tsx`

Multi-step onboarding (welcome -> identity -> selection -> loading) should show a progress bar or step indicator so users know how much is left.

---

## MEDIUM Issues

### 7. MEDIUM: Background blobs may cause jank on low-end devices

**File:** `src/components/holographic/background-blobs.tsx`

Animated gradient blobs using CSS animations can cause high GPU usage on mobile devices, especially with `backdrop-blur`. The `isMuted` prop helps but may not be enough.

**Recommendation:** Add a `prefers-reduced-motion` media query to disable animations. Consider using `will-change: transform` sparingly.

### 8. MEDIUM: No keyboard navigation for chat interactions

**File:** `src/components/chat/message-item.tsx`

Reply and like actions on messages likely require mouse/touch interaction. For accessibility:
- Messages should be keyboard-focusable
- Actions should be accessible via keyboard shortcuts
- Focus management after sending a message

### 9. MEDIUM: Missing ARIA labels on interactive elements

Several components may be missing proper ARIA labels:
- Chat header icons (settings, memory vault)
- Message action buttons (reply, like)
- Onboarding selection cards

### 10. MEDIUM: Dark mode may have contrast issues

The project uses `next-themes` for dark mode. Common issues:
- Text on glass/blur backgrounds can be hard to read
- Muted foreground colors may not meet WCAG AA contrast ratios
- Border colors may be invisible in dark mode

**Recommendation:** Audit all color combinations with a contrast checker.

### 11. MEDIUM: No empty state design for new users

When a user first opens chat with no messages, the experience should feel inviting, not empty. Consider:
- Character introduction cards
- Suggested conversation starters
- Visual illustration of the chat concept

### 12. MEDIUM: Mobile bottom sheet for settings may conflict with browser chrome

**File:** `src/components/chat/chat-settings.tsx`

Bottom sheets on mobile can conflict with browser navigation bars, especially on iOS Safari where the URL bar collapses/expands.

### 13. MEDIUM: PWA manifest needs review

**File:** `public/manifest.json`

Ensure:
- All required icon sizes are present (192x192, 512x512)
- `theme_color` matches the app's actual theme
- `background_color` matches splash screen
- `display: "standalone"` is set for native-like experience
- `start_url` is correct

### 14. MEDIUM: Unused default Next.js assets in public folder

**Files:** `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`

These are default `create-next-app` assets that are not used anywhere in the app.

**Recommendation:** Delete all unused SVGs from public folder.

---

## LOW Issues

### 15. LOW: Error boundary is basic
**File:** `src/components/orchestrator/error-boundary.tsx` - Should show a user-friendly error state, not just a fallback.

### 16. LOW: Glass card component may not render well on all browsers
**File:** `src/components/holographic/glass-card.tsx` - Backdrop-filter support varies. Add a solid fallback.

### 17. LOW: Auth wall transition could be smoother
**File:** `src/components/orchestrator/auth-wall.tsx` - The transition between guest and authenticated states should feel seamless.

### 18. LOW: Performance monitor should be dev-only
**File:** `src/components/orchestrator/perf-monitor.tsx` - Ensure this doesn't run in production builds.

### 19. LOW: Squad reconcile dialog appears for edge cases
**File:** `src/components/orchestrator/squad-reconcile.tsx` - Should be rare but needs good UX when it does appear.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 5 |
| MEDIUM | 8 |
| LOW | 5 |

## Priority Recommendations

1. **Fix the deprecated Label component** to use React 19 patterns.
2. **Add loading skeletons** for chat history -- instant premium feel upgrade.
3. **Delete unused public assets** (file.svg, globe.svg, next.svg, vercel.svg, window.svg).
4. **Add progress indicators** to onboarding flow.
5. **Audit all colors** for WCAG AA contrast compliance.
6. **Add `prefers-reduced-motion`** support for animations.
7. **Design an empty state** for new chat sessions with conversation starters.
8. **Add keyboard navigation** for chat message interactions.
9. **Polish the chat input** with focus animations, character count, and send feedback.
10. **Review PWA manifest** for completeness and correctness.
