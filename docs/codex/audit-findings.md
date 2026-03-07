# Codex Audit Findings

## Active findings

### Billing
- The linked Supabase project contains billing-state drift: at least one profile is marked paid while `subscriptions` and `billing_events` are empty.
- The named test account `test1@test.com` is not present in the linked Supabase project.

### Billing findings now addressed in code
- `checkout/success` previously showed a success state even when `/api/checkout/activate` failed or returned a non-activated subscription.
- Local plan copy previously disagreed with limiter logic. The app enforced hourly limits (`25/hr` free, `40/hr` basic) while multiple UI surfaces still advertised `20/hr` or `500/mo`.
- Billing drift had no built-in reconciliation pass.

### Chat reliability findings now addressed in code
- AI events were persisted to `chat_history` before the client confirmed they were actually rendered.
- `use-chat-history` could merge those persisted-but-never-rendered events back into the local thread, which matches the stale-reply symptom reported in production.
- Farewell turns were not handled explicitly, so short close-out messages could fall into the same interrupted-turn edge cases as ordinary chat.
- Default group replies still trended too long even with prompt instructions alone.

### UX findings now addressed in code
- Mobile pricing previously clipped the Pro column on a `390px` viewport. The comparison now stays side by side on mobile and scrolls horizontally instead of switching to stacked cards.
- The chat paywall popup exposed “while you wait” actions, but the chat page did not pass the handlers that would make those actions usable.
- Onboarding jumped directly from squad selection to loading; there was no “meet your friends / rename them” step.

### Production hardening findings now addressed locally
- `www.mygang.ai` emitted React hydration error `#418` on landing and pricing. The shared blob background now uses a hydration-safe client snapshot path, and the local pricing console is clean.

## Evidence sources
- Repo code review across billing, chat, onboarding, and tests
- Production Playwright snapshots of `www.mygang.ai`
- Linked Supabase project inspection
- Dodo subscription inspection for linked customer IDs
