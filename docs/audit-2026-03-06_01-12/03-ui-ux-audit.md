# UI/UX Audit -- MyGang.ai
**Date:** 2026-03-06
**Scope:** Full user journey, chat experience, visual design, mobile, onboarding, billing

---

## User Journey Map

```
Landing Page (/) --> AuthWall dialog --> Post-Auth (/post-auth) --> Onboarding (/onboarding)
    WELCOME --> IDENTITY --> SELECTION --> LOADING --> Chat (/chat)
                                                        |
                                                   Chat Settings (sheet)
                                                   Memory Vault (drawer)
                                                   Settings Page (/settings)
                                                   Pricing Page (/pricing)
                                                   Paywall Popup (dialog)
```

---

## HIGH IMPACT

### H1. No way to navigate back to landing or settings from chat (dead-end feel)
**File:** `src/app/chat/page.tsx`, `src/components/chat/chat-header.tsx`
The chat page has no visible navigation to `/settings`, `/pricing`, or home. The only way to reach settings is through the gear icon in chat-settings sheet, which itself requires knowing to tap the Settings2 icon. There is no hamburger menu, no sidebar, no breadcrumb.

**Recommendation:** Add a small user avatar or menu in the chat header that opens a navigation drawer with links to Settings, Pricing, and Sign Out. This prevents users from feeling trapped in the chat.

---

### H2. Auth wall has no "sign up" framing -- confusing for new users
**File:** `src/components/orchestrator/auth-wall.tsx`
The auth dialog title says "Sign in to continue" and the email/password form just says "Continue." New users do not know whether this creates an account or requires an existing one. The `signInOrSignUpWithPassword` action auto-handles both, but users do not see that.

**Recommendation:** Change the title to "Sign in or create an account" or add a subtitle like "New here? We will create your account automatically." Also show password requirements (min 6 chars) before submission, not as an error after.

---

### H3. Empty chat state is underwhelming and gives no guidance
**File:** `src/components/chat/message-list.tsx` (lines 261-266)
When a user first enters chat, they see a wave emoji and "Say hello to kick things off!" -- but no context about who their gang members are, what they can talk about, or example messages.

**Recommendation:**
- Show the selected gang members' avatars and names with a short intro like "Your gang is here: Luna, Kael, and Rico. Say anything to get started."
- Add 2-3 tappable suggestion chips (e.g., "How's everyone doing?", "Roast me", "I need advice") to lower the barrier to first message.

---

### H4. Paywall popup only offers Pro ($19.99) -- no Basic option
**File:** `src/components/billing/paywall-popup.tsx` (lines 97-105)
When the free tier cooldown triggers, the paywall popup only shows "Upgrade to Pro -- $19.99/mo." The Basic plan ($14.99) exists on the pricing page but is invisible in the paywall. Users who would convert at a lower price point are lost.

**Recommendation:** Show both plans in the paywall popup, or at minimum make the "View all plans" link more prominent (currently tiny, at the very bottom, low contrast).

---

### H5. Chat settings is overloaded and deeply nested
**File:** `src/components/chat/chat-settings.tsx`
The chat settings sheet contains: wallpaper picker, character renaming, chat mode toggle, screenshot, low-cost mode, ecosystem mode toggle, clear messages, sign out, delete account -- all in one scrollable panel with sub-panels (wallpaper, rename). This is a lot of cognitive load.

**Recommendation:**
- Move destructive actions (delete account, sign out) to the dedicated `/settings` page only.
- Keep chat-specific settings in the sheet: wallpaper, chat mode, persona roles toggle, screenshot.
- Add section headers with clear visual separation.

---

### H6. No confirmation or undo for "Clear all messages"
**File:** `src/components/chat/chat-settings.tsx`
The "Clear Messages" button triggers `deleteAllMessages()`. If there is a confirm dialog, it is a browser `confirm()` which is easy to accidentally accept. There is no way to recover deleted messages.

**Recommendation:** Use a custom confirmation dialog with the count of messages to be deleted, and a brief delay ("deleting in 3...2...1...") or an undo toast within 5 seconds.

---

### H7. Onboarding has no skip option and no explanation of what characters do
**File:** `src/components/onboarding/welcome-step.tsx`, `src/components/onboarding/selection-step.tsx`
The welcome step says "Your friends are waiting" but does not explain what kind of AI friends these are or what the app does. A user coming from a shared link may not have seen the landing page. The selection step shows character cards with archetype labels (e.g., "The Empath", "Chaos Gremlin") but no explanation of what archetypes mean for conversation behavior.

**Recommendation:**
- Add a one-sentence explanation on the welcome step: "Pick AI friends with real personalities. They will chat with you and each other."
- On the selection step, add a tooltip or brief explainer: "Archetypes affect how your gang talks -- pick personalities you vibe with."

---

## MEDIUM IMPACT

### M1. Typing indicator does not show which character will speak next
**File:** `src/components/chat/chat-header.tsx` (lines 153-168)
The typing indicator shows names (e.g., "Luna is typing...") but only in the header subtitle area, which is small and easy to miss. There is no inline typing indicator in the message list itself (like WhatsApp's typing bubble).

**Recommendation:** Add a small typing bubble at the bottom of the message list showing the character's avatar + animated dots. This is where the user's eyes are focused.

---

### M2. Message action buttons require long-press discovery
**File:** `src/components/chat/message-item.tsx` (lines 261-301)
Reply, Like, and Save actions are hidden behind a long-press (350ms) or right-click. There is no visual hint that messages are interactive. Desktop users must right-click. Most users will never discover these actions.

**Recommendation:**
- On desktop: show action buttons on hover (opacity transition, not requiring right-click).
- On mobile: add a subtle swipe-to-reply gesture or show a small "..." affordance on the bubble corner.
- On first use, show a one-time tooltip: "Long-press a message to reply or react."

---

### M3. The "Back to Chat" link on settings page is low-visibility
**File:** `src/app/settings/page.tsx` (lines 30-35)
The "Back to Chat" link is a tiny uppercase pill in the top-right corner, styled like a secondary action. Users may not find it.

**Recommendation:** Make it a more prominent back arrow button in the top-left, matching mobile navigation conventions.

---

### M4. Pricing page comparison table is hard to read on mobile
**File:** `src/app/pricing/page.tsx` (lines 436-460)
The comparison table uses a 4-column CSS grid (`1.5fr 1fr 1fr 1fr`). On narrow screens, the feature text column gets compressed and text wraps heavily, while the value columns have wasted space around tiny checkmarks.

**Recommendation:**
- On mobile (< 640px), switch to a stacked card layout per plan instead of the grid table.
- Or use a horizontal scroll with sticky first column.

---

### M5. Multiple overlapping theme toggles create confusion
**Files:** `src/components/chat/chat-header.tsx`, `src/components/chat/chat-settings.tsx`, `src/components/settings/settings-panel.tsx`, `src/components/landing/landing-page.tsx`
Theme can be toggled from: the landing page nav, the chat header, the chat settings sheet, and the settings page. Four different locations. The chat header and settings sheet toggles are right next to each other (both visible when the sheet is open).

**Recommendation:** Keep theme toggle in the chat header and settings page only. Remove it from the chat settings sheet to reduce clutter.

---

### M6. Post-auth page has an 8-second fallback timeout with no user feedback
**File:** `src/app/post-auth/page.tsx` (lines 93-98)
If auth resolution fails, the user stares at a spinner for up to 8 seconds before being silently redirected to the landing page. No error message is shown.

**Recommendation:** After 4 seconds, show a secondary message like "Taking longer than expected..." and after 8 seconds show "Something went wrong. Redirecting..." before the redirect.

---

### M7. Resume banner disappears after 4 seconds with no interaction possible
**File:** `src/app/chat/page.tsx` (lines 243-268)
The "Welcome back. It has been X days" banner auto-dismisses after 4 seconds. Users cannot interact with it or dismiss it manually. It also has very low contrast (`text-muted-foreground` at 10px).

**Recommendation:** Make the banner slightly larger, add a dismiss button, and extend the timer to 6 seconds. Consider making it sticky for returning users who have been away for days.

---

### M8. Character selection allows clicking "More" to expand details, but clicking the card also toggles selection
**File:** `src/components/onboarding/selection-step.tsx` (lines 138-151)
The "More" button uses `e.stopPropagation()` to prevent toggling selection when expanding details. However, the entire card is a click target for selection, which creates accidental selections when users are trying to read character details. This is especially problematic on mobile where touch targets overlap.

**Recommendation:** Split the card into two clear zones: a top avatar/name area that toggles selection, and a bottom info area with the "More" button that only expands details. Or use a dedicated checkbox/toggle button separate from the card body.

---

## LOW IMPACT

### L1. Inline toast position may overlap with chat input on short screens
**File:** `src/components/chat/inline-toast.tsx` (line 23)
The toast is positioned `fixed bottom-24`, which is 96px from the bottom. On short mobile screens or when the keyboard is up, this may overlap with the chat input area.

**Recommendation:** Position the toast relative to the chat input container rather than using a fixed bottom offset, or dynamically adjust based on viewport height.

---

### L2. Landing page demo carousel resets animation state when switching threads
**File:** `src/components/landing/landing-page.tsx` (lines 632-733)
Each time the user switches demo threads, the `LiveDemoCard` remounts and the bubble animation restarts from zero. If a user quickly cycles through demos, they see blank cards with only the typing indicator.

**Recommendation:** Debounce the carousel transition or show the first 2-3 messages immediately (pre-populated) and then animate the rest.

---

### L3. Character count hint on identity step could be clearer
**File:** `src/components/onboarding/identity-step.tsx` (lines 42-43)
The hint text says "1 more character needed" or "15/30" but uses `text-[10px] text-muted-foreground/60` which is nearly invisible.

**Recommendation:** Increase to at least 11px and use `text-muted-foreground/80` for better readability.

---

### L4. Loading step status messages reference characters the user may not have picked
**File:** `src/components/onboarding/loading-step.tsx` (lines 7-16)
Messages like "Waking up Rico..." and "Nyx is loading her sarcasm module..." appear regardless of which characters the user actually selected. This breaks immersion.

**Recommendation:** Filter the status messages to only show messages for the characters the user actually selected in the previous step.

---

### L5. Pricing page uses inline styles for the bottom CTA button
**File:** `src/app/pricing/page.tsx` (lines 575-615)
The bottom CTA uses raw inline `style` attributes and `onMouseEnter`/`onMouseLeave` handlers for hover effects instead of Tailwind classes. This is inconsistent with the rest of the codebase and harder to maintain.

**Recommendation:** Convert to Tailwind classes for consistency. Use `hover:` modifiers instead of JS event handlers.

---

### L6. No loading state when navigating from onboarding to chat
**File:** `src/app/onboarding/page.tsx` (lines 114-117)
After the "LOADING" step animation (2.2 seconds), `router.push('/chat')` fires. There is no feedback if the route transition takes additional time. The user may see a flash of the loading step before the chat renders.

**Recommendation:** Use `router.replace('/chat')` instead of `router.push('/chat')` to prevent back-navigation to the loading step. The loading step already provides visual feedback, so this is mostly about preventing the user from going back to it.

---

### L7. Dark mode wallpaper "midnight" has light mode colors in dark mode
**File:** `src/app/globals.css` (lines 276-292)
The "midnight" wallpaper has a special light-mode override and a dark-mode override, but the light-mode version uses `rgba(241, 245, 249, 0.98)` which is bright white. If a user somehow gets this wallpaper in light mode, it may look washed out against the already-light background.

**Recommendation:** This is a minor edge case but consider adjusting the light-mode midnight wallpaper to have slightly more contrast against the light background.

---

### L8. `prefers-reduced-motion` is respected but landing page parallax is not disabled
**File:** `src/components/landing/landing-page.tsx` (lines 200-205)
The landing page uses `useReducedMotion()` for the logo rotation but still applies scroll-driven parallax (`heroY`, `heroScale`) via Framer Motion regardless of the reduced motion preference. CSS animations are properly disabled in `globals.css` but the JS-driven scroll transforms are not.

**Recommendation:** Check `prefersReducedMotion` and skip the parallax transforms when true.

---

### L9. Scroll-to-bottom button on message list could show unread count
**File:** `src/components/chat/message-list.tsx` (lines 323-342)
When the user scrolls up and new messages arrive, a "jump to latest" button appears. It does not indicate how many new messages are below.

**Recommendation:** Add a small badge showing the count of unseen messages (e.g., "3 new") on the scroll-to-bottom button.

---

### L10. Auth wall email form shows no password requirements upfront
**File:** `src/components/orchestrator/auth-wall.tsx` (lines 71-74)
Password validation (min 6 chars) only triggers as an error after submission. Users discover the requirement through failure.

**Recommendation:** Add a subtle hint below the password field: "Min 6 characters" or validate inline as the user types.

---

## Summary

| Priority | Count | Key Themes |
|----------|-------|------------|
| HIGH     | 7     | Navigation dead ends, auth confusion, empty states, paywall conversion, settings overload, onboarding clarity |
| MEDIUM   | 8     | Typing indicators, action discoverability, mobile tables, redundant controls, error feedback |
| LOW      | 10    | Toast positioning, animation polish, inline styles, accessibility, loading states |

**Top 3 quick wins (high impact, low effort):**
1. **H3** -- Add suggestion chips to the empty chat state
2. **H2** -- Clarify auth wall copy for new users
3. **L4** -- Filter loading step messages to selected characters

**Top 3 strategic improvements (high impact, higher effort):**
1. **H1** -- Add proper navigation from chat to settings/pricing
2. **H4** -- Show Basic plan option in paywall popup
3. **M1** -- Add inline typing indicator in message list
