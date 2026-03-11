# MyGang Audit Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical, important, and cherry-picked minor issues from the audit report, accounting for items already fixed in the live DB.

**Architecture:** Sequential migrations for DB fixes, code changes grouped by file to minimize churn. Each task is independent where possible.

**Tech Stack:** Next.js 16, Supabase (project: xiekctfhbqkhoqplobep), Zustand, DodoPayments, TypeScript

---

## Already Fixed in Live DB (skip these)

| ID | Finding | Evidence |
|----|---------|----------|
| C4 | chat_history SELECT policy leak | Live policy: `user_id = (SELECT auth.uid())` — no `is_guest` |
| C7 | Conflicting CHECK constraints | Only `subscription_tier_valid` exists with `('free','basic','pro')` |
| C12 | Missing memories index | Index `memories_user_kind_created_idx` exists (from audit_fixes migration) |
| I6 | Characters table no RLS | RLS enabled, SELECT policy `"Anyone can read characters"` exists |
| I8 | RLS auth.uid() per-row eval (partial) | chat_history SELECT already uses `(SELECT auth.uid())` |

---

## Task 1: Add auth.uid() Guard to increment_profile_counters (C3)

**Files:**
- Create: `supabase/migrations/20260306200000_guard_increment_counters.sql`

**Step 1: Write the migration**

```sql
CREATE OR REPLACE FUNCTION increment_profile_counters(
  p_user_id UUID,
  p_daily_msg_increment INT DEFAULT 0,
  p_abuse_score_increment NUMERIC DEFAULT 0,
  p_session_summary TEXT DEFAULT NULL,
  p_summary_turns INT DEFAULT NULL,
  p_user_profile JSONB DEFAULT NULL,
  p_relationship_state JSONB DEFAULT NULL,
  p_last_active_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(daily_msg_count INT, last_msg_reset TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_daily_msg_count INT;
  v_last_msg_reset TIMESTAMPTZ;
BEGIN
  -- Guard: only allow users to update their own profile
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Access denied: cannot update another user''s counters';
  END IF;

  SELECT p.daily_msg_count, p.last_msg_reset
    INTO v_daily_msg_count, v_last_msg_reset
    FROM profiles p
   WHERE p.id = p_user_id
     FOR UPDATE;

  IF v_last_msg_reset IS NULL OR (now() - v_last_msg_reset) > interval '24 hours' THEN
    v_daily_msg_count := 0;
    v_last_msg_reset := now();
  END IF;

  v_daily_msg_count := LEAST(10000, GREATEST(0, COALESCE(v_daily_msg_count, 0) + p_daily_msg_increment));

  UPDATE profiles SET
    daily_msg_count = v_daily_msg_count,
    last_msg_reset = v_last_msg_reset,
    abuse_score = LEAST(1000, GREATEST(0, COALESCE(abuse_score, 0) + p_abuse_score_increment)),
    session_summary = COALESCE(p_session_summary, session_summary),
    summary_turns = COALESCE(p_summary_turns, summary_turns),
    user_profile = COALESCE(p_user_profile, user_profile),
    relationship_state = COALESCE(p_relationship_state, relationship_state),
    last_active_at = COALESCE(p_last_active_at, last_active_at)
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_daily_msg_count, v_last_msg_reset;
END;
$$;
```

**Step 2: Apply migration via Supabase MCP**

**Step 3: Verify — run SQL to check function source includes the guard**

**Step 4: Commit**
```
feat: add auth.uid() guard to increment_profile_counters (C3)
```

---

## Task 2: Fix Auth Bypass in /activate (C1 + C2)

**Files:**
- Modify: `src/app/api/checkout/activate/route.ts`

**Step 1: Apply fixes**

The current code (lines 29-39) skips ownership check when `subCustomerId` is falsy. Also doesn't validate subscription status.

Replace the entire route handler body with:

```typescript
import { createClient } from '@/lib/supabase/server'
import { getDodoClient } from '@/lib/billing'

export async function POST(req: Request) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const subscriptionId = body.subscription_id as string

    if (!subscriptionId) {
        return Response.json({ error: 'Missing subscription_id' }, { status: 400 })
    }

    try {
        const dodo = getDodoClient()
        const subscription = await dodo.subscriptions.retrieve(subscriptionId) as unknown as Record<string, unknown>

        if (!subscription) {
            return Response.json({ error: 'Subscription not found' }, { status: 404 })
        }

        // C2: Validate subscription status
        const status = subscription.status as string | undefined
        if (status !== 'active' && status !== 'trialing') {
            return Response.json({ error: 'Subscription is not active' }, { status: 403 })
        }

        // C1: Always verify ownership — deny by default
        const subCustomerId = subscription.customer_id as string | undefined
        if (!subCustomerId) {
            return Response.json({ error: 'Subscription has no customer' }, { status: 400 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('dodo_customer_id')
            .eq('id', user.id)
            .single()

        if (!profile?.dodo_customer_id || profile.dodo_customer_id !== subCustomerId) {
            return Response.json({ error: 'Subscription does not belong to this account' }, { status: 403 })
        }

        // C9: Validate product ID — reject unknowns
        const productId = (subscription.product_id as string) || ''
        let plan: string
        if (productId === process.env.DODO_PRODUCT_PRO) {
            plan = 'pro'
        } else if (productId === process.env.DODO_PRODUCT_BASIC) {
            plan = 'basic'
        } else {
            console.error(`[activate] Unknown product_id: ${productId}`)
            return Response.json({ error: 'Unknown product' }, { status: 400 })
        }

        // C8: Check for errors on DB writes
        const { error: tierError } = await supabase
            .from('profiles')
            .update({ subscription_tier: plan })
            .eq('id', user.id)

        if (tierError) {
            console.error('[activate] Tier update failed:', tierError)
            return Response.json({ error: 'Activation failed' }, { status: 500 })
        }

        const { error: subError } = await supabase.from('subscriptions').upsert({
            id: subscriptionId,
            user_id: user.id,
            product_id: productId,
            plan,
            status: 'active',
            updated_at: new Date().toISOString(),
        })

        if (subError) {
            console.error('[activate] Subscription upsert failed:', subError)
            return Response.json({ error: 'Activation failed' }, { status: 500 })
        }

        return Response.json({ success: true, plan })
    } catch (error) {
        console.error('[activate] Error:', error)
        return Response.json({ error: 'Activation failed' }, { status: 500 })
    }
}
```

**Step 2: Commit**
```
fix: auth bypass, status validation, product validation in /activate (C1, C2, C9)
```

---

## Task 3: Fix Webhook Error Handling + Idempotency + Admin Client (C8, C10, C9, I19)

**Files:**
- Modify: `src/app/api/webhook/dodo-payments/route.ts`
- Create: `supabase/migrations/20260306200001_billing_events_idempotency.sql`

**Step 1: Write idempotency migration**

```sql
-- Add unique constraint on dodo_event_id to prevent duplicate webhook processing
CREATE UNIQUE INDEX IF NOT EXISTS billing_events_dodo_event_id_unique
  ON public.billing_events (dodo_event_id)
  WHERE dodo_event_id IS NOT NULL;
```

**Step 2: Apply migration via Supabase MCP**

**Step 3: Fix webhook route**

Key changes:
- Import `createAdminClient` instead of inline `createClient` (I19)
- Add error checking on all Supabase calls (C8)
- Reject unknown product IDs (C9)
- Check idempotency before processing (C10)
- Use upsert with ON CONFLICT for squad restore (I5)

Replace `src/app/api/webhook/dodo-payments/route.ts`:

```typescript
import { Webhooks } from '@dodopayments/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_LIMITS } from '@/lib/billing'

const supabase = createAdminClient()

async function findUserByCustomerId(customerId: string) {
    const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('dodo_customer_id', customerId)
        .single()
    return data?.id ?? null
}

async function upsertSubscription(subscriptionId: string, userId: string, productId: string, plan: string, status: string, periodEnd?: string) {
    const { error } = await supabase.from('subscriptions').upsert({
        id: subscriptionId,
        user_id: userId,
        product_id: productId,
        plan,
        status,
        current_period_end: periodEnd ?? null,
        updated_at: new Date().toISOString(),
    })
    if (error) throw new Error(`upsertSubscription failed: ${error.message}`)
}

async function updateProfileTier(userId: string, tier: string) {
    const { error } = await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', userId)
    if (error) throw new Error(`updateProfileTier failed: ${error.message}`)
}

async function logBillingEvent(userId: string | null, eventType: string, dodoEventId: string | null, payload: unknown) {
    // C10: Idempotency check — skip if this event was already processed
    if (dodoEventId) {
        const { data: existing } = await supabase
            .from('billing_events')
            .select('id')
            .eq('dodo_event_id', dodoEventId)
            .maybeSingle()
        if (existing) {
            console.log(`[webhook] Skipping duplicate event: ${dodoEventId}`)
            return false // signal: already processed
        }
    }

    const { error } = await supabase.from('billing_events').insert({
        user_id: userId,
        event_type: eventType,
        dodo_event_id: dodoEventId,
        payload,
    })
    if (error) throw new Error(`logBillingEvent failed: ${error.message}`)
    return true // signal: new event
}

function planFromProductId(productId: string): string | null {
    if (productId === process.env.DODO_PRODUCT_PRO) return 'pro'
    if (productId === process.env.DODO_PRODUCT_BASIC) return 'basic'
    return null // C9: reject unknowns
}

export const POST = Webhooks({
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,

    onSubscriptionActive: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const productId = data.product_id as string
        const webhookId = data.webhook_id as string ?? null

        // C10: Idempotency
        const isNew = await logBillingEvent(null, 'subscription.active.check', webhookId, data)
        if (!isNew) return

        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] CRITICAL: No user found for customer_id=${customerId}, subscription_id=${subscriptionId}`)
            await supabase.from('billing_events').insert({
                user_id: null,
                event_type: 'subscription.active.orphaned',
                dodo_event_id: webhookId,
                payload: data,
            })
            return
        }

        // C9: Reject unknown products
        const plan = planFromProductId(productId)
        if (!plan) {
            console.error(`[webhook] Unknown product_id: ${productId}`)
            return
        }

        await upsertSubscription(subscriptionId, userId, productId, plan, 'active')
        await updateProfileTier(userId, plan)

        // Restore previously removed squad members if slots available
        const newLimit = TIER_LIMITS[plan as keyof typeof TIER_LIMITS]?.squadLimit ?? 4
        const { data: currentGang } = await supabase
            .from('gang_members')
            .select('character_id, gangs!inner(user_id)')
            .eq('gangs.user_id', userId)
        const currentCount = currentGang?.length ?? 0
        const slotsAvailable = newLimit - currentCount

        if (slotsAvailable > 0) {
            const { data: restorable } = await supabase
                .from('squad_tier_members')
                .select('character_id')
                .eq('user_id', userId)
                .eq('is_active', false)
                .order('deactivated_at', { ascending: false })
                .limit(slotsAvailable)

            if (restorable?.length) {
                const restoreIds = restorable.map(r => r.character_id)

                await supabase
                    .from('squad_tier_members')
                    .update({ is_active: true, deactivated_at: null })
                    .eq('user_id', userId)
                    .in('character_id', restoreIds)

                // I5: Use upsert to avoid duplicate key errors
                const { data: gang } = await supabase
                    .from('gangs')
                    .select('id')
                    .eq('user_id', userId)
                    .single()
                if (gang) {
                    for (const id of restoreIds) {
                        await supabase.from('gang_members').upsert(
                            { gang_id: gang.id, character_id: id },
                            { onConflict: 'gang_id,character_id' }
                        )
                    }
                }

                const allIds = [...(currentGang?.map(g => g.character_id) ?? []), ...restoreIds]
                await supabase.from('profiles').update({
                    preferred_squad: allIds,
                    restored_members_pending: restoreIds,
                }).eq('id', userId)
            }
        }

        await supabase.from('profiles').update({ purchase_celebration_pending: true }).eq('id', userId)
    },

    onSubscriptionRenewed: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on renewal`)
            await logBillingEvent(null, 'subscription.renewed.orphaned', null, data)
            return
        }

        const { error } = await supabase.from('subscriptions').update({
            status: 'active',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Renewal update failed:', error)
        await logBillingEvent(userId, 'subscription.renewed', null, data)
    },

    onSubscriptionCancelled: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on cancellation`)
            await logBillingEvent(null, 'subscription.cancelled.orphaned', null, data)
            return
        }

        const { error } = await supabase.from('subscriptions').update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Cancellation update failed:', error)
        await updateProfileTier(userId, 'free')
        await supabase.from('profiles').update({ pending_squad_downgrade: true }).eq('id', userId)
        await logBillingEvent(userId, 'subscription.cancelled', null, data)
    },

    onSubscriptionExpired: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const subscriptionId = data.subscription_id as string
        const userId = await findUserByCustomerId(customerId)
        if (!userId) {
            console.error(`[webhook] No user found for customer_id=${customerId} on expiration`)
            await logBillingEvent(null, 'subscription.expired.orphaned', null, data)
            return
        }

        const { error } = await supabase.from('subscriptions').update({
            status: 'expired',
            updated_at: new Date().toISOString(),
        }).eq('id', subscriptionId)
        if (error) console.error('[webhook] Expiration update failed:', error)
        await updateProfileTier(userId, 'free')
        await supabase.from('profiles').update({ pending_squad_downgrade: true }).eq('id', userId)
        await logBillingEvent(userId, 'subscription.expired', null, data)
    },

    onPaymentSucceeded: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const userId = await findUserByCustomerId(customerId)
        await logBillingEvent(userId, 'payment.succeeded', null, data)
    },

    onPaymentFailed: async (payload) => {
        const data = payload.data as Record<string, unknown>
        const customerId = data.customer_id as string
        const userId = await findUserByCustomerId(customerId)
        await logBillingEvent(userId, 'payment.failed', null, data)
    },
})
```

**Step 4: Commit**
```
fix: webhook error handling, idempotency, product validation, admin client (C8, C9, C10, I5, I19)
```

---

## Task 4: Fix Checkout Route — Double-Click Race + Email Assertion (I3, I4)

**Files:**
- Modify: `src/app/api/checkout/route.ts`

**Step 1: Fix the race condition and email assertion**

At line 42-52, replace the customer creation block:

```typescript
// Old: if (!customerId) { create customer... }
// New: Conditional update to prevent race, email null check

if (!customerId) {
    if (!user.email) {
        return Response.json({ error: 'Account has no email address' }, { status: 400 })
    }

    const customer = await dodo.customers.create({
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
    })
    customerId = customer.customer_id

    // I3: Conditional update — only set if still null (prevents double-click race)
    const { data: updated } = await supabase
        .from('profiles')
        .update({ dodo_customer_id: customerId })
        .eq('id', user.id)
        .is('dodo_customer_id', null)
        .select('dodo_customer_id')
        .single()

    // If another request already set it, use the existing one
    if (!updated) {
        const { data: existing } = await supabase
            .from('profiles')
            .select('dodo_customer_id')
            .eq('id', user.id)
            .single()
        if (existing?.dodo_customer_id) {
            customerId = existing.dodo_customer_id
        }
    }
}
```

**Step 2: Commit**
```
fix: checkout double-click race condition, email null check (I3, I4)
```

---

## Task 5: Create Next.js Middleware (C6)

**Files:**
- Create: `src/middleware.ts`

**Step 1: Write the middleware**

```typescript
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_ROUTES = ['/chat', '/onboarding', '/settings', '/checkout/success']
const PUBLIC_ROUTES = ['/', '/about', '/pricing', '/auth', '/api', '/post-auth', '/admin', '/error']

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip public routes and static assets
    const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route))
    if (!isProtected) return NextResponse.next()

    let response = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/'
        return NextResponse.redirect(redirectUrl)
    }

    return response
}

export const config = {
    matcher: ['/chat/:path*', '/onboarding/:path*', '/settings/:path*', '/checkout/success/:path*'],
}
```

**Step 2: Commit**
```
feat: add Next.js middleware for server-side auth guard (C6)
```

---

## Task 6: Enforce Redis in Production for Rate Limiting (C13)

**Files:**
- Modify: `src/lib/rate-limit.ts`

**Step 1: Add production guard**

At the top of the `rateLimit` function (line 41), add a fail-closed check:

```typescript
export async function rateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): Promise<RateLimitResult> {
  // C13: Fail closed in production without Redis
  if (process.env.NODE_ENV === 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
    console.error('[rate-limit] CRITICAL: No Redis in production. Denying request.')
    return { success: false, remaining: 0, reset: Date.now() + windowMs }
  }

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    // ... existing Redis logic unchanged
```

**Step 2: Commit**
```
fix: fail closed when Redis unavailable in production (C13)
```

---

## Task 7: Upgrade Admin Password Hashing (C5)

**Files:**
- Modify: `src/lib/admin/auth.ts`

**Step 1: Replace SHA-256 with PBKDF2**

The admin password is checked server-side only. Use Node's built-in `crypto.pbkdf2Sync` (no new deps needed). The env var `ADMIN_PANEL_PASSWORD_HASH` will need to be regenerated as a PBKDF2 hash.

Replace `verifyAdminCredentials`:

```typescript
export function verifyAdminCredentials(emailInput: string, passwordInput: string) {
    const configuredEmail = getConfiguredAdminEmail()
    if (!configuredEmail) return false

    const emailMatches = safeEqual(emailInput.trim().toLowerCase(), configuredEmail)
    if (!emailMatches) return false

    const configuredHash = process.env.ADMIN_PANEL_PASSWORD_HASH?.trim()
    if (!configuredHash) return false

    // Support both legacy SHA-256 (64 hex chars) and new PBKDF2 format (salt:hash)
    if (configuredHash.includes(':')) {
        // PBKDF2 format: salt:derivedKey (both hex)
        const [salt, key] = configuredHash.split(':')
        if (!salt || !key) return false
        const derivedKey = crypto.pbkdf2Sync(passwordInput, Buffer.from(salt, 'hex'), 100000, 64, 'sha512').toString('hex')
        return safeEqual(derivedKey, key)
    }

    // Legacy SHA-256 fallback
    const normalizedConfiguredHash = normalizeHash(configuredHash)
    if (!isSha256Hex(normalizedConfiguredHash)) return false
    const submittedHash = crypto.createHash('sha256').update(passwordInput).digest('hex')
    return safeEqual(submittedHash, normalizedConfiguredHash)
}

// Helper to generate a new PBKDF2 hash (for use in scripts/console)
export function generateAdminPasswordHash(password: string): string {
    const salt = crypto.randomBytes(32).toString('hex')
    const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 64, 'sha512').toString('hex')
    return `${salt}:${key}`
}
```

**Step 2: Commit**
```
fix: upgrade admin password to PBKDF2, keep SHA-256 fallback (C5)
```

---

## Task 8: Fix Admin Cookie SameSite (I11)

**Files:**
- Modify: `src/lib/admin/session.ts`

**Step 1: Change SameSite from 'lax' to 'strict'**

At lines 64 and 76, change `sameSite: 'lax'` to `sameSite: 'strict'`.

**Step 2: Commit**
```
fix: admin cookie SameSite strict (I11)
```

---

## Task 9: Fix deleteAccount Silent Failure (I7)

**Files:**
- Modify: `src/app/auth/actions.ts` (lines 119-133)

**Step 1: Return error to caller**

```typescript
export async function deleteAccount() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
        console.error('Delete account error:', error)
        return { ok: false, error: 'Failed to delete account. Please try again.' }
    }

    await supabase.auth.signOut()
    redirect('/')
}
```

**Step 2: Update settings-panel.tsx to handle the error**

Find the `deleteAccount()` call and handle the return value + replace `confirm()` with inline confirmation (I21).

**Step 3: Commit**
```
fix: deleteAccount returns errors, replace confirm() with dialog (I7, I21)
```

---

## Task 10: Fix N+1 in persistAsync — Gang Lookup Waterfall (C11)

**Files:**
- Modify: `src/app/api/chat/route.ts` (lines 1291-1330)

**Step 1: Replace sequential gang lookup with upsert**

Replace the gang select-then-insert waterfall:

```typescript
// Replace lines 1291-1311 with:
const { data: gang, error: gangError } = await supabase
    .from('gangs')
    .upsert({ user_id: user.id }, { onConflict: 'user_id' })
    .select('id')
    .single()
```

This eliminates the separate SELECT + conditional INSERT.

**Step 2: Commit**
```
fix: eliminate gang lookup waterfall in chat persist (C11)
```

---

## Task 11: Fix Stale Closure in Recursive sendToApi (I14)

**Files:**
- Modify: `src/hooks/use-chat-api.ts` (lines 415, 430)

**Step 1: Replace direct `sendToApi()` calls with `sendToApiRef.current()`**

At line 415:
```typescript
// Old: sendToApi({ isIntro: false, isAutonomous: true, sourceUserMessageId: sourceId }).catch(...)
// New:
sendToApiRef.current({ isIntro: false, isAutonomous: true, sourceUserMessageId: sourceId }).catch((err) => console.error('Autonomous continuation error:', err))
```

At line 430:
```typescript
// Old: sendToApi({ isIntro: false, isAutonomous: false, sourceUserMessageId: sourceId }).catch(...)
// New:
sendToApiRef.current({ isIntro: false, isAutonomous: false, sourceUserMessageId: sourceId }).catch((err) => console.error('Pending message retry error:', err))
```

**Step 2: Commit**
```
fix: use sendToApiRef.current for recursive calls (I14)
```

---

## Task 12: Parallelize fetchJourneyState (I15)

**Files:**
- Modify: `src/lib/supabase/client-journey.ts` (lines 23-56)

**Step 1: Replace sequential calls with Promise.all**

```typescript
export async function fetchJourneyState(supabase: SupabaseClient, userId: string) {
    // I15: Parallelize profile and gang queries
    const [profileResult, gangResult] = await Promise.all([
        supabase
            .from('profiles')
            .select('username, chat_mode, low_cost_mode, theme, chat_wallpaper, preferred_squad, onboarding_completed, custom_character_names, subscription_tier, pending_squad_downgrade, restored_members_pending')
            .eq('id', userId)
            .single<JourneyProfile>(),
        supabase
            .from('gangs')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle<GangRow>(),
    ])

    const profile = profileResult.data
    let gangIds: string[] = []

    if (gangResult.data?.id) {
        const { data: members } = await supabase
            .from('gang_members')
            .select('character_id')
            .eq('gang_id', gangResult.data.id)
            .returns<GangMemberRow[]>()
        gangIds = (members || [])
            .map((m) => m.character_id)
            .filter((id): id is string => typeof id === 'string')
    }

    if (gangIds.length < 2 && Array.isArray(profile?.preferred_squad) && profile.preferred_squad.length >= 2 && profile.preferred_squad.length <= 6) {
        gangIds = profile.preferred_squad
    }

    return {
        profile: profile || null,
        gangIds: gangIds.slice(0, 6)
    }
}
```

**Step 2: Commit**
```
fix: parallelize fetchJourneyState queries (I15)
```

---

## Task 13: Memory Compaction Stuck Rows Recovery (I1)

**Files:**
- Modify: `src/lib/ai/memory.ts` (add safety reset at start of `compactMemoriesIfNeeded`)

**Step 1: Add stuck-row recovery**

At the beginning of `compactMemoriesIfNeeded` (after `const supabase = await createClient()`), add:

```typescript
// I1: Reset any rows stuck in 'compacting' for more than 5 minutes
await supabase
    .from('memories')
    .update({ kind: 'episodic' })
    .eq('user_id', userId)
    .eq('kind', 'compacting')
    .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
```

Note: This requires an `updated_at` column on memories. If it doesn't exist, we need to use `created_at` or add the column. Check before implementing.

**Step 2: Commit**
```
fix: recover stuck memory compaction rows after 5 min (I1)
```

---

## Task 14: Chat Page Hydration Loading State (I23)

**Files:**
- Modify: `src/app/chat/page.tsx` (around line 188)

**Step 1: Add loading skeleton before hydration completes**

Before the auth guard useEffect, add an early return:

```typescript
// I23: Show skeleton during store hydration to prevent flash
if (!isHydrated) {
    return (
        <div className="flex h-dvh items-center justify-center bg-white dark:bg-gray-950">
            <div className="animate-pulse text-gray-400 dark:text-gray-600 text-sm">Loading...</div>
        </div>
    )
}
```

**Step 2: Commit**
```
fix: add hydration loading skeleton to chat page (I23)
```

---

## Task 15: Replace alert() on Pricing Page (I20)

**Files:**
- Modify: `src/app/pricing/page.tsx` (lines 189, 201)

**Step 1: Replace alert() with state-driven error display**

Add error state and replace alerts:

```typescript
// Add state:
const [checkoutError, setCheckoutError] = useState<string | null>(null)

// Replace alert(err.error || '...') with:
setCheckoutError(err.error || 'Failed to start checkout. Please try again.')

// Replace alert('Something went wrong...') with:
setCheckoutError('Something went wrong. Please try again.')

// Add auto-dismiss:
useEffect(() => {
    if (checkoutError) {
        const t = setTimeout(() => setCheckoutError(null), 5000)
        return () => clearTimeout(t)
    }
}, [checkoutError])
```

Render error near checkout buttons as an inline message.

**Step 2: Commit**
```
fix: replace alert() with inline error on pricing page (I20)
```

---

## Task 16: Checkout Success Fallback Button (I22)

**Files:**
- Modify: `src/app/checkout/success/page.tsx`

**Step 1: Add fallback button to success state**

In the success return (lines 80-91), add a button after the redirect text:

```typescript
<p className="text-gray-500 text-sm">Redirecting to chat in 3 seconds...</p>
<button
    onClick={() => router.push('/chat')}
    className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
>
    Go to Chat
</button>
```

**Step 2: Commit**
```
fix: add fallback button on checkout success page (I22)
```

---

## Task 17: Fix Character Limit Mismatches (M2 + M3)

**Files:**
- Modify: `src/app/api/chat/route.ts` (line 557-558)

**Step 1: Fix chat route hard-cap**

Replace the hard-coded `.slice(0, 4)` and `filteredIds.length > 4` check:

```typescript
// Old:
// const filteredIds = requestedIds.filter((id) => knownIds.has(id)).slice(0, 4)
// if (filteredIds.length < 2 || filteredIds.length > 4) {

// New: Use tier-based limit
const { data: userProfile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()
const userTier = getTierFromProfile(userProfile?.subscription_tier ?? null)
const squadLimit = getSquadLimit(userTier)
const filteredIds = requestedIds.filter((id) => knownIds.has(id)).slice(0, squadLimit)
if (filteredIds.length < 2 || filteredIds.length > squadLimit) {
```

Add import at top: `import { getTierFromProfile, getSquadLimit } from '@/lib/billing'`

**Step 2: Commit**
```
fix: use tier-based squad limit in chat route (M2, M3)
```

---

## Task 18: DB Cleanup Migration — Drop is_guest, RLS Fixes, DELETE Policy (Guest Cleanup + I9 + M9)

**Files:**
- Create: `supabase/migrations/20260306200002_guest_cleanup_and_rls.sql`

**Step 1: Write migration**

```sql
-- 1. Drop is_guest column from chat_history (old guest flow remnant)
ALTER TABLE public.chat_history DROP COLUMN IF EXISTS is_guest;

-- 2. Wrap remaining RLS policies to use (select auth.uid()) for per-query eval (I8)
-- profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = (select auth.uid()));

-- gangs
DROP POLICY IF EXISTS "Users can view their own gang" ON public.gangs;
CREATE POLICY "Users can view their own gang" ON public.gangs
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own gang" ON public.gangs;
CREATE POLICY "Users can manage their own gang" ON public.gangs
  FOR ALL USING (user_id = (select auth.uid()));

-- gang_members
DROP POLICY IF EXISTS "Users can view their gang members" ON public.gang_members;
CREATE POLICY "Users can view their gang members" ON public.gang_members
  FOR SELECT USING (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can manage their gang members" ON public.gang_members;
CREATE POLICY "Users can manage their gang members" ON public.gang_members
  FOR ALL USING (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = (select auth.uid())));

-- chat_history INSERT
DROP POLICY IF EXISTS "Users can insert their chat history" ON public.chat_history;
CREATE POLICY "Users can insert their chat history" ON public.chat_history
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- memories
DROP POLICY IF EXISTS "Users can managed their memories" ON public.memories;
CREATE POLICY "Users can manage their memories" ON public.memories
  FOR ALL USING (user_id = (select auth.uid()));

-- squad_tier_members: add DELETE policy (M9)
CREATE POLICY "Users can delete own squad_tier_members"
  ON public.squad_tier_members FOR DELETE
  USING (user_id = (select auth.uid()));

-- Update existing squad_tier_members policies to use (select auth.uid())
DROP POLICY IF EXISTS "Users can read own squad_tier_members" ON public.squad_tier_members;
CREATE POLICY "Users can read own squad_tier_members" ON public.squad_tier_members
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own squad_tier_members" ON public.squad_tier_members;
CREATE POLICY "Users can insert own squad_tier_members" ON public.squad_tier_members
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own squad_tier_members" ON public.squad_tier_members;
CREATE POLICY "Users can update own squad_tier_members" ON public.squad_tier_members
  FOR UPDATE USING (user_id = (select auth.uid()));

-- I9: Scope billing policies to service_role only
-- (billing_events and subscriptions should only be written by webhooks via service_role)
DROP POLICY IF EXISTS "Service role manages billing_events" ON public.billing_events;
DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscriptions;
```

**Step 2: Apply via Supabase MCP**

**Step 3: Regenerate database types**

Run: `pnpm supabase gen types typescript --project-id xiekctfhbqkhoqplobep > src/lib/database.types.ts`

**Step 4: Commit**
```
fix: drop is_guest column, optimize RLS policies, add DELETE policy (I8, I9, M9, guest cleanup)
```

---

## Task 19: Fix Paywall Countdown Timer Leak (M17)

**Files:**
- Modify: `src/components/paywall-popup.tsx` (lines 34-46)

**Step 1: Fix interval deps**

Remove `secondsLeft` from useEffect deps and use functional state updater:

```typescript
useEffect(() => {
    const interval = setInterval(() => {
        setSecondsLeft((prev) => {
            if (prev <= 1) {
                clearInterval(interval)
                return 0
            }
            return prev - 1
        })
    }, 1000)
    return () => clearInterval(interval)
}, []) // No deps — interval runs once
```

**Step 2: Commit**
```
fix: paywall countdown timer interval leak (M17)
```

---

## Task 20: Remaining Quick Fixes

### 20a: Avatar Lightbox Escape Key (M14)
- Modify: `src/components/chat/message-item.tsx` (lines 435-476)
- Add `onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}` and `tabIndex={0}` + `autoFocus` to lightbox overlay

### 20b: Admin Tier Toggle — Support Basic (I24)
- Modify: `src/app/admin/(protected)/users/page.tsx` (line 294)
- Replace toggle button with `<select>` offering free/basic/pro

### 20c: Admin Delete Chat History Confirmation (M13)
- Modify: `src/app/admin/(protected)/users/page.tsx` (lines 323-331)
- Add `confirm()` before delete (admin page, acceptable here)

**Commit:**
```
fix: lightbox escape key, admin tier select, admin delete confirm (M14, I24, M13)
```

---

## Execution Order

1. **Tasks 1-3** (DB migrations + security) — do first, most critical
2. **Tasks 4-6** (checkout, middleware, rate limiting) — security layer
3. **Tasks 7-8** (admin hardening) — quick wins
4. **Tasks 9-13** (backend fixes) — data integrity
5. **Tasks 14-16** (frontend UX) — user-facing improvements
6. **Tasks 17-18** (limits + DB cleanup) — alignment fixes
7. **Tasks 19-20** (minor polish) — final cleanup

**Total: 20 tasks, ~20 commits**
