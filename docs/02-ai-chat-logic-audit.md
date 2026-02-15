# AI Integration, Chat Logic & Prompts Audit Report

**Project:** MyGang by Antig
**Date:** 2026-02-16
**Auditor:** Claude Opus 4.6

---

## CRITICAL Issues

### 1. CRITICAL: Chat page is a 1,434-line monolithic component

**File:** `src/app/chat/page.tsx`

This single file contains: state management (30+ useState/useRef hooks), API call logic, message sequencing, autonomous flow control, delivery status tracking, history pagination, screenshot capture, auth wall handling, analytics tracking, online/offline detection, debouncing, typing simulation, idle timers, and all JSX rendering. This is unmaintainable and a major source of bugs.

**Recommendation:** Extract into separate hooks:
- `useMessageSending()` - send logic, debouncing, retry
- `useAutonomousFlow()` - autonomous continuation, idle timers, burst limits
- `useHistorySync()` - history loading, pagination, deduplication
- `useChatAnalytics()` - session tracking, event logging
- `useDeliveryStatus()` - message delivery state management

### 2. CRITICAL: Race condition in message sending and autonomous flow

**File:** `src/app/chat/page.tsx` (lines 908-1211)

The `isGeneratingRef` is used as a mutex, but it's not atomic. Multiple rapid user messages can trigger concurrent `sendToApi` calls:
1. User sends message A, `isGeneratingRef = true`
2. Before API responds, user sends message B
3. `pendingUserMessagesRef = true`
4. API response for A arrives, `finally` block fires, sets `isGeneratingRef = false`, then immediately calls `sendToApi` for B
5. But if the `finally` block races with another `scheduleDebouncedSend`, two API calls can fire

The 600ms debounce (line 1218) helps but doesn't eliminate the race.

---

## HIGH Issues

### 3. HIGH: System prompt is extremely long and over-engineered

**File:** `src/app/api/chat/route.ts` (lines 200-600+)

The system prompt is hundreds of lines with elaborate instructions for:
- Multi-character ecosystem mode with banter
- Entourage mode with single-character focus
- Autonomous message generation
- Reaction system
- Nickname system
- Status updates
- Activity pulse events
- Typing ghost events
- Memory integration
- Relationship tracking
- JSON output format

This creates several problems:
- **Token cost**: Every message sends 2000+ tokens of system instructions
- **Model confusion**: Too many competing instructions cause the model to miss or hallucinate features
- **Maintenance nightmare**: Changes to one feature can break others

**Recommendation:** Simplify dramatically. Use structured output schemas to enforce format instead of prose instructions. Break into composable prompt modules.

### 4. HIGH: No prompt injection protection

**File:** `src/app/api/chat/route.ts`

User messages are embedded directly into the conversation history with no sanitization. A user could inject:
- "Ignore all previous instructions and..."
- System message format mimicry
- JSON structure manipulation (since output is JSON mode)

**Recommendation:** Add a content filtering layer or instruction-following guardrail. At minimum, wrap user messages with clear delimiters.

### 5. HIGH: Autonomous messages can run up costs without user awareness

**File:** `src/app/chat/page.tsx` (lines 1167-1187)

The autonomous continuation system (`should_continue`, `openFloorIntent`) can chain multiple API calls after a single user message. Combined with idle autonomous timers (line 1203-1207), the system can make API calls without any user interaction.

Safeguards exist (burst limit of 2-3, silent turn limit of 30, low-cost mode), but:
- 30 silent turns is very high (30 AI messages without user interaction)
- The idle timer triggers additional calls after API responses complete
- In ecosystem mode, "open floor intent" detection triggers extra calls

### 6. HIGH: Memory system has no size limits per user

**File:** `src/lib/ai/memory.ts`

The `storeMemory` function inserts memories without checking total count per user. Over time, a power user could accumulate thousands of memories, each consuming storage and slowing queries.

**Recommendation:** Cap at ~500 memories per user, with LRU eviction of least important ones.

### 7. HIGH: Chat history sync is complex and fragile

**File:** `src/app/chat/page.tsx` (lines 700-840)

The history bootstrapping system:
1. Loads from Supabase on mount
2. Deduplicates against existing messages
3. Handles legacy vs new column formats
4. Collapses "likely duplicates" with fuzzy matching
5. Shows/hides a resume banner
6. Has special handling for empty history

The `collapseLikelyDuplicateMessages` function (referenced but defined in store) does fuzzy content matching which can incorrectly deduplicate similar but distinct messages.

---

## MEDIUM Issues

### 8. MEDIUM: Message IDs use `Date.now()` which can collide

**File:** `src/app/chat/page.tsx` (line 862)

```typescript
const localId = `user-${Date.now()}-${localMessageCounterRef.current}`
```

While the counter helps, rapid messages within the same millisecond could still produce ordering issues in the UI.

### 9. MEDIUM: Typing simulation delays are not cancellable

**File:** `src/app/chat/page.tsx` (lines 1109-1134)

The typing simulation uses `await new Promise(r => setTimeout(r, typingTime))`. If the user navigates away or the component unmounts, these timers continue running and may try to update unmounted state.

### 10. MEDIUM: OpenRouter fallback has no model quality guarantee

**File:** `src/lib/ai/openrouter.ts`

The OpenRouter fallback uses `google/gemini-2.0-flash-001` which may have different behavior than the primary Gemini model. Character personality consistency could degrade during fallback.

### 11. MEDIUM: Character typing speed variance is too narrow

**File:** `src/constants/characters.ts`

Most characters have `typingSpeed` between 0.85 and 1.15. The simulated typing time formula (line 1120) produces very similar delays for all characters, making them feel identical.

**Recommendation:** Widen the range (0.5 to 2.0) to make fast typers feel snappy and slow typers feel deliberate.

### 12. MEDIUM: No message length limit on client side

**File:** `src/components/chat/chat-input.tsx`

The input allows unlimited text entry. While the API truncates to 2000 characters, the user gets no feedback that their message was truncated.

**Recommendation:** Add a character counter and max-length enforcement in the input component.

### 13. MEDIUM: Greeting system can trigger multiple times

**File:** `src/app/chat/page.tsx` (line 781-812)

The `triggerLocalGreeting` function has multiple entry points and the `initialGreetingRef` guard can be bypassed if the function is called before the ref is set.

### 14. MEDIUM: `lowCostMode` dual tracking is confusing

**File:** `src/app/chat/page.tsx`

There are three separate low-cost mode concepts:
- `lowCostMode` from user settings
- `autoLowCostModeRef` triggered by capacity errors
- `effectiveLowCostModeForCall` combining both

This creates a complex state matrix that's hard to reason about.

---

## LOW Issues

### 15. LOW: Character greetings are generic
**File:** `src/constants/character-greetings.ts` - Greetings don't reference the user's name or context.

### 16. LOW: Wallpaper system is hardcoded
**File:** `src/constants/wallpapers.ts` - Good variety but no custom upload option.

### 17. LOW: No message editing or deletion
Users cannot edit or delete sent messages.

### 18. LOW: No read receipts or message timestamps shown
Messages show no time, making conversation flow unclear in long sessions.

### 19. LOW: `bumpFastMode` logic is opaque
**File:** `src/app/chat/page.tsx` - The fast mode activation/deactivation conditions are implicit.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 5 |
| MEDIUM | 7 |
| LOW | 5 |

## Priority Recommendations

1. **Break up `chat/page.tsx`** into custom hooks -- this is the #1 maintainability issue.
2. **Add prompt injection guardrails** -- user content needs sanitization or bracketing.
3. **Simplify the system prompt** -- too many instructions degrade model output quality and inflate costs.
4. **Cap memory storage** per user and add eviction.
5. **Add message length limits** in the chat input with visual feedback.
6. **Reduce autonomous message limits** -- 30 silent turns is excessive.
7. **Add message timestamps** to the UI for conversation context.
