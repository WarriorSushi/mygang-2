# MyGang.ai Billing System Design

**Date:** 2026-03-05
**Status:** Approved for implementation

---

## 1. Core Decision: No Guest Access

All users MUST sign up before using MyGang.ai. No anonymous/guest usage.

**Flow:**
```
Landing page -> Click any CTA -> Signup/Login screen -> Onboarding -> Chat
```

**Changes required:**
- Landing page CTAs link to `/auth/login` (or signup variant)
- Remove all guest logic from chat API
- Remove `isGuest` state from stores
- Remove IP-based rate limiting for guests
- Onboarding requires authenticated session
- Chat page requires authenticated session

---

## 2. Pricing Tiers

| | Free | Basic ($14.99/mo) | Pro ($19.99/mo) |
|---|---|---|---|
| Requires signup | Yes | Yes | Yes |
| Messages | 20 per 60-min window | 1,000/month | Unlimited |
| Memory | No | Yes | Yes |
| Cooldown | 60 min after 20 msgs | None (until 1K hit) | None |
| When limit hit | Paywall + cooldown timer | Falls back to Free tier | N/A |

**Marketing:** Pro shows ~~$99/mo~~ $19.99/mo — "80% off launch week" (permanent fake discount for conversions).

---

## 3. Payment Provider: DodoPayments

**Why:** Merchant of Record (handles global tax/compliance), 150+ countries, overlay checkout, Next.js adaptor.

**Packages:**
- `dodopayments` — server SDK
- `@dodopayments/nextjs` — route handlers (checkout, webhooks, portal)
- `dodopayments-checkout` — frontend overlay SDK

**Products to create in DodoPayments dashboard:**
- `basic_monthly` — $14.99/mo subscription
- `pro_monthly` — $19.99/mo subscription

---

## 4. Database Schema

### New: `subscriptions` table
```sql
create table public.subscriptions (
  id text primary key,                    -- DodoPayments subscription_id
  user_id uuid not null references profiles(id) on delete cascade,
  product_id text not null,
  plan text not null check (plan in ('basic', 'pro')),
  status text not null default 'pending'
    check (status in ('pending','active','on_hold','cancelled','expired')),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_subscriptions_user on subscriptions(user_id);
create index idx_subscriptions_status on subscriptions(status);
```

### Update: `profiles` table
```sql
alter table profiles add column if not exists dodo_customer_id text;
-- subscription_tier already exists ('free'|'basic'|'pro'), kept as cache
-- daily_msg_count already exists, repurposed for free-tier 60-min window
-- last_msg_reset already exists, repurposed for window tracking
```

### New: `billing_events` table (audit trail)
```sql
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  event_type text not null,
  dodo_event_id text,
  payload jsonb,
  created_at timestamptz default now()
);
```

---

## 5. Message Gating Logic

All users are authenticated. No guest path.

```
if subscription_tier == 'pro':
  -> unlimited messages, memory enabled

if subscription_tier == 'basic':
  -> check monthly_msg_count vs 1000
  -> if under 1000: allow, increment, memory enabled
  -> if over 1000: fallback to free tier logic below

if subscription_tier == 'free' or null:
  -> check Redis "chat:free:{userId}" -> 20 msgs per 60-min sliding window
  -> if under 20: allow, increment, memory DISABLED
  -> if at 20: return paywall card with countdown timer
```

---

## 6. Paywall Popup (Modal Dialog)

When a free/exhausted-basic user hits the limit, show a **popup modal dialog** (NOT in-chat):

```
┌─────────────────────────────────────────┐
│                    ✕                    │
│                                         │
│  😅 ok so... we kinda blew up           │
│                                         │
│  due to unexpected (but very welcome)   │
│  adoption, we had to cap the free tier  │
│  before our servers start crying.       │
│  your gang still loves you — they just  │
│  need a coffee break. ☕                │
│                                         │
│  come back in {timeLeft} min            │
│                                         │
│  OR skip the wait forever:              │
│                                         │
│  [🚀 Upgrade to Pro — $19.99/mo]       │
│  ~~$99/mo~~ 80% off launch week        │
│                                         │
│  ✓ unlimited messages                   │
│  ✓ your gang remembers everything       │
│  ✓ no cooldowns, ever                   │
│                                         │
│  [View All Plans]                       │
│                                         │
│  (your besties aren't going anywhere    │
│   — they're just napping 💤)            │
└─────────────────────────────────────────┘
```

Implementation: Radix Dialog component triggered when chat API returns 429 with paywall flag.

---

## 7. Pricing Page (`/pricing`)

Dedicated page with 3 plan cards:

**Free** — "For the curious"
- 20 msgs per hour
- No memory
- [Current Plan] (if on free)

**Basic — $14.99/mo** — "For regulars"
- 1,000 msgs/month
- Memory enabled
- Falls back to free when exhausted
- [Get Basic]

**Pro — ~~$99/mo~~ $19.99/mo** — "For the squad" (HIGHLIGHTED)
- "80% OFF — Launch Week"
- Unlimited messages
- Full memory
- No cooldowns
- [Get Pro] (primary CTA)

---

## 8. Checkout & Activation Flow

```
User clicks plan on /pricing
  -> POST /api/checkout { plan: 'basic'|'pro', userId }
  -> Server creates DodoPayments checkout session
  -> Returns checkout_url
  -> Frontend opens overlay modal (dodopayments-checkout SDK)
  -> User completes payment
  -> DodoPayments redirects to /checkout/success?subscription_id=xxx&status=succeeded
  -> /checkout/success page:
     1. Server action: update profiles.subscription_tier immediately
     2. Show celebration UI ("your gang is HYPED 🎉")
     3. Redirect to /chat after 3 seconds
  -> Webhook fires later, confirms + writes to subscriptions table (source of truth)
```

---

## 9. Webhook Handler (`/api/webhook/dodo-payments`)

Events handled:
- `subscription.active` -> upsert subscription row, set profiles.subscription_tier
- `subscription.renewed` -> reset monthly_msg_count to 0, extend period_end
- `subscription.cancelled` -> mark cancelled, downgrade tier at period end
- `subscription.expired` -> set tier to 'free'
- `subscription.on_hold` -> set tier to 'free' temporarily
- `payment.succeeded` -> log to billing_events
- `payment.failed` -> log to billing_events

All webhooks verified via DodoPayments webhook secret (handled by @dodopayments/nextjs).

---

## 10. Auth-Gated Routing

**Current flow (REMOVE):**
```
Landing -> Onboarding -> Chat (guest allowed, signup on first message)
```

**New flow:**
```
Landing -> Click CTA -> /auth/login (signup/login) -> Onboarding -> Chat
```

**Route protection:**
- `/onboarding` — requires auth (redirect to /auth/login if not)
- `/chat` — requires auth (redirect to /auth/login if not)
- `/pricing` — public (anyone can see plans)
- `/checkout/success` — requires auth
- `/api/chat` — requires auth (return 401 if no user)
- `/api/checkout` — requires auth
- `/` (landing) — public

**Changes:**
- Landing page CTAs: "Meet Your Gang" / "Get Started" -> href to `/auth/login`
- Remove guest onboarding flow
- Remove `isGuest` from chat store
- Remove IP-based guest rate limiting from chat API
- Add auth check to onboarding page
- proxy.ts: add /onboarding, /chat, /checkout to protected routes

---

## 11. Settings Panel Updates

Add "Plan & Billing" section:
- Show current plan (Free/Basic/Pro)
- Show usage: "X messages used" (for Basic: "X / 1,000 this month")
- For free: "Upgrade" button -> /pricing
- For paid: "Manage Subscription" -> DodoPayments customer portal
- For paid: "Change Plan" -> /pricing

---

## 12. Files to Create

| File | Purpose |
|------|---------|
| `src/app/pricing/page.tsx` | Pricing page with 3 plan cards |
| `src/app/api/checkout/route.ts` | Creates DodoPayments checkout session |
| `src/app/checkout/success/page.tsx` | Post-payment celebration + activation |
| `src/app/api/webhook/dodo-payments/route.ts` | Webhook handler |
| `src/app/api/customer-portal/route.ts` | Customer portal redirect |
| `src/components/chat/paywall-card.tsx` | In-chat paywall component |
| `src/lib/billing.ts` | Billing helpers (tier check, limits, DodoPayments client) |
| Migration: `20260305_add_billing.sql` | subscriptions + billing_events tables |

## 13. Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/chat/route.ts` | Remove guest logic, new tier-based gating, disable memory for free |
| `src/stores/chat-store.ts` | Remove isGuest, add subscriptionTier state |
| `src/components/landing/landing-page.tsx` | CTAs -> /auth/login |
| `src/components/settings/settings-panel.tsx` | Add Plan & Billing section |
| `src/app/onboarding/page.tsx` | Add auth guard |
| `src/app/chat/page.tsx` | Add auth guard, remove guest handling |
| `src/proxy.ts` | Add onboarding/chat/checkout to protected routes |
| `src/components/orchestrator/auth-manager.tsx` | Remove guest-related logic |
| `src/hooks/use-chat-api.ts` | Remove guest checks |
| `src/hooks/use-autonomous-flow.ts` | Remove guest checks |
| `package.json` | Add dodopayments packages |
| `.env.local` / `.env.example` | Add DODO_PAYMENTS_* env vars |

---

## 14. DodoPayments Integration Details

### Environment Variables
```env
DODO_PAYMENTS_API_KEY=           # From DodoPayments dashboard
DODO_PAYMENTS_WEBHOOK_KEY=       # Webhook secret
DODO_PAYMENTS_RETURN_URL=        # https://mygang.ai/checkout/success
DODO_PAYMENTS_ENVIRONMENT=       # test_mode or live_mode
```

### Server SDK Init
```typescript
import DodoPayments from 'dodopayments'
const dodo = new DodoPayments({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
})
```

### Frontend Checkout SDK
```typescript
import { DodoPayments } from 'dodopayments-checkout'
DodoPayments.Initialize({ mode: 'test', displayType: 'overlay' })
DodoPayments.Checkout.open({ checkoutUrl })
```

### Webhook (via @dodopayments/nextjs)
```typescript
import { Webhooks } from '@dodopayments/nextjs'
export const POST = Webhooks({
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
  onSubscriptionActive: async (payload) => { /* update DB */ },
  onSubscriptionRenewed: async (payload) => { /* reset counters */ },
  onSubscriptionCancelled: async (payload) => { /* downgrade */ },
})
```
