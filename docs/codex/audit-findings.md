# Codex Audit Findings

## Active findings

### Billing
- Production Dodo checkout success was reproduced on March 7, 2026, but `www.mygang.ai/checkout/success` still landed on “We’re still checking your upgrade.” Network evidence showed `POST /api/checkout/activate => 400` after a successful test payment.
- The root cause is twofold:
  - `activate` expected `subscription.customer_id` at the top level, but Dodo returns the customer under `subscription.customer.customer_id`.
  - The live profile for `test1@test.com` still had `dodo_customer_id = null`, so neither activation nor webhook lookup could map the paid subscription back to the user reliably.
- The linked Supabase project is still on the older boolean `purchase_celebration_pending` schema in production, so the runtime needs temporary compatibility until the migration is applied.

### Billing findings now addressed in code
- `checkout/success` previously showed a success state even when `/api/checkout/activate` failed or returned a non-activated subscription.
- Local plan copy previously disagreed with limiter logic. The app enforced hourly limits (`25/hr` free, `40/hr` basic) while multiple UI surfaces still advertised `20/hr` or `500/mo`.
- Billing drift had no built-in reconciliation pass.
- Checkout now refuses to continue if it cannot persist `dodo_customer_id`, activation now reads nested Dodo customer data and can backfill `dodo_customer_id` from the authenticated email match, and both activation/webhook writes now tolerate the old boolean celebration column until the remote migration is applied.

### Chat reliability findings now addressed in code
- AI events were persisted to `chat_history` before the client confirmed they were actually rendered.
- `use-chat-history` could merge those persisted-but-never-rendered events back into the local thread, which matches the stale-reply symptom reported in production.
- Farewell turns were not handled explicitly, so short close-out messages could fall into the same interrupted-turn edge cases as ordinary chat.
- Default group replies still trended too long even with prompt instructions alone.
- Production validation on March 7, 2026 showed a remaining farewell regression: `gn bye` received an appropriate short goodbye, but the same goodbye pair repeated again about 10 seconds later. The cause was the idle autonomous follow-up timer still firing after farewell turns.

### UX findings now addressed in code
- Mobile pricing previously clipped the Pro column on a `390px` viewport. The comparison now stays side by side on mobile and scrolls horizontally instead of switching to stacked cards.
- The chat paywall popup exposed “while you wait” actions, but the chat page did not pass the handlers that would make those actions usable.
- Onboarding jumped directly from squad selection to loading; there was no “meet your friends / rename them” step.
- Production validation still showed the mobile comparison table feeling too cramped/clipped when horizontally scrolled, so the mobile grid width and overlay were reduced further after the first deployment.

### Production hardening findings now addressed locally
- `www.mygang.ai` emitted React hydration error `#418` on landing and pricing. The shared blob background now uses a hydration-safe client snapshot path, and the local pricing console is clean.
- `www.mygang.ai` still returns `404` for `/favicon.ico`.
- The public landing page originally returned `401` from `/api/analytics`; authenticated chat analytics later returned `200`.

## Evidence sources
- Repo code review across billing, chat, onboarding, and tests
- Production Playwright snapshots of `www.mygang.ai`
- Linked Supabase project inspection
- Dodo subscription inspection for linked customer IDs
