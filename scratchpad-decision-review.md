# MyGang Cost-Control Plan (Final)

## Decision Summary

### Keep as-is
- Keep user message send path fast (no artificial delay on user send).
- Keep provider fallback (Gemini -> OpenRouter) with cooldown/circuit-breaker.
- Keep `maxRetries = 0` for model calls during quota pressure.

### Do with modification
- Add delay only for autonomous/follow-up calls, not user sends.
- Reduce context adaptively under stress, not permanently.
- Keep `maxOutputTokens = 1200` in normal mode; use lower cap only in low-cost mode.

### Do next
- Add `Low-Cost Mode` toggle.
- Compact the system prompt.
- Add observability/metrics for call pressure and token footprint.

### Do not do
- Do not add automatic retry loops for model generation.
- Do not globally disable autonomy by default.
- Do not force cheapest model at all times if it damages UX quality.

## Why this is the right direction
- Your current 429 issue is mostly burst/rate behavior.
- A flat "slow everything" fix harms user feel.
- A degradation ladder preserves UX when healthy and reduces pressure when stressed.

## Implementation Plan

## Phase 1: Stabilize under pressure (Immediate)
- Status: Mostly done.
- Goal: Stop spikes and repeated provider hammering.
- Scope:
- Autonomous backoff on 429/402.
- Provider cooldown + `Retry-After`.
- Limit autonomous chaining depth.
- Acceptance criteria:
- After first 429, autonomous calls pause for cooldown window.
- Repeated provider calls during cooldown drop sharply.
- User-initiated send still feels immediate.

## Phase 2: Low-Cost Mode (Next)
- Goal: Give user explicit cost-control mode without killing default UX.
- Scope:
- Add settings toggle `Low-Cost Mode`.
- In low-cost mode:
- disable autonomous continuation
- disable idle autonomous follow-up
- reduce max responders (1-2)
- reduce LLM history window (ex: 12 -> 8)
- reduce output cap (ex: 1200 -> 800)
- Files likely touched:
- `src/components/chat/chat-settings.tsx`
- `src/stores/chat-store.ts`
- `src/app/chat/page.tsx`
- `src/app/api/chat/route.ts`
- Acceptance criteria:
- Toggle can be changed at runtime.
- Requests visibly reduce in frequency and payload.
- Reply quality remains acceptable for direct user asks.

## Phase 3: Prompt Compaction (Next)
- Goal: Lower tokens per call without behavior regression.
- Scope:
- Rewrite long rules into compact constraints.
- Remove duplicate instruction lines.
- Keep identity/safety/schema-critical rules intact.
- Add concise style/routing directives only once.
- Acceptance criteria:
- Prompt character length reduced by ~30-45%.
- No regression in event schema validity.
- No regression in safety behavior and speaker constraints.

## Phase 4: Observability (Next)
- Goal: Replace guesswork with measurable control.
- Metrics to record per request:
- request source: user vs autonomous
- client message count sent
- server history count sent to LLM
- prompt chars
- provider chosen
- status code (200/429/402/500)
- cooldown active flag
- Suggested locations:
- API route logging (`/api/chat`)
- lightweight analytics event stream
- Acceptance criteria:
- Can answer: "why did 429 spike at time X?"
- Can measure autonomous contribution to total call volume.

## Degradation Ladder (Runtime Policy)

```text
State A: Healthy
  - default behavior
  - normal history + autonomy

State B: Stress detected (429/402)
  - activate autonomous backoff
  - respect provider cooldown

State C: Repeated stress
  - switch to low-cost profile automatically OR prompt user to enable Low-Cost Mode

State D: Recovery
  - gradually return to default behavior after clean window
```

## Proposed Thresholds
- Stress trigger:
- >=2 capacity errors (429/402) within 2 minutes.
- Recovery trigger:
- 10 consecutive successful user-initiated turns with no capacity errors.
- Low-cost auto-enable (optional):
- >=4 capacity errors within 5 minutes.

## UX Guardrails
- Never delay user’s first send action.
- Keep persona style alive even in low-cost mode.
- Show transparent status text when throttled:
- "Capacity is tight, retrying shortly."
- Avoid noisy alerts; use subtle inline toast/banner.

## Rollback Plan
- Feature-flag each phase.
- If quality drops:
- disable low-cost auto-switch, keep manual toggle only.
- revert compact prompt to previous version quickly.
- keep cooldown protection enabled (high value, low UX cost).

## Success Criteria
- 429 rate reduced significantly in chat route.
- Autonomous-request share decreases during stress windows.
- No noticeable slowdown in user-initiated response start time.
- User session completion and message satisfaction remain stable.
