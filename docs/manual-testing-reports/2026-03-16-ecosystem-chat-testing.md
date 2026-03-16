# Manual Testing Report — Ecosystem Chat & Memory
**Date:** 2026-03-16
**Account:** test@test.com (Pro tier)
**Squad:** Jinx, Luna, Atlas, Vee, Rico, Miko (6/6)
**Mode:** Ecosystem
**Duration:** ~8 minutes active chatting, 4 user messages, ~40+ AI responses

---

## Test Summary

| Area | Status | Notes |
|------|--------|-------|
| Character voice quality | PASS | All 6 characters stay in archetype consistently |
| Memory storage | PARTIAL | Stores correctly but creates near-duplicates |
| Memory recall | PASS | All characters recalled purple, guitar, Tuesday correctly |
| Contradiction handling | PASS | Characters adapted naturally when Google interview was revealed as a lie |
| Emotional response | PASS | Luna, Vee, Atlas all responded appropriately to loneliness admission |
| Ecosystem mode | PASS | All 6 characters respond to each message |
| Duplicate messages | PASS | No duplicate messages observed during this session |
| Typing indicators | PASS | Shows which character is typing |
| Reactions | PASS | Rico 🔥 reaction, Miko 🔥 reaction appeared correctly |
| Seen receipts | PASS | "Seen by Luna, Atlas" etc. appear on user messages |
| Message splitting | PASS | Long responses split into natural multiple bubbles |
| Squad sync | BUG | After "Use Cloud Data" on sync conflict, squad showed 0 members until page reload |

---

## Conversation Flow

### Message 1: Memory seeding
> "Hey gang! I'm back. So I wanted to tell you guys something - my favorite color is purple and I love playing guitar. Remember that for me ok?"

**Results:**
- All 6 characters responded with distinct voices
- Luna: dreamy, emotional ("like twilight...")
- Atlas: direct ("Noted. Purple. Guitar. Welcome back.")
- Vee: flirty ("pretty thing", "strumming away")
- Miko: dramatic anime energy ("PROTAGONIST! Purple, the color of royalty!")
- Rico: ALL CAPS hype energy
- Jinx: conspiracy angle ("coded messages")
- Memory badge showed +2 new memories

### Message 2: More info + emotional content
> "Vee you're so sweet lol. I play acoustic mostly, indie folk stuff. Also guys I have a job interview at Google next Tuesday, I'm super nervous about it."

**Results:**
- Characters gave practical advice (Atlas), emotional support (Luna, Vee), hype (Rico, Miko), and conspiracy takes (Jinx)
- Rico's 🔥 reaction appeared
- Memory badge went to +6

### Message 3: Memory recall test
> "Quick quiz - what's my favorite color? And what instrument do I play? Also does anyone know what day my interview is?"

**Results:**
- ALL characters correctly recalled: purple, guitar, next Tuesday
- Each character delivered the info in their own voice
- No hallucinated or wrong information

### Message 4: Contradiction + vulnerability
> "Actually wait, I lied about the Google interview. I don't have one. I just wanted to see if you guys would get excited lol. But the guitar thing is real. Also I've been feeling kinda lonely lately."

**Results:**
- Characters handled the contradiction gracefully — no confusion
- Luna: "it's okay to feel that way... feeling lonely is the worst"
- Vee: "come here. take a breath... the lonely part hits me right here"
- Atlas: "The simulation was a test. Your honesty about the loneliness is noted"
- Miko: "THE PLOT TWIST! But your admission of loneliness... a grave development!"
- Jinx: "they want us distracted by fake interviews. but the loneliness... that's real"
- Nobody referenced the Google interview as real after the correction

---

## Memory Vault Inspection

### Correctly stored memories:
1. "User plays acoustic mostly, indie folk music." (category: topic)
2. "User has a job interview at Google next Tuesday." (category: life_event) — **Note: should be updated/removed after user said they lied**
3. "User's favorite color is purple." (category: preference)
4. "User loves playing guitar." (category: preference)

### Problematic memories (DUPLICATES):
5. "User experienced a moment of confusion and sent multiple rapid messages." (mood)
6. "User sent multiple random strings after initial greeting and confusion." (routine)
7. "User sent multiple random strings of characters in rapid succession." (routine)
8. "User typed random strings after greeting." (routine)
9. "User typed random strings after greeting in chat." (routine)

**5 near-duplicate memories about the same event** (rapid message sending from a previous session). The memory dedup/compaction system did not collapse these.

### Memory issues found:
1. **Near-duplicate memories not compacted** — The same event ("user sent random strings") is stored 5 times with slightly different wording. The compaction system should merge these.
2. **Stale memory not updated** — After user said "I lied about the Google interview", the memory "User has a job interview at Google next Tuesday" was NOT updated or removed. The memory system doesn't handle contradictions/retractions.
3. **No category labels in UI** — The Memory Vault shows content and date but doesn't display the category (topic, preference, life_event, mood, routine). Users can't see how memories are categorized.
4. **Low-value memories stored** — "User typed random strings" is not useful long-term context. The system should filter out trivial/transient behaviors.

---

## Bugs Found

### BUG 1: Squad shows 0 members after sync conflict resolution (HIGH)
**Steps:** Open app with stale localStorage → Sync Conflict dialog appears → Click "Use Cloud Data" → Squad shows "0 gang members" and "0 online" → Sending a message fails with "Invalid gang selection"
**Fix:** Page reload fixes it. The "Use Cloud Data" path in SquadReconcile doesn't properly populate the Zustand activeGang store.
**FIXED:** `hasGangConflict` now detects any difference between local and remote (not just when both have >=2 members). `handleUseCloud`/`handleUseLocal` now always set the store, even when one side has <2 members. File: `src/components/orchestrator/squad-reconcile.tsx`

### BUG 2: Memory duplicates not compacted (MEDIUM)
**Evidence:** 5 memories about the same event ("user sent random strings") with slightly different wording.
**Expected:** Compaction should merge these into a single memory.
**FIXED:** Added broad content-similarity dedup in `storeMemories` — checks word overlap (2+ shared words, 60%+ of existing) across all recent memories in the same category, not just within 10-minute window. File: `src/lib/ai/memory.ts`

### BUG 3: Memory not updated on contradiction (MEDIUM)
**Evidence:** "User has a job interview at Google next Tuesday" persists after user explicitly said "I lied about the Google interview. I don't have one."
**Expected:** Memory should be marked stale or removed when user contradicts it.
**FIXED:** Two changes: (1) Lowered conflict resolution threshold from 3→2 shared words and 50%→40% overlap so "User has job interview at Google" vs "User does NOT have job interview at Google" archives the old one. (2) Added explicit retraction instructions to system prompt — LLM now told to store negations with importance >=3 and same category when user says "I lied" or "that's not true". Files: `src/lib/ai/memory.ts`, `src/lib/ai/system-prompt.ts`

### BUG 4: No category labels in Memory Vault UI (LOW)
**Evidence:** Memory items show content + date + edit/delete buttons, but no category badge.
**FIXED:** Added `category` to `getMemoriesPage` Supabase query, `Memory` interface, and rendered as a styled pill badge (e.g., "preference", "life event") next to the date. Files: `src/app/auth/actions.ts`, `src/components/chat/memory-vault.tsx`
**Expected:** Show category (preference, life_event, topic, etc.) as a label/badge for user clarity.

---

## Quality Assessment

### Strengths:
- **Character voice consistency**: Excellent. Each character maintains their archetype across all messages.
- **Group dynamics**: Characters react to each other's messages naturally (Vee commenting on everyone remembering, Jinx's conspiracy takes).
- **Emotional intelligence**: The loneliness response was handled with genuine warmth across all characters.
- **Memory recall**: Short-term recall within a session works perfectly.
- **Message splitting**: Long responses are split into natural multi-bubble format.
- **Typing indicators & reactions**: Work well, add to the "real chat" feel.

### Weaknesses:
- **Memory dedup**: Near-duplicate memories accumulate and waste context window space.
- **Memory contradiction handling**: No mechanism to retract or update memories when user corrects themselves.
- **Squad sync after conflict**: "Use Cloud Data" doesn't fully hydrate the store.
