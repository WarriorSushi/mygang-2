# Scratchpad Decision Review

## Decision Review: Which Suggestions We Should Actually Do

This section converts recommendations into clear decisions.

### Assumption
- The current file does not contain separately labeled blocks like "AI-1/AI-2/AI-3".
- So this review evaluates the recommendation set currently present in this scratchpad and the likely variants behind them.

## Decision Matrix

### 1) Add slight delay to reduce 429 spikes
- Decision: `DO`, with modification.
- Why:
- Rate-limit pain is mainly burst pressure from autonomous/follow-up calls, not primary user sends.
- Blanket delay on user sends would hurt perceived responsiveness.
- Modification:
- keep user-initiated call immediate.
- add spacing only for autonomous calls (already implemented).
- keep backoff window after 429/402 (already implemented).

### 2) Reduce context window further
- Decision: `DO`, but not aggressively.
- Why:
- Lower context lowers token usage and helps both quota and cost.
- Over-cutting can hurt continuity and make replies feel forgetful.
- Modification:
- keep current 16 (client) -> 12 (LLM) baseline.
- introduce adaptive mode:
- if 429 streak detected, temporarily use 12 -> 8.
- if healthy for N turns, restore to normal.

### 3) Disable autonomous behaviors entirely
- Decision: `DO NOT` as default.
- Why:
- It will noticeably flatten "group chat feels alive" UX.
- Better approach:
- keep autonomous features but gate them by budget/rate health.
- already partially done (backoff + reduced idle depth).
- add user-visible "Low-Cost Mode" toggle for full disable when needed.

### 4) Shrink system prompt drastically
- Decision: `DO`, with careful rewrite.
- Why:
- Current prompt is verbose and expensive.
- But abrupt cuts can change behavior quality/safety.
- Modification:
- convert long prose rules into compact bullet constraints.
- remove duplicated instructions.
- keep core safety + identity + event-schema constraints intact.

### 5) Keep Gemini -> OpenRouter fallback always
- Decision: `DO`, with circuit-breaker.
- Why:
- Fallback improves resilience when one provider is down.
- Without cooldown logic, fallback can double request pressure.
- Modification:
- keep provider cooldowns and `Retry-After` behavior (already implemented).
- prefer skipping known-cooldown provider immediately.

### 6) Add retries
- Decision: `DO NOT` for model generation right now.
- Why:
- Retries increase total request count under quota stress.
- Current `maxRetries=0` is correct for free-tier pressure.
- Modification:
- keep a single attempt per provider call path.
- rely on user retry + cooldown expiry instead of automatic retry loops.

### 7) Very low max output tokens (e.g., 300-500)
- Decision: `DO NOT` as global default.
- Why:
- Too low harms personality/flow and multi-speaker richness.
- Modification:
- keep 1200 normal.
- in low-cost mode, reduce to 700-900.

### 8) Add telemetry for token/call budget
- Decision: `DO NOW`.
- Why:
- Without metrics, tuning is guesswork.
- Needed for objective control of rate spikes.
- Add:
- per-turn counters: user sends, autonomous sends, provider attempts, 429/402 count.
- prompt size metrics: history count, chars sent, memory snapshot chars.
- alert thresholds for burst and quota events.

## Recommended Plan (Pragmatic, UX-safe)

### Phase A (already done)
- Context trimming.
- Autonomous spacing/backoff.
- Provider cooldown/circuit-breaker.

### Phase B (next)
- Add `Low-Cost Mode` in settings:
- disable autonomous continuation
- disable idle autonomous
- reduce responders
- optionally reduce output token cap

### Phase C (next)
- Prompt compaction pass:
- target 30-45% fewer prompt chars with equivalent behavior.

### Phase D (next)
- Add observability:
- event-level counters and dashboards for burst diagnosis.

## What I Would Change In The Existing Recommendation List

### Keep
- Low-cost mode concept.
- Prompt compaction.
- Budget-aware routing.
- Token/cost telemetry.

### Modify
- "Disable autonomous" -> make it conditional/toggle, not global.
- "Add delay" -> autonomous-only delay, never user-initiated send delay.
- "Use cheapest model always" -> use cheapest only in low-cost mode; keep quality default otherwise.

### Remove
- Any suggestion that adds automatic multi-retry loops under quota pressure.
- Any suggestion that globally degrades user reply latency.

## Final Recommendation

Yes, we should implement most of these ideas, but in a controlled "degradation ladder" model:

```text
Healthy state
  -> full UX (normal context, limited autonomous behavior)
Quota stressed (429/402)
  -> autonomous backoff + provider cooldown
Repeated stress
  -> switch to low-cost profile (smaller context, fewer responders, less autonomy)
Recovery window
  -> gradually restore full UX
```

This gives the best tradeoff: keep chat feeling alive when possible, reduce call pressure automatically when limits are tight.


### here are some modifications suggested:
## What I'd Modify 🔧

### 1. **The context window adaptive mode needs clarification**

> "if 429 streak detected, temporarily use 12 → 8"

**Issue:** This is reactive, not proactive. By the time you detect a 429 streak, you've already hit quota.

**Better approach:**
- Track your **quota burn rate** proactively
- If you're at 70% of daily quota with 8 hours left → preemptively enter low-cost mode
- Don't wait for 429s to tell you there's a problem

### 2. **Prompt compaction should happen NOW, not "Phase C"**

> "Phase C: Prompt compaction pass (30-45% reduction)"

**Why move this up:**
- It's **zero runtime complexity** (just rewrite the prompt once)
- It's **immediate savings** on every single call
- It has **no UX trade-offs** if done well

**My priority:**
```
Phase A: Prompt compaction (biggest bang/buck)
Phase B: Telemetry (visibility)
Phase C: Low-cost mode toggle (user control)
Phase D: Adaptive context (complexity)
3. "Low-Cost Mode" should have a better name
Users will see:

❌ "Low-Cost Mode" → sounds cheap/degraded
✅ "Focus Mode" → fewer interruptions, direct responses
✅ "Quiet Mode" → squad is less chatty
✅ "Efficient Mode" → streamlined experience

Frame the constraint as a feature.

What's Missing 🤔
1. No mention of the rolling summary approach
The decision matrix doesn't address the biggest token saver from the ChatGPT advice:
Rolling summary + last 4-6 messages instead of last 12 raw messages.
This should be Phase A work. It's:

High impact (30-40% token reduction)
Medium complexity (need summary update logic)
No UX degradation (might even improve coherence)

2. No message filtering strategy
ChatGPT's advice to filter noise (reactions, filler, short quips) isn't in the decision matrix.
This is low-hanging fruit:
javascript// Before sending to LLM, filter:
const substantiveMessages = messages.filter(m => 
  m.type === 'message' && 
  m.content.length > 20 && 
  !isFillerPhrase(m.content)
);
Saves tokens, zero UX impact.
3. No multi-provider strategy
You have Gemini → OpenRouter fallback, but:

What if both are quota-limited?
Do you have cost/performance profiles for each model?
Should you route based on conversation complexity?

Consider:

Easy conversations → Gemini Flash (cheap)
Complex/long → Gemini Pro
Quota exhausted → OpenRouter (Claude Haiku?)


My Recommended Priority Order
If I were you, I'd do this:
Week 1: Quick Wins (No Architecture Changes)

✅ Compact the system prompt (30-45% smaller)
✅ Filter noise from context (reactions, filler)
✅ Compress message format (["u", "..."] instead of JSON)
✅ Add basic telemetry (token count, call frequency)

Expected impact: 30-40% token reduction, immediate.
Week 2: Smart Context (Some Architecture)

✅ Implement rolling summary (summary + last 6 instead of last 12)
✅ Compress memory snapshot (tighter format)
✅ Add quota burn-rate monitoring

Expected impact: Another 20-30% reduction, better coherence.
Week 3: User Control (UX Layer)

✅ Add "Focus Mode" toggle (disables autonomous, fewer responders)
✅ Add adaptive context (12→8 when quota stressed)
✅ Dashboard for cost visibility (show users their usage)

Expected impact: User empowerment, graceful degradation.

Bottom Line
The decision matrix is solid and well-reasoned, but:

Prompt compaction should be Phase A, not Phase C (easy win)
Rolling summary is missing (biggest token saver)
Message filtering is missing (quick win)
"Low-cost mode" needs better framing (call it "Focus Mode")

if you agree with them, them delte everything here and rewrite a proper plan
with it included
