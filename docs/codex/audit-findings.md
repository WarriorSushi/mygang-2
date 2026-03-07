# Codex Audit Findings

## Active findings

### Billing
- Production Dodo checkout success was reproduced on March 7, 2026, but `www.mygang.ai/checkout/success` still landed on “We’re still checking your upgrade.” Network evidence showed `POST /api/checkout/activate => 400` after a successful test payment.
- The root cause is twofold:
  - `activate` expected `subscription.customer_id` at the top level, but Dodo returns the customer under `subscription.customer.customer_id`.
  - The live profile for `test1@test.com` still had `dodo_customer_id = null`, so neither activation nor webhook lookup could map the paid subscription back to the user reliably.
- The linked Supabase project was still on the older boolean `purchase_celebration_pending` schema in production until March 7, 2026, when `20260307120000_purchase_celebration_pending_tier.sql` was applied directly to the linked project.
- A second production-only blocker existed in `protect_sensitive_profile_columns()`: it used `current_setting('request.jwt.claim.role', true)` instead of Supabase's normal role resolver, so service-role billing writes were being silently reverted on `profiles`. The linked project now has `20260307154000_fix_profile_guard_for_billing.sql`, which switches the guard to `auth.role()`-based detection with safe fallbacks and allows users to clear only their own `purchase_celebration_pending` flag.

### Billing findings now addressed in code
- `checkout/success` previously showed a success state even when `/api/checkout/activate` failed or returned a non-activated subscription.
- Local plan copy previously disagreed with limiter logic. The app enforced hourly limits (`25/hr` free, `40/hr` basic) while multiple UI surfaces still advertised `20/hr` or `500/mo`.
- Billing drift had no built-in reconciliation pass.
- Checkout now refuses to continue if it cannot persist `dodo_customer_id`, activation now reads nested Dodo customer data and can backfill `dodo_customer_id` from the authenticated email match, and both activation/webhook writes tolerate the old boolean celebration column during the compatibility window.
- The paid production test account `test1@test.com` has now been reconciled manually: `dodo_customer_id` is populated, `subscription_tier = 'pro'`, `subscriptions.id = 'sub_0NZyPAQ1MdBWCKqm5vuz2'` is present with `status = 'active'`, and `purchase_celebration_pending = 'pro'` is restored so the repaired congratulation flow can be verified in-browser.
- A follow-up production validation on March 7, 2026 found a separate client sync bug: the live app's `profiles` request returned `subscription_tier = 'pro'`, but chat UI still rendered the account as Free. The local fix is in `AuthManager`, which now applies profile-driven tier/customization state atomically instead of relying on a chain of independent setters.

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
