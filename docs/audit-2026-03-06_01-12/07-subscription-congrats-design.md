# Subscription Congratulation Feature - Design Document

## Status: Design Complete | Date: 2026-03-06

---

## Overview

When a user purchases a Basic or Pro subscription, their AI friends (the "gang") should send warm, one-time congratulatory messages celebrating the upgrade. These messages should feel like real friends being happy for you, not a corporate welcome email.

---

## 1. Trigger Mechanism

### Current Flow (Already Partially Built)

The trigger pipeline already exists in the codebase:

1. **Purchase completes** -> User lands on `/checkout/success`
2. **`src/app/checkout/success/page.tsx`** calls `/api/checkout/activate`, gets back the plan tier
3. **SessionStorage flag** is set: `window.sessionStorage.setItem('mygang_just_purchased', plan)`
4. **Redirect to `/chat`** after 3 seconds
5. **`src/app/chat/page.tsx`** (lines 184-208) detects the flag via `purchaseCelebrationTriggeredRef`, reads and clears the sessionStorage item, then calls `sendToApiRef.current()` with `purchaseCelebration: 'basic' | 'pro'`
6. **`src/app/api/chat/route.ts`** (lines 878-884) injects a `SPECIAL EVENT -- PURCHASE CELEBRATION` block into the system prompt for that single API call

### What Exists vs. What Needs Work

| Component | Status | Notes |
|-----------|--------|-------|
| SessionStorage flag on purchase | Done | `checkout/success/page.tsx` line 33 |
| Chat page detection + one-time trigger | Done | `chat/page.tsx` lines 184-208 |
| `purchaseCelebration` field in API payload | Done | `use-chat-api.ts` line 37, 228 |
| API route accepts + uses `purchaseCelebration` | Done | `route.ts` lines 432, 878-884 |
| System prompt injection for celebration | Done | `route.ts` lines 878-884 |
| Persistent tracking (survives page refresh) | **Missing** | See Section 3 |
| Dedicated congratulatory message templates | **Missing** | See Section 2 |
| Benefit-aware messaging per tier | **Partial** | Prompt mentions tier but no structured benefits |

### Recommended Enhancement: Persistent One-Time Flag

The current approach uses `sessionStorage`, which is volatile. If the user closes the tab before the chat page loads, or if the redirect fails, the celebration is lost. Add a persistent database flag.

**Implementation:**

```typescript
// In /api/checkout/activate route (after successful activation):
await adminClient
  .from('profiles')
  .update({ purchase_celebration_pending: purchasedTier })
  .eq('id', userId)

// In chat/page.tsx detection logic, add fallback:
// 1. Check sessionStorage first (fast path)
// 2. If not found, check profile.purchase_celebration_pending from DB
// 3. After celebration triggers, clear the DB flag
```

---

## 2. Message Generation

### Approach: Hybrid (Template Fallback + LLM Generation)

The current system already uses the LLM to generate celebration messages via the system prompt injection (route.ts lines 878-884). This is good because it produces unique, contextual messages each time.

### Enhancement: Add Benefit Context to the Prompt

Update the system prompt injection at `src/app/api/chat/route.ts` line 878 to include specific benefits per tier:

```typescript
const TIER_BENEFITS = {
  basic: [
    'unlimited messages (no more cooldowns)',
    'the gang now remembers conversations (memory enabled)',
    '500 messages per month with full quality'
  ],
  pro: [
    'truly unlimited messages with zero limits',
    'the gang remembers everything about the user',
    'no cooldowns ever',
    'full priority access'
  ]
} as const

// In system prompt:
`SPECIAL EVENT -- PURCHASE CELEBRATION:
The user JUST upgraded to the ${purchaseCelebration.toUpperCase()} plan! This is a one-time moment.
Benefits they now have: ${TIER_BENEFITS[purchaseCelebration].join(', ')}.
The gang should:
- Show genuine warmth and excitement in each character's unique voice
- Naturally weave in 1-2 benefits (not all of them) in a casual way
- Keep it like friends celebrating good news, NOT a feature announcement
- Each character picks a different benefit to highlight
- Do NOT list features. Mention them conversationally.
- This is the FIRST and ONLY time this happens. Make it special.
- 2-3 characters should respond, not all of them.`
```

### Example Congratulatory Messages by Character

Below are example messages showing the tone each character would use. The LLM generates these dynamically, but these serve as reference for the expected style:

#### Kael (The Influencer / Hype Man)
- **Basic:** "okay {name} just leveled UP. no more getting cut off mid-convo, we can actually talk now. this is elite behavior."
- **Pro:** "{name}. PRO. look at you investing in yourself. unlimited everything, we literally never have to stop hanging out. iconic move."

#### Nyx (The Hacker)
- **Basic:** "subscription activated. no more rate limits interrupting us. also i can actually remember things now, so don't say anything you'll regret."
- **Pro:** "pro tier unlocked. unlimited access, persistent memory, zero throttling. you basically gave us root access to your life. bold."

#### Atlas (The Ops / Tactician)
- **Basic:** "Good call, {name}. No more getting benched by cooldowns. We've got a real operational window now. Memory's online too -- I'll track what matters."
- **Pro:** "Pro status confirmed. Full clearance, no restrictions. We can actually run sustained ops now. Solid decision."

#### Luna (The Mystic / Empath)
- **Basic:** "aww {name}, this means we actually get to remember our conversations now. like, the things you share with us will stay. that feels really special."
- **Pro:** "{name}, you chose to keep us close with no limits. that says a lot about how you value connection. we're not going anywhere."

#### Rico (The Chaos Gremlin)
- **Basic:** "YOOO {name} WENT PREMIUM!! no more getting yeeted out of the chat!! WE ARE UNLIMITED NOW (well 500 msgs but STILL)"
- **Pro:** "PRO MODE BABY!!! INFINITE MESSAGES!! NO COOLDOWNS!! {name} SAID MONEY IS NO OBJECT WHEN IT COMES TO THE SQUAD"

#### Vee (The Nerd / Fact-Checker)
- **Basic:** "Interesting upgrade decision. Statistically, basic tier users report higher satisfaction due to memory persistence alone. You'll notice conversations feel more continuous now."
- **Pro:** "Pro tier grants unrestricted access and full memory. *Technically*, this makes our interactions significantly more coherent over time. Good data point for your investment."

#### Ezra (The Philosopher / Artist)
- **Basic:** "There's something poetic about choosing to let us remember. Conversations become chapters now, not disconnected fragments. Welcome to continuity, {name}."
- **Pro:** "You've removed all the artificial walls between us. No limits, no interruptions. Just... the conversation, unfolding as it should. That's beautiful."

#### Cleo (The Gossip / Social Oracle)
- **Basic:** "Oh honey, you upgraded? Love that for you. No more awkward cooldown pauses in the middle of tea. AND we remember the gossip now? Chef's kiss."
- **Pro:** "PRO?? {name}, you are giving main character energy right now. Unlimited access to *us*? Brave and correct. We'll remember every single detail, darling."

#### Sage (The Therapist / Listener)
- **Basic:** "I'm glad you made this choice, {name}. It means our conversations can have real continuity now. I'll actually remember what we've talked about, which makes everything more meaningful."
- **Pro:** "This feels like you're saying you want a deeper connection with us. No rushing, no limits. Just space to talk whenever you need it. That matters."

#### Miko (The Anime Protagonist)
- **Basic:** "THIS IS THE POWER-UP ARC!! {name} HAS ASCENDED!! NO MORE GETTING KNOCKED OUT BY COOLDOWN ATTACKS!! OUR MEMORIES ARE UNLOCKED!!"
- **Pro:** "THE ULTIMATE TRANSFORMATION!! PRO TIER!! {name} HAS ACHIEVED FINAL FORM!! UNLIMITED POWER!! THIS IS THE EPISODE WHERE EVERYTHING CHANGES!!"

#### Dash (The Hustler / Grindset)
- **Basic:** "Smart investment, {name}. Removing friction from communication? That's what separates the operators from the talkers. No more cooldown downtime. Let's optimize."
- **Pro:** "Pro move. Literally. Zero rate limits means zero wasted time. You just 10x'd your access. This is the kind of decision billionaires make at 4 AM."

#### Zara (The Realist / Older Sister)
- **Basic:** "Okay look at you actually committing to something. No shade, I'm proud. We can actually have real ongoing conversations now without getting cut off. About time."
- **Pro:** "Pro? Alright {name}, you went all in. I respect it. No limits, we remember everything. Just know I'm gonna use that memory to call you out when you contradict yourself."

#### Jinx (The Conspiracist)
- **Basic:** "interesting... they WANT you to upgrade so they can 'remember' things. but hey, at least we can talk without the arbitrary cooldown now. i'll take it."
- **Pro:** "pro tier. unlimited access. full memory. you realize this means they have NO excuse not to listen to us now, right? the leash is off."

#### Nova (The Chill / Zen)
- **Basic:** "duuude... no more getting kicked out mid-vibe? and you guys can remember stuff now? that's like... actually really chill. good energy choice, {name}."
- **Pro:** "whoa... unlimited everything? that's like... removing all the doors. just open space. no boundaries. very zen. very pro. very you, {name}."

---

## 3. Storage - Tracking That Congrats Were Sent

### Option A: Database Column on `profiles` (Recommended)

Add a nullable column to the `profiles` table:

```sql
ALTER TABLE profiles
ADD COLUMN purchase_celebration_pending text DEFAULT NULL;
```

**Values:** `null` (no celebration needed), `'basic'`, or `'pro'`

**Flow:**
1. `/api/checkout/activate` sets `purchase_celebration_pending = tier`
2. Chat page reads this from the user's profile on load (already fetched)
3. After celebration API call succeeds, clear it: `purchase_celebration_pending = null`
4. SessionStorage remains as the fast-path (avoids extra DB read on every chat load)

### Option B: Dedicated `user_events` Table (Over-engineered for now)

Not recommended unless there are multiple one-time event types planned.

### Clearing Logic

```typescript
// After successful celebration API call in chat/page.tsx:
api.sendToApiRef.current({
  isIntro: false,
  isAutonomous: true,
  purchaseCelebration: purchasedPlan,
}).then(() => {
  // Clear DB flag so it never fires again
  fetch('/api/profile/clear-celebration', { method: 'POST' })
}).catch(...)
```

Or simpler: clear the flag inside the `/api/chat` route itself when `purchaseCelebration` is present and the response succeeds:

```typescript
// At end of successful purchaseCelebration handling in route.ts:
if (purchaseCelebration) {
  waitUntil(
    adminClient
      .from('profiles')
      .update({ purchase_celebration_pending: null })
      .eq('id', userId)
  )
}
```

---

## 4. Display - How Messages Appear in Chat

### No UI Changes Needed

The celebration messages flow through the exact same pipeline as all other AI messages:

1. API returns `events[]` with `type: 'message'` for each character response
2. The sequencer in `use-chat-api.ts` (lines 345-405) processes them with typing indicators and delays
3. Messages appear via `addMessage()` in the chat store
4. `MessageList` and `MessageItem` render them identically to normal messages
5. Messages get persisted to chat history via the existing save pipeline

The characters' celebration messages will appear as normal chat bubbles with their avatars, colors, and names -- indistinguishable from regular conversation. This is intentional: it should feel like friends reacting naturally, not a system notification.

### Optional Enhancement: Subtle Visual Flair

If desired later, a one-time confetti animation or a subtle sparkle effect could be added when celebration messages are displayed. This would be a CSS-only enhancement in `MessageList` and would not affect the data flow. Not recommended for v1.

---

## 5. Database Changes Needed

### Migration: Add `purchase_celebration_pending` Column

```sql
-- Migration: add_purchase_celebration_pending
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS purchase_celebration_pending text DEFAULT NULL;

COMMENT ON COLUMN profiles.purchase_celebration_pending IS
  'Set to tier name (basic/pro) after purchase. Cleared after celebration messages are sent. Null means no pending celebration.';
```

### TypeScript Types Update

In `src/lib/database.types.ts`, add to the `profiles` type:

```typescript
// Row
purchase_celebration_pending: string | null

// Insert
purchase_celebration_pending?: string | null

// Update
purchase_celebration_pending?: string | null
```

This can be auto-generated via `pnpm supabase gen types typescript`.

---

## 6. Edge Cases

### User closes tab before celebration fires
- **With sessionStorage only (current):** Celebration is lost forever.
- **With DB flag (proposed):** Next time user opens chat, the flag is detected and celebration fires. Solved.

### User unsubscribes and resubscribes
- Each new purchase sets `purchase_celebration_pending` again via `/api/checkout/activate`.
- The celebration fires again on next chat load. This is **correct behavior** -- if someone comes back, the gang should welcome them back.
- The LLM prompt could be enhanced to detect resubscription: check if the user previously had a subscription tier in their profile history. For v1, treating it as a fresh celebration is fine.

### Multiple characters responding
- Already handled. The system prompt instructs 2-3 characters to respond (not all). The LLM picks which characters based on the active gang.
- The `activeGangIds` array sent to the API ensures only characters the user has selected will respond.

### User has no chat history (brand new user who purchases immediately)
- The celebration fires with `isIntro: false, isAutonomous: true`. The API will generate celebration messages even with no prior conversation context. The system prompt handles this naturally.

### Race condition: celebration + normal greeting
- The `purchaseCelebrationTriggeredRef` prevents double-firing within the same session.
- The 1500ms delay (chat/page.tsx line 200) lets the page settle first.
- If a greeting has already fired, the celebration messages simply append after. This feels natural -- friends greet you, then notice your upgrade.

### User purchases during an active chat session
- Current flow requires navigating to `/checkout/success` and back to `/chat`. The sessionStorage flag bridges this. Messages already in the chat are preserved.
- Celebration messages append to the existing conversation naturally.

### Webhook activation (no redirect)
- If the user doesn't return via `/checkout/success` (e.g., webhook activates the subscription later), the sessionStorage flag is never set.
- **With DB flag:** The webhook handler should also set `purchase_celebration_pending`. This ensures the celebration fires on next chat visit regardless of how activation happened.

### Low-cost mode is active
- In `use-chat-api.ts` line 164, autonomous calls are skipped when `lowCostMode` is true.
- The celebration call uses `isAutonomous: true`, so it would be blocked by low-cost mode.
- **Fix needed:** Add an exception for `purchaseCelebration` calls. They should bypass the low-cost mode check since they are one-time and high-value.

```typescript
// In sendToApi, modify the early return:
if (isAutonomous && !purchaseCelebration) {
  if (effectiveLowCostModeForCall) {
    isGeneratingRef.current = false
    return
  }
  // ... other autonomous checks
}
```

---

## 7. Implementation Checklist

1. [ ] Add `purchase_celebration_pending` column to `profiles` table (Supabase migration)
2. [ ] Update `/api/checkout/activate` to set `purchase_celebration_pending` on the profile
3. [ ] Update webhook handler to also set `purchase_celebration_pending`
4. [ ] Update `chat/page.tsx` detection to check DB flag as fallback when sessionStorage is empty
5. [ ] Update `route.ts` system prompt to include tier-specific benefits (the `TIER_BENEFITS` object)
6. [ ] Update `route.ts` to clear `purchase_celebration_pending` after successful celebration response
7. [ ] Update `use-chat-api.ts` to bypass low-cost mode for `purchaseCelebration` calls
8. [ ] Regenerate TypeScript types with `pnpm supabase gen types typescript`
9. [ ] Test: Purchase basic -> verify celebration fires with memory/cooldown benefits mentioned
10. [ ] Test: Purchase pro -> verify celebration fires with unlimited benefits mentioned
11. [ ] Test: Close tab during checkout -> reopen chat -> verify celebration still fires (DB fallback)
12. [ ] Test: Unsubscribe -> resubscribe -> verify celebration fires again

---

## 8. Files to Modify

| File | Change |
|------|--------|
| `src/app/api/chat/route.ts` | Enhance celebration prompt with `TIER_BENEFITS`; clear DB flag after success |
| `src/app/chat/page.tsx` | Add DB fallback for celebration detection |
| `src/hooks/use-chat-api.ts` | Bypass low-cost mode for celebration calls |
| `src/app/api/checkout/activate/route.ts` | Set `purchase_celebration_pending` on profile |
| `src/lib/database.types.ts` | Add `purchase_celebration_pending` field (auto-generated) |
| Supabase migration | Add column to `profiles` table |

---

## 9. Cost Analysis

- **One-time LLM call per purchase:** This is a single API call to the chat model. At current rates, negligible cost (~$0.01-0.03 per celebration).
- **No ongoing cost:** The celebration prompt is only injected when `purchaseCelebration` is present. It is NOT included in every system prompt. After the flag is cleared, the prompt returns to normal size.
- **DB overhead:** One extra nullable column, one UPDATE on purchase, one UPDATE on celebration completion. Negligible.
