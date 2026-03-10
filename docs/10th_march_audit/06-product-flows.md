# Product Strategy & User Flow Review

## Summary

Thoughtfully designed product with one of the smoothest landing-to-chat funnels in an indie app. Onboarding under 60 seconds, paywall timing well-calibrated, conversion flow multi-touchpoint without being annoying. Key gaps: paid users can't manage squad after onboarding, pricing not linked from landing page (it's public but undiscoverable), and email signup confirmation leaves users in limbo.

---

## User Flow Map

```
Landing Page (/)
    |
    +--> [CTA: "Assemble Your Gang"] --> Auth Wall (modal)
    |         |
    |         +--> Google OAuth --> /auth/callback --> /post-auth --> /onboarding or /chat
    |         +--> Email/Password --> /post-auth --> /onboarding or /chat
    |
    +--> [Authenticated user auto-redirect] --> /chat or /onboarding
    |
    +--> Footer links: /about, /privacy, /terms

Onboarding (/onboarding) [4 steps]
    WELCOME --> IDENTITY (name) --> SELECTION (pick 2-4 chars) --> INTRO (rename) --> LOADING --> /chat

Chat (/chat)
    |
    +--> Memory Vault (drawer)
    +--> Chat Settings (sheet) --> link to /settings (discoverable but buried)
    +--> Pricing (/pricing via paywall, banner, or settings)

Settings (/settings)
    Account | Plan & Upgrade | Usage | Data Management | Account Actions | Legal
```

---

## Findings

### [MEDIUM] No Squad Management for Paid Users After Onboarding

**Flow:** Chat (paid user) → wants to add 5th or 6th member

**Issue:** `UpgradePickerModal` only fires on tier change events. Paid users who picked fewer characters during onboarding have no visible UI to add more up to their tier limit. "Manage Squad" in chat-settings links to /settings, but settings has no squad management section. Only option is "Start Fresh" (loses history).

**Impact:** Dead end for "I want more friends" user need. Paid users can't use their full squad allowance.

**Fix:** Add squad management UI in chat-settings or settings page.

---

### [MEDIUM] Pricing Not Linked From Landing Page

**Flow:** New visitor → wants to see pricing before signing up

**Issue:** `/pricing` IS a public route (accessible by URL), but the landing page has no link to it. All navigation paths to pricing require being authenticated. Visitors who want to see costs before creating an account have no organic path.

**Impact:** Conversion funnel gap. Price-sensitive users may bounce.

**Fix:** Add "Pricing" link to landing page nav bar or footer.

---

### [MEDIUM] Email Signup Confirmation Leaves User in Limbo

**Flow:** Auth wall → email signup → "Check your email to confirm"

**Issue:** Message displayed in green (styled as success), but auth wall stays open. No clear next action guidance. "Continue" button still visible but useless. User doesn't know to close dialog, check email, and return.

**Fix:** Transform dialog to show clear instructions + "Got it" button that closes dialog.

---

### [LOW] Onboarding Max Squad Hardcoded to 4

**Flow:** Paid user does "Start Fresh" → Selection Step

**Issue:** `SelectionStep` defaults `maxMembers` to 4 (free tier limit). Paid users (5-6 slots) are capped at 4 during re-onboarding.

**Fix:** Pass tier-based squad limit from `getSquadLimit()`.

---

### [LOW] Free Users See "Memory Active" Misleadingly

**Flow:** Chat (free user) → sees "4 online . Memory active" in header

**Issue:** `memoryActive` hardcoded to `true`. Free users see "Memory active" but memories aren't injected into prompts. Technically true (memories are saved), but user doesn't understand the distinction.

**Fix:** Change to "Memory saving" for free tier, or add explanation in Memory Vault free-tier state.

---

### [LOW] Settings Path From Chat is Buried (Not Missing)

**Flow:** Chat → gear icon → Chat Settings sheet → small link to /settings

**Issue:** Path exists but is hard to find. Account management buried 2 taps deep inside a feature-focused panel. Users wanting to sign out or manage subscription may not discover it.

**Fix:** Add clearer "Account" link at top of chat-settings sheet.

---

### [LOW] Auth Error Page Has Two Buttons to Same Destination

**Issue:** "Try Again" and "Back Home" both link to `/`. "Try Again" sets false expectation of retrying auth.

**Fix:** Remove one button or have "Try Again" navigate to `/?auth=open`.

---

### [LOW] Post-Auth Timeout Gives No Explanation

**Issue:** 8s timeout silently redirects to landing page. User doesn't know what happened.

**Fix:** Redirect to `/?auth_timeout=true` with explanatory toast.

---

## What's Done Well

1. **Demo Carousel** — 3 threads showcasing emotional support, advice, and casual banter with live typing indicators
2. **Sub-60s Onboarding** — 4 steps, progress dots, back nav, skip option on rename
3. **Paywall with Activities** — real-time refill bar, contextual activities while waiting, "Try sending" button
4. **Ghost Memories** — blurred real memories with count = powerful personalized conversion hook
5. **Post-Purchase Celebration** — confetti + character celebration message = complete emotional arc
6. **Resume Banner** — "Welcome back" with context makes characters feel persistent
7. **Dual Settings Architecture** — lightweight chat-settings (sheet) vs full settings (page) is correct separation
8. **Recovery-Oriented Error States** — every error has "Try again" + reassuring copy
9. **Starter Chips** — reduce blank-page paralysis, communicate casual tone
10. **Tier Comparison Table** — clear cards + full table, mobile-optimized, FAQ addresses real objections
11. **Empathetic Downgrade** — "Will be paused" not "removed," "Decide for me" option
