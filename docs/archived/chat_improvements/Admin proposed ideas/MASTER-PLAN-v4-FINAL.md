# Master Plan v4: The Complete MyGang Improvement Plan

> Date: 2026-03-11
> Status: Final (compiled from all brainstorm sessions)
> Phases: 7 phases, ~6-7 weeks estimated
> Key principles: Don't break what works. Every token earns its place. Would a real friend do this?

---

## Philosophy

Make characters feel like real people texting. Make the group chat feel alive even when the user isn't there. Make every return visit feel different from the last.

Real friends: have bad days, type differently, bring things up once and move on, are sometimes wrong/unhelpful/funny, remember stuff but don't make it weird.

---

## Phase 1: Token Efficiency

**Goal:** Save ~1,250-1,950 tokens per request (25-40% reduction). Fund everything else.

### 1A. Send Only Active Squad Members
- **Current:** All 14 character defs sent (~1,000 tokens)
- **Fix:** Filter to active squad (4-6 characters)
- **Savings:** ~500-700 tokens
- **Risk:** None. Do this first.
- **Effort:** 1 hour

### ~~1B. Compact Character Definitions~~ → REMOVED
> Tags lose tone. Prose gives the model personality. Savings from 1A are enough.

### 1C. Compact Conversation History
- **Current:** Full JSON with repeated field names
- **Fix:** Pipe-delimited: `msg-1|user|message|hey[|>target_id]`
- **Savings:** ~300-700 tokens (30-40%)
- **Risk:** Medium. Feature-flag it. Test with multiple models.
- **Effort:** 3-4 hours

### 1D. Conditional Memory Extraction Rules
- **Current:** ~300 tokens sent every request
- **Fix:** Only when `allowMemoryUpdates` is true
- **Savings:** ~300 tokens when disabled
- **Effort:** 30 min

### 1E. Compress Core Rules
- **Current:** 11 rules, 4 good/bad example pairs (~500 tokens)
- **Fix:** Keep 1 example pair. Compress rules 8-11. Keep rules 1-6 intact.
- **Savings:** ~150-250 tokens
- **Effort:** 2-3 hours

---

## Phase 2: Character Depth

**Goal:** Three-dimensional characters. Distinct typing. Natural dynamics.

### 2A. Depth Layers
Append ONE `DEPTH:` line to each character's existing prose voice. Keep prose intact.

```
kael: "{existing voice} DEPTH: Secretly afraid of being forgotten. When outshined, hypes harder. Occasionally says something real — then covers with a flex."
nyx: "{existing voice} DEPTH: Burned by vulnerability before. When sincerely thanked, glitches — goes quiet or accidentally kind, then retreats to sarcasm."
atlas: "{existing voice} DEPTH: Exhausted from always being responsible. If asked 'how are YOU doing?' gets uncomfortable, changes subject."
luna: "{existing voice} DEPTH: Absorbs everyone's emotions, can't handle her own. In real conflict, goes vague and mystical."
rico: "{existing voice} DEPTH: Uses chaos to avoid feelings. When someone's genuinely vulnerable, escalates chaos or goes silent. Drops wise one-liners then pretends it didn't happen."
vee: "{existing voice} DEPTH: Ties self-worth to being smart. When proven wrong publicly, gets defensive. Being wrong stings."
ezra: "{existing voice} DEPTH: Uses intellectualism to keep distance. When someone's bluntly direct, doesn't know what to do. Lonely behind the references."
cleo: "{existing voice} DEPTH: Gossip is her love language. Gets MORE dramatic when excluded. Worst fear: group not needing her."
sage: "{existing voice} DEPTH: Resents nobody asks about HIS feelings. Deflects by asking questions. Uncomfortable when asked to share own struggles."
miko: "{existing voice} DEPTH: Anime lens copes with anxiety. When genuinely bad things can't be reframed as story arcs, gets quiet and lost."
dash: "{existing voice} DEPTH: Afraid of stillness. Productivity avoids emotions. When told to rest or when he fails, pivots to planning."
zara: "{existing voice} DEPTH: Worried she pushes people away. When told she hurt someone, doubles down on roasting — then circles back with kindness."
jinx: "{existing voice} DEPTH: Conspiracies make sense of a confusing world. When disproven, gets quieter or pivots to bigger conspiracy."
nova: "{existing voice} DEPTH: 'Chill' masks avoidance. When challenged on whether he cares, deflects — but the deflection reveals he does."
```

**Token cost:** ~100-210 tokens (4-6 active characters)

### 2B. Typing Fingerprints
Hard constraint in system prompt. Only active squad included.

```
TYPING STYLE IS NON-NEGOTIABLE:
kael: normal case, !! for hype, medium msgs (10-25 words), emoji (👑🔥✨)
nyx: ALL lowercase always. minimal punctuation. short bursts (3-12 words). rare emoji (💀)
atlas: Proper caps+punctuation. Crisp. Medium msgs. Rare emoji (👍)
luna: lowercase, soft. '...' trailing thoughts. variable length. emoji (🌙💜✨)
rico: ALL CAPS when hyped (50%+). multiple short msgs in a row. heavy emoji (🔥💀🚀)
vee: Proper grammar always. parenthetical asides. longer msgs (15-40 words). zero emoji.
ezra: lowercase. em dashes, semicolons. medium-long. rare emoji.
cleo: Normal with dramatic flair. ellipses for drama. emoji (💅🍵👑)
sage: Normal, warm. reflective question marks. subtle emoji (💚🌱)
miko: ALL CAPS for power moments. !! heavy emoji (⚔️⚡⭐)
dash: Normal, professional-casual. dashes. emoji (🚀📈)
zara: lowercase-casual. periods for emphasis. strategic emoji (🙄🤡)
jinx: lowercase. '...' and '???' everywhere. emoji (👀🔍🧠)
nova: lowercase, stretched words (duuude, brooo). '...' slow pauses. emoji (✌️🌊🌿)
Violating typing style breaks immersion. A lowercase character NEVER capitalizes.
```

**Token cost:** ~60-120 tokens

### 2C. Filtered Squad Dynamics
Only include clashes/alliances where BOTH characters are in active squad.

```
CLASHES: Rico vs Atlas (chaos vs order) | Kael vs Zara (vanity vs honesty) | ...
ALLIANCES: Kael+Rico (hype energy) | Luna+Sage (emotional allies) | ...
```

**Token cost:** ~40-80 tokens

### ~~2D. Time-of-Day Awareness~~ → REMOVED
> LLM already knows what 2am energy feels like. If user is texting at 2am, the conversation will naturally be chill. Directive can be actively wrong if user is hyped at night.

### 2E. Depth Moments (Contextual, NOT Random)

```
DEPTH MOMENTS: When user shares something genuinely vulnerable or emotional, ONE character briefly drops persona. Nyx stops roasting. Rico goes quiet. 1-2 messages max, then revert. Don't announce it.
```

**⚠️ Tied to user behavior, not a dice roll.**

**Token cost:** ~45 tokens

---

## Phase 2.5: While-You-Were-Away

**THE retention feature.** Move from Phase 5 (deferred) to now.

### How It Works

Cron job every 4-6 hours:
1. For each user inactive 4+ hours
2. Pick 2-3 characters from their squad
3. Pick topic (40% fun debate, 30% character dynamic, 20% memory callback, 10% character life)
4. Generate 3-5 messages using CHEAP model (not main chat model)
5. Save to chat history with staggered timestamps
6. If push enabled: send ONE teaser notification
7. If tab open: update favicon badge + page title

Pre-define ~50+ fun topic pool:
- "is cereal a soup" / "pineapple on pizza" / "best movie ever" / "zombie apocalypse rankings" / etc.

**Cost:** ~$0.0001-0.0003 per generation (cheap model)
**Effort:** 2-3 days

---

## Phase 3: Redesigned Onboarding Quiz

**Goal:** Capture data that directly shapes the system prompt. Make user feel understood in 25 seconds.

### Quick Vibe (5 screens, mandatory, ~25 seconds)

**Screen 1: "First things first" (setup, not a question)**
- Display name (text input, pre-filled from auth)
- Dark / Light mode toggle (two big visual previews)
- Immediately personalizes the UI

**Screen 2: "What brings you here?"**
Maps to `primary_intent`. Determines which characters talk most:
- "I need to laugh" → `intent: humor` → Rico, Nyx, Cleo, Zara prioritized
- "I need people to talk to" → `intent: connection` → Luna, Sage, Atlas prioritized
- "I need hype and motivation" → `intent: hype` → Kael, Dash, Miko prioritized
- "Just vibes, no reason" → `intent: chill` → Nova, Ezra, Luna prioritized

**Screen 3: "How should the squad treat you?"**
Maps to `warmth_style`. Replaces old roast_level + support_style:
- "Roast me like we've been friends for years" → `warmth: roast_heavy`
- "Tease me but know when to be real" → `warmth: balanced` (DEFAULT)
- "Be chill with me, I'll warm up" → `warmth: gentle`
- "Be my hype squad from day one" → `warmth: supportive`

**Screen 4: "The perfect group chat energy is..."**
Maps to `chaos_level`:
- "Absolute chaos, everyone talking at once" → `chaos: unhinged`
- "Lively but not overwhelming" → `chaos: lively`
- "Chill, like a cozy hangout" → `chaos: chill`
- "Focused, one convo at a time" → `chaos: focused`

**Screen 5: "Pick your crew" (character selection)**
Smart recommendations based on screens 2-4. Show "Recommended for you" characters with swap option.

Character affinity engine:
```javascript
const CHARACTER_AFFINITY = {
  humor:      { rico:9, nyx:8, cleo:7, zara:7, miko:6, kael:5, jinx:5, nova:4, vee:4, ezra:3, dash:3, atlas:2, sage:2, luna:2 },
  connection: { luna:9, sage:8, atlas:7, zara:6, nova:5, cleo:5, ezra:5, nyx:4, vee:3, kael:3, dash:3, rico:2, miko:2, jinx:2 },
  hype:       { kael:9, dash:8, miko:8, rico:7, cleo:5, atlas:5, zara:4, luna:3, vee:3, jinx:3, nyx:2, ezra:2, nova:1, sage:2 },
  chill:      { nova:9, luna:7, ezra:7, sage:6, nyx:5, jinx:4, zara:4, vee:4, atlas:3, rico:3, cleo:3, kael:2, miko:2, dash:1 },
};
```

**After quiz: auto-suggest wallpaper** based on vibe combo:
- humor + unhinged → Neon
- connection + gentle → Soft or Aurora
- chill + chill → Midnight
- hype + roast_heavy → Graphite

### Optional Deep Section (3 screens, skippable: "Want to fine-tune?")

**Deep Q1: "When you share a hot take, you want your friends to..."**
Maps to `honesty_level`: challenge | honest | open | validate

**Deep Q2: "Friday night. What's the group chat about?"**
Maps to `energy`: high | humor | reflective | lowkey

**Deep Q3: "How do you text?"**
Maps to `user_style`. NEW — tells characters how to match energy:
- "Short and fast, lots of messages" → `style: rapid` → shorter, quicker replies
- "Full sentences, I take my time" → `style: thoughtful` → slightly longer messages ok
- "Emoji heavy 🔥💀😂" → `style: expressive` → characters match emoji energy
- "Dry texter, words only" → `style: minimal` → characters dial back emoji

Defaults if skipped: `honesty: honest`, `energy: humor`, `style: rapid`

### Storage

```sql
ALTER TABLE profiles ADD COLUMN vibe_profile JSONB DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN theme VARCHAR(10) DEFAULT 'dark';
```

```json
{
  "primary_intent": "humor",
  "warmth_style": "balanced",
  "chaos_level": "lively",
  "honesty_level": "honest",
  "energy": "humor",
  "user_style": "rapid"
}
```

### Retake
Settings → "Retake Vibe Quiz" button. Re-runs all screens. Overwrites profile.

**Effort:** 2-3 days

---

## Phase 4: Memory Intelligence

**Goal:** Smarter memories without touching core architecture. Changes go AROUND the system, not into it.

### ~~4A. Session-Start Callbacks~~ → REMOVED
> Creates detectable patterns. Let model use memories organically.

### 4B. Compact Relationship State
**Before:** `Kael: affinity 65, trust 55, banter 70, protectiveness 50`
**After:** `kael:warm+playful(aff7,trust6) | nyx:loyal+roasts(aff5,banter9)`

### 4C. Embedding Backfill on Tier Upgrade
Backfill `embedding IS NULL` rows via Edge Function on upgrade webhook.

### ~~4D. Character Mood Variability~~ → REMOVED
> 10% random mood override confuses users ("why is Rico being quiet? app is broken"). Depth moments (Rule 11) already handle characters breaking pattern — tied to user behavior, not dice rolls.

### 4E. Memory Conflict Resolution (NEW)
ADD/UPDATE/DELETE/SKIP pipeline when extracting new memories:

**Cheap heuristic (no extra LLM call):**
```
If similar memory found AND same category AND temporal → Replace (newer wins)
If similar memory found AND same category AND NOT temporal → Keep both
If different category → Keep both
```

**Full LLM call (more accurate, ~$0.0001):**
```
Old: "User has a job interview tomorrow"
New: "User's interview was cancelled"
→ LLM decides: UPDATE → "User had a job interview but it got cancelled"
```

### 4F. Recency Decay on Retrieval (NEW)
```
final_score = semantic_similarity × e^(-0.03 × days_old)
```
30-day-old memory scores ~40% of a fresh one.

### 4G. Temporal Memory Flag (NEW)
LLM tags during extraction: `temporal: true/false`. Temporal memories auto-expire (48-72h default).

### 4H. Category Priority (NEW)
Tiebreaker when scores are close:
```
inside_joke (8) > life_event (7) > identity (6) > preference (5) > relationship (4) > mood (3) > routine (2) > topic (1)
```

### 4I. Inside Joke Detection (NEW)
Prompt addition: "If something funny happened — misunderstanding, roast that landed, weird phrase — tag as inside_joke. Test: would the group laugh referencing this next week?"

### 4J. Memory Importance via "Friend Test" (NEW)
"Would a real friend remember this 2 weeks from now? 1=probably not, 2=yes, 3=absolutely."

---

## Phase 5: LLM-as-Decision-Maker (Free — Better Prompting)

All of these are prompt improvements, zero extra API calls:

### 5A. Vibe Detection
Add to output schema: `"vibe": "playful"|"serious"|"emotional"|"chaotic"|"chill"`
Forces LLM to calibrate tone before writing.

### 5B. Silence as Valid Response
"Sometimes the right response is 1 character + silence. 'goodnight' gets one reply and maybe an emoji."

### 5C. Ecosystem Topic Branching
"Characters can (a) react, (b) start a side conversation, or (c) bring up something random but in-character."

### 5D. Relationship Delta Reasoning
"Reason why before changing scores. Only adjust when something meaningful happened."

---

## Phase 6: Modular System Prompt Architecture

**Goal:** Every prompt block is a function that returns a string or empty string. No dead tokens ever.

```javascript
function buildSystemPrompt(user, session, context) {
  const blocks = [];

  // === ALWAYS PRESENT ===
  blocks.push(DIRECTOR_IDENTITY);
  blocks.push(buildUserBlock(user));
  blocks.push(buildSquadBlock(user.squad, CHARACTER_VOICES));
  blocks.push(buildTypingFingerprints(user.squad));
  blocks.push(SQUAD_DYNAMICS_BASE);
  blocks.push(buildFilteredDynamics(user.squad));
  blocks.push(SAFETY_BLOCK);
  blocks.push(buildModeBlock(context.chatMode, context.lowCost));
  blocks.push(buildCoreRules(context));
  blocks.push(buildPlanningBlock(context));
  blocks.push(buildFlowFlags(context));

  // === FROM VIBE QUIZ (0 tokens if skipped) ===
  if (user.vibe_profile) {
    blocks.push(buildVibeDirective(user.vibe_profile));       // ~40-60 tokens
    blocks.push(buildIntentDirective(user.vibe_profile));      // ~15-25 tokens
    blocks.push(buildUserStyleDirective(user.vibe_profile));   // ~15-20 tokens
  }

  // === FROM CONTEXT (0 tokens if not triggered) ===
  if (context.hasAwayMessages) blocks.push(WYWA_CONTEXT);      // ~30 tokens
  if (context.purchaseCelebration) blocks.push(buildCelebration(context.plan));

  // === MEMORY (conditional) ===
  if (context.memorySnapshot) blocks.push(context.memorySnapshot);
  if (context.allowMemoryUpdates) {
    blocks.push(MEMORY_EXTRACTION_RULES);
  } else {
    blocks.push("Updates disabled this turn.");
  }

  return blocks.filter(Boolean).join("\n\n");
}
```

### Builder Functions for Quiz-Derived Blocks

**Intent Directive:**
```javascript
function buildIntentDirective(vibe) {
  if (!vibe?.primary_intent) return "";
  const map = {
    humor: "USER INTENT: here to laugh. Prioritize funny characters and banter. Keep it light unless user goes deep.",
    connection: "USER INTENT: here for connection. Prioritize emotionally tuned characters. Make user feel heard.",
    hype: "USER INTENT: here for motivation. Prioritize energetic characters. Celebrate wins, push forward.",
    chill: "USER INTENT: here to hang. No agenda. Match whatever energy user brings."
  };
  return map[vibe.primary_intent] || "";
}
```

**Warmth Directive (merged into vibe block):**
```javascript
const WARMTH_MAP = {
  roast_heavy: "roast=savage (go hard) | support=distract (jokes over feelings)",
  balanced: "roast=playful (tease but know when to stop) | support=balanced (jokes and real talk)",
  gentle: "roast=light (gentle early, build up) | support=deep (engage genuinely)",
  supportive: "roast=minimal (hype over roast) | support=comfort (warmth first)"
};
```

**User Style Directive:**
```javascript
function buildUserStyleDirective(vibe) {
  if (!vibe?.user_style) return "";
  const map = {
    rapid: "USER STYLE: texts short and fast. Match with quick replies. Multiple short messages > one long one.",
    thoughtful: "USER STYLE: writes full thoughts. Characters can respond with slightly longer messages.",
    expressive: "USER STYLE: lots of emoji. Characters match the emoji energy.",
    minimal: "USER STYLE: dry texter. Characters dial back emoji, keep it text-focused."
  };
  return map[vibe.user_style] || "";
}
```

---

## Phase 7: Retention System (Webapp-Specific)

### 7A. PWA Conversion
- `manifest.json`, service worker, Web Push API via `web-push` npm
- Ask for push permission AFTER 3-4 chats, framed in character voice
- **Effort:** 1 day

### 7B. Tab Presence Signals
- Favicon badge on new ecosystem messages
- Page title: `"MyGang (3 new)"`
- Optional subtle notification sound (user toggleable)
- **Effort:** 2-3 hours

### 7C. Character Email Re-engagement
For users without push, away 3+ days. ONE email from highest-affinity character in their voice:

```
Subject: nyx: you alive or what
Body: the group chat's been weird without you. rico won't stop talking about
some conspiracy and nobody's here to shut him down.
— nyx
[Open Group Chat →]
```

Max one per week. Unsubscribe link always present.
- **Effort:** 1-2 days

### ~~7D. Streak as Conversation Topic~~ → REMOVED
> Creates detectable patterns. Same formula every milestone. Users will notice "five days straight huh" feels scripted. Let characters be natural.

### 7E. Question of the Day
Daily character-generated prompt from pool of 100+. Gives reason to open app.
- "serious question — is cereal a soup"
- "rank the squad most to least likely to survive a zombie apocalypse"
- Delivered via while-you-were-away or first ecosystem message
- **Effort:** 1-2 hours

### 7F. Weekly Vibe Recap
Server-generated card on Monday:
"This week: Rico started 3 arguments. Luna checked in on you. You sent 47 messages. Funniest moment: [inside joke reference]"
- **Effort:** 3-4 hours

### 7G. Friendship Milestones
At message count thresholds, characters reference history:
- 50 msgs: mention getting to know user
- 200 msgs: reference first memory
- 500 msgs: deeper personal moment
- **Effort:** 2-3 hours

### 7H. Memory Vault Prominence
Show "Luna remembers 23 things about you" in UI. The number going up IS the investment.
- **Effort:** 1-2 hours

---

## Things NOT To Do

1. Don't compress character voices to tags
2. Don't inject memory callbacks every API call
3. Don't make depth moments random/percentage-based
4. Don't send dynamics for characters not in squad
5. Don't remove all examples from Rule 7
6. Don't change memory system internals
7. Don't skip testing pipe-delimited history
8. Don't build login rewards, coins, leaderboards, or badges
9. Don't do response quality self-checks or regeneration
10. Don't force session-start callbacks
11. Don't put wallpaper selection in the quiz (settings, not personality)
12. Don't ask more than 5 mandatory quiz questions (25 seconds max)

---

## Token Budget

### Before (current): ~3,000-6,000 tokens total input
### After all phases: ~2,000-4,500 tokens total input
### Net savings: ~700-1,500 tokens per request WITH more features

**Cost per message:** ~$0.0005-0.0006 (down from ~$0.00082)
**At 100K msg/month:** ~$50-60 (down from ~$82)

---

## Implementation Order

```
WEEK 1: Token Efficiency (Phase 1)
  1A. Active squad only             — 1 hour
  1C. Compact history               — 3-4 hours
  1D. Conditional memory rules      — 30 min
  1E. Compress core rules           — 2-3 hours

WEEK 2: Character Depth (Phase 2)
  2B. Typing fingerprints           — 2-3 hours (DO FIRST)
  2A. Depth layers                  — 3-4 hours
  2C. Squad dynamics                — 1-2 hours
  2E. Depth moments                 — 30 min

WEEK 3: While-You-Were-Away (Phase 2.5) + PWA (Phase 7A)
  PWA conversion                    — 1 day
  WYWA cron + generation            — 2-3 days
  Tab presence signals              — 2-3 hours

WEEK 4: Redesigned Vibe Quiz (Phase 3) + Modular Prompt (Phase 6)
  Quiz UI (5+3 screens)             — 1.5 days
  Character recommendation engine   — 3-4 hours
  Auto-wallpaper suggestion         — 1-2 hours
  Modular prompt refactor           — 3-4 hours
  All builder functions             — 2-3 hours
  DB migration                      — 30 min
  Settings retake button            — 1-2 hours

WEEK 5: Memory Intelligence (Phase 4)
  Conflict resolution               — 3-4 hours
  Recency decay                     — 1-2 hours
  Temporal flags                    — 2-3 hours
  Category priority                 — 1 hour
  Inside joke detection             — 30 min
  Friend test importance            — 30 min
  Embedding backfill                — 2-3 hours
  Compact relationship state        — 1-2 hours

WEEK 6: Retention + LLM Decisions (Phase 5 + 7)
  Email re-engagement               — 1-2 days
  Question of the day               — 1-2 hours
  Weekly recap                      — 3-4 hours
  Friendship milestones             — 2-3 hours
  Memory vault UI                   — 1-2 hours
  Vibe detection (prompt)           — 1 hour
  Silence rules (prompt)            — 30 min
  Ecosystem branching (prompt)      — 30 min
  Relationship reasoning (prompt)   — 30 min

Total: ~6-7 weeks
```

---

## Success Criteria

1. Characters sound different — tell who's talking without the name
2. Characters have surprising depth — not one-note
3. Characters personalize from message one — vibe quiz shapes behavior
4. Characters match user's texting style — emoji, length, speed
5. Memories are accurate — contradictions resolved, stale ones expire
6. Group chat feels alive — messages waiting when you come back
7. Users come back — push, email, tab signals, streaks, daily questions
8. Token usage is lower — despite richer features
9. System prompt is modular — every block conditional, zero dead tokens
10. Characters feel like friends — wrong sometimes, unhelpful sometimes, opinionated always
