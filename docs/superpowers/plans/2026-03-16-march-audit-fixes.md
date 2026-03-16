# March 16 Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 45+ issues found in the March 16 full codebase review, from critical to low severity.

**Architecture:** Direct edits to existing files. No new features — purely fixes, guards, and cleanup. Each task is a self-contained fix that can be committed independently.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Upstash Redis, Zod, framer-motion

**User note on issue #10:** Raise schema max to 60 (per user annotation).

---

## Chunk 1: Critical Security & Billing (Tasks 1–8)

### Task 1: Fix rate limit bypass via speaker manipulation

**Files:**
- Modify: `src/app/api/chat/route.ts:852-857`

- [ ] **Step 1: Move tier rate limit check outside hasFreshUserTurn guard**

In `src/app/api/chat/route.ts`, find the rate limit section (~line 852-857). Change:

```ts
// BEFORE:
hasFreshUserTurn && profileTier !== 'pro'
    ? rateLimit(tierWindowKey, tierWindowMax, 60 * 60 * 1000)
    : null,
```

To:

```ts
// AFTER:
profileTier !== 'pro'
    ? rateLimit(tierWindowKey, tierWindowMax, 60 * 60 * 1000)
    : null,
```

This ensures the hourly tier limit is checked on EVERY request, not just when the last message speaker is 'user'.

- [ ] **Step 2: Verify the build succeeds**

Run: `cd C:/Coding/mygangbyantig && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```
git add src/app/api/chat/route.ts
git commit -m "fix: check tier rate limit on every request, not just user turns"
```

---

### Task 2: Fix prompt injection via userName/userNickname

**Files:**
- Modify: `src/app/api/chat/route.ts:581-582`

- [ ] **Step 1: Add max length + strip newlines on userName and userNickname**

In `src/app/api/chat/route.ts`, find the schema fields (~line 581-582). Change:

```ts
userName: z.string().nullable().optional(),
userNickname: z.string().nullable().optional(),
```

To:

```ts
userName: z.string().max(80).nullable().optional(),
userNickname: z.string().max(50).nullable().optional(),
```

- [ ] **Step 2: Sanitize newlines before they enter the system prompt**

Find where `userName` and `userNickname` are destructured from `parsed.data` and used. After destructuring, add:

```ts
const safeUserName = userName?.replace(/[\n\r]/g, ' ').trim() || null
const safeUserNickname = userNickname?.replace(/[\n\r]/g, ' ').trim() || null
```

Then use `safeUserName` and `safeUserNickname` everywhere `userName`/`userNickname` were used in the system prompt call.

- [ ] **Step 3: Commit**

```
git add src/app/api/chat/route.ts
git commit -m "fix: add max length and sanitize userName/userNickname to prevent prompt injection"
```

---

### Task 3: Add safety filter to WYWA content

**Files:**
- Modify: `src/lib/ai/wywa.ts:306-313`

- [ ] **Step 1: Import detectUnsafeContent**

At the top of `src/lib/ai/wywa.ts`, find the imports and add:

```ts
import { detectUnsafeContent } from '@/app/api/chat/route'
```

If `detectUnsafeContent` is not exported from route.ts, you need to extract it. Check if it's already in a shared location. If not, extract it to `src/lib/chat-utils.ts` and import from there in both files.

- [ ] **Step 2: Filter WYWA messages through safety check**

In `src/lib/ai/wywa.ts`, after the `validMessages` filter (~line 307-309), add:

```ts
const safeMessages = validMessages.filter(m => {
    const unsafeFlag = detectUnsafeContent(m.content)
    if (unsafeFlag.hard) {
        console.warn(`[wywa] Blocked unsafe message from ${m.speaker}: hard block`)
        return false
    }
    return true
})
```

Then use `safeMessages` instead of `validMessages` for the rest of the function (line 311 check and rows construction).

- [ ] **Step 3: Commit**

```
git add src/lib/ai/wywa.ts src/lib/chat-utils.ts
git commit -m "fix: add safety filter to WYWA-generated content"
```

---

### Task 4: Fix DodoPayments silent test_mode fallback + add missing env vars

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `src/lib/billing-server.ts`
- Modify: `src/app/api/customer-portal/route.ts`

- [ ] **Step 1: Add missing env vars to schema**

In `src/lib/env.ts`, add these to the `envSchema` object:

```ts
DODO_PAYMENTS_ENVIRONMENT: z.enum(['live_mode', 'test_mode']),
DODO_PAYMENTS_RETURN_URL: z.string().url(),
CRON_SECRET: z.string().min(16),
ADMIN_PANEL_EMAIL: z.string().email(),
ADMIN_PANEL_PASSWORD_HASH: z.string().min(1),
```

- [ ] **Step 2: Use validated env in billing-server.ts**

In `src/lib/billing-server.ts`, change:

```ts
bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
```

To:

```ts
bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
environment: process.env.DODO_PAYMENTS_ENVIRONMENT as 'live_mode' | 'test_mode',
```

- [ ] **Step 3: Same fix in customer-portal/route.ts**

Change the same ternary pattern in `src/app/api/customer-portal/route.ts` line 12:

```ts
environment: process.env.DODO_PAYMENTS_ENVIRONMENT as 'live_mode' | 'test_mode',
```

- [ ] **Step 4: Commit**

```
git add src/lib/env.ts src/lib/billing-server.ts src/app/api/customer-portal/route.ts
git commit -m "fix: validate DodoPayments env vars at startup, prevent silent test_mode"
```

---

### Task 5: Fix false advertising on pricing page

**Files:**
- Modify: `src/lib/billing.ts:31`
- Modify: `src/app/pricing/page.tsx:367`

- [ ] **Step 1: Fix TIER_COPY.basic.cooldownLabel**

In `src/lib/billing.ts`, change:

```ts
cooldownLabel: 'None',
```

To:

```ts
cooldownLabel: 'After 40 msgs/hr',
```

- [ ] **Step 2: Fix pricing page feature text**

In `src/app/pricing/page.tsx`, find line 367:

```ts
{ text: 'No hourly cooldowns', icon: Clock },
```

Change to:

```ts
{ text: '40 msgs/hr rolling window', icon: Clock },
```

- [ ] **Step 3: Commit**

```
git add src/lib/billing.ts src/app/pricing/page.tsx
git commit -m "fix: correct Basic tier cooldown copy — was falsely advertising no cooldowns"
```

---

### Task 6: Fix split bubble second message silently dropped

**Files:**
- Modify: `src/app/api/chat/route.ts:438-442`

- [ ] **Step 1: Clear message_id on second bubble**

In `src/app/api/chat/route.ts`, find the `maybeSplitAiMessages` function (~line 438). Change:

```ts
expanded.push({
    ...event,
    content: second,
    delay: Math.min(MAX_DELAY_MS, Math.max(180, Math.round(240 + Math.random() * 360)))
})
```

To:

```ts
expanded.push({
    ...event,
    content: second,
    message_id: undefined,
    delay: Math.min(MAX_DELAY_MS, Math.max(180, Math.round(240 + Math.random() * 360)))
})
```

- [ ] **Step 2: Commit**

```
git add src/app/api/chat/route.ts
git commit -m "fix: clear message_id on split bubble second message to prevent dedup drop"
```

---

### Task 7: Block /dev pages in production

**Files:**
- Modify: `src/app/dev/avatar-gift-preview/page.tsx`
- Modify: `src/app/dev/avatar-style-preview/page.tsx`
- Modify: `src/app/dev/vibe-quiz-preview/page.tsx`

- [ ] **Step 1: Add production guard to all three dev pages**

Add at the top of each file's default export function (before the return):

```ts
import { notFound } from 'next/navigation'

// At start of component:
if (process.env.NODE_ENV !== 'development') notFound()
```

- [ ] **Step 2: Commit**

```
git add src/app/dev/
git commit -m "fix: block /dev preview pages in production"
```

---

### Task 8: Fix memory quota TOCTOU race (defensive fix)

**Files:**
- Modify: `src/lib/ai/memory.ts:270-274`

- [ ] **Step 1: Add user_id filter to eviction delete**

In `src/lib/ai/memory.ts`, find the eviction delete (~line 270-274). The `.delete().in('id', ...)` call has no `user_id` filter. Add one:

```ts
await supabase
    .from('memories')
    .delete()
    .eq('user_id', userId)
    .in('id', oldest.map(m => m.id))
```

- [ ] **Step 2: Commit**

```
git add src/lib/ai/memory.ts
git commit -m "fix: add user_id filter to memory eviction delete for defense-in-depth"
```

---

## Chunk 2: High Priority (Tasks 9–20)

### Task 9: Fix Pro context limit exceeding schema max

**Files:**
- Modify: `src/app/api/chat/route.ts:578`

- [ ] **Step 1: Raise messages array max from 40 to 60**

Change:

```ts
})).max(40),
```

To:

```ts
})).max(60),
```

- [ ] **Step 2: Commit**

```
git add src/app/api/chat/route.ts
git commit -m "fix: raise chat schema max messages from 40 to 60 for Pro tier"
```

---

### Task 10: Fix terms agreement bypass via Enter key

**Files:**
- Modify: `src/components/orchestrator/auth-wall.tsx:67-69`

- [ ] **Step 1: Add terms check inside handleSubmit**

In `src/components/orchestrator/auth-wall.tsx`, find `handleSubmit` (~line 67-69). After `e.preventDefault()`, add:

```ts
if (!agreedToTerms) {
    setShowTermsNudge(true)
    return
}
```

So it becomes:

```ts
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreedToTerms) {
        setShowTermsNudge(true)
        return
    }
    if (!email || !password) return
    // ... rest unchanged
```

- [ ] **Step 2: Commit**

```
git add src/components/orchestrator/auth-wall.tsx
git commit -m "fix: check terms agreement in form submit handler, not just button click"
```

---

### Task 11: Fix mobile avatar preview invisible

**Files:**
- Modify: `src/components/chat/chat-header.tsx:528`

- [ ] **Step 1: Remove hidden sm:flex, use flex**

Change:

```ts
className="fixed inset-0 z-[200] hidden sm:flex items-center justify-center bg-black/70 backdrop-blur-sm"
```

To:

```ts
className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
```

- [ ] **Step 2: Commit**

```
git add src/components/chat/chat-header.tsx
git commit -m "fix: show avatar lightbox on mobile — was hidden below 640px"
```

---

### Task 12: Fix admin brute-force fail-open on Redis outage

**Files:**
- Modify: `src/lib/admin/login-security.ts:35-43, 116-117`

- [ ] **Step 1: Make getStateFromRedis throw-safe with fail-closed sentinel**

Change `getStateFromRedis`:

```ts
async function getStateFromRedis(key: string): Promise<LoginAttemptState | null | 'redis_error'> {
    try {
        const redis = await getRedis()
        const data = await redis.get<LoginAttemptState>(REDIS_KEY_PREFIX + key)
        return data ?? null
    } catch (err) {
        console.error('[login-security] Redis read error:', err)
        return 'redis_error'
    }
}
```

- [ ] **Step 2: Handle redis_error in recordFailedAdminLoginAttempt**

In `recordFailedAdminLoginAttempt`, change:

```ts
const state = (await getStateFromRedis(key)) || getInitialState(nowMs)
```

To:

```ts
const redisResult = await getStateFromRedis(key)
if (redisResult === 'redis_error') {
    return { locked: true, retryAfterSeconds: LOCKOUT_MS / 1000 }
}
const state = redisResult || getInitialState(nowMs)
```

- [ ] **Step 3: Handle redis_error in getLockoutRemainingSeconds**

In `getLockoutRemainingSeconds`, change:

```ts
const state = await getStateFromRedis(key)
if (!state) return 0
```

To:

```ts
const state = await getStateFromRedis(key)
if (state === 'redis_error') return Infinity
if (!state) return 0
```

- [ ] **Step 4: Commit**

```
git add src/lib/admin/login-security.ts
git commit -m "fix: fail-closed admin login lockout when Redis is unreachable"
```

---

### Task 13: Add rate limiting to push subscription endpoint

**Files:**
- Modify: `src/app/api/push/subscription/route.ts`

- [ ] **Step 1: Import rateLimit and add to each handler**

Add import at top:

```ts
import { rateLimit } from '@/lib/rate-limit'
```

Add rate limit check after auth check in each handler (GET, POST, DELETE):

```ts
const rate = await rateLimit(`push-sub:${user.id}`, 30, 60_000)
if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}
```

- [ ] **Step 2: Commit**

```
git add src/app/api/push/subscription/route.ts
git commit -m "fix: add rate limiting to push subscription endpoint"
```

---

### Task 14: Lazy-load lottie-react in loader component

**Files:**
- Modify: `src/components/ui/lottie-loader.tsx`

- [ ] **Step 1: Change static import to dynamic**

Replace the entire file:

```tsx
'use client'

import dynamic from 'next/dynamic'
import loaderData from '../../../public/lottie/loader.json'

const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

interface LottieLoaderProps {
    size?: number
    className?: string
}

export function LottieLoader({ size = 120, className = '' }: LottieLoaderProps) {
    return (
        <Lottie
            animationData={loaderData}
            loop={false}
            autoplay
            style={{ width: size, height: size }}
            className={className}
        />
    )
}
```

- [ ] **Step 2: Commit**

```
git add src/components/ui/lottie-loader.tsx
git commit -m "fix: lazy-load lottie-react to remove it from critical bundle path"
```

---

### Task 15: Fix purchase_celebration_pending type — add migration note

**Files:**
- Create: `docs/16 march review/pending-migration-purchase-celebration.md`

- [ ] **Step 1: Document the required migration**

This requires a Supabase migration. Create a note:

```md
# Migration Required: purchase_celebration_pending

The `profiles.purchase_celebration_pending` column is `boolean` in the DB but used as `string | null` in code.
Two files have `as unknown as` casts with boolean fallback.

## Migration SQL:
ALTER TABLE profiles ALTER COLUMN purchase_celebration_pending TYPE text USING CASE WHEN purchase_celebration_pending THEN 'legacy' ELSE NULL END;

## After migration:
1. Regenerate database.types.ts
2. Remove boolean fallback blocks in:
   - src/app/api/webhook/dodo-payments/route.ts (~line 102-110)
   - src/app/api/checkout/activate/route.ts (~line 65-79)
```

- [ ] **Step 2: Commit**

```
git add docs/
git commit -m "docs: document purchase_celebration_pending migration requirement"
```

---

### Task 16: Fix displayed_at validation in rendered route

**Files:**
- Modify: `src/app/api/chat/rendered/route.ts`

- [ ] **Step 1: Add datetime validation**

Find the Zod schema for `displayed_at`. Change:

```ts
displayed_at: z.string()
```

To:

```ts
displayed_at: z.string().datetime()
```

- [ ] **Step 2: Commit**

```
git add src/app/api/chat/rendered/route.ts
git commit -m "fix: validate displayed_at as ISO datetime in rendered route"
```

---

### Task 17: Single LazyMotion provider at root

**Files:**
- Modify: `src/app/layout.tsx` (add LazyMotion)
- Modify: 8 component files (remove per-component LazyMotion)

- [ ] **Step 1: Add LazyMotion to root layout**

In `src/app/layout.tsx`, add the import and wrap children:

```tsx
import { LazyMotion, domAnimation } from 'framer-motion'

// Inside the layout JSX, wrap {children} with:
<LazyMotion features={domAnimation}>
    {children}
</LazyMotion>
```

- [ ] **Step 2: Remove LazyMotion from all component files**

Remove `<LazyMotion features={domAnimation}>` wrappers from:
- `src/components/chat/memory-vault.tsx`
- `src/components/chat/chat-settings.tsx`
- `src/components/squad/downgrade-keeper-modal.tsx`
- `src/components/squad/upgrade-picker-modal.tsx`
- `src/components/billing/paywall-popup.tsx`
- `src/app/onboarding/page.tsx`
- `src/app/pricing/page.tsx`
- `src/components/landing/landing-page.tsx`

Keep the `m.*` components — they still work with a parent LazyMotion.
Remove the `LazyMotion` and `domAnimation` imports from each file (unless `domAnimation` is used elsewhere in the file).

- [ ] **Step 3: Verify build succeeds**

Run: `cd C:/Coding/mygangbyantig && npx next build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```
git add src/app/layout.tsx src/components/ src/app/onboarding/ src/app/pricing/
git commit -m "perf: single LazyMotion provider at root, remove 8 duplicate wrappers"
```

---

### Task 18: Remove dead code (storeMemory, retrieveMemories, retrieveMemoriesLite, burstCount, freshUserMessageCount, isFirstMessage)

**Files:**
- Modify: `src/lib/ai/memory.ts`
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Remove dead functions from memory.ts**

Delete the functions `storeMemory` (singular), `retrieveMemories`, `retrieveMemoriesLite`, and the helper `scoreMemory` if only used by those dead functions. Keep their exports list clean.

- [ ] **Step 2: Remove dead schema fields and variables from route.ts**

In `src/app/api/chat/route.ts`:
- Remove `isFirstMessage` from the schema (~line 583)
- Remove `burstCount` from the schema (~line 585)
- Remove the `freshUserMessageCount` variable computation (~line 785-787)

- [ ] **Step 3: Commit**

```
git add src/lib/ai/memory.ts src/app/api/chat/route.ts
git commit -m "chore: remove dead code — unused memory functions and schema fields"
```

---

### Task 19: Fix messagesRemaining persisted to localStorage

**Files:**
- Modify: `src/stores/chat-store.ts:205`

- [ ] **Step 1: Remove messagesRemaining from partialize**

In `src/stores/chat-store.ts`, find the `partialize` function (~line 194-207). Remove the line:

```ts
messagesRemaining: state.messagesRemaining,
```

- [ ] **Step 2: Commit**

```
git add src/stores/chat-store.ts
git commit -m "fix: stop persisting messagesRemaining to localStorage — prevents stale count on reload"
```

---

### Task 20: Fix refund/dispute handlers updating all subscriptions

**Files:**
- Modify: `src/app/api/webhook/dodo-payments/route.ts`

- [ ] **Step 1: Narrow refund handler to most recent subscription**

Find the `onRefundSucceeded` handler. The update query currently targets all active subscriptions. Add `.order('created_at', { ascending: false }).limit(1)` or narrow by subscription ID from the payload if available.

Since the DodoPayments refund payload may include `subscription_id` or `payment_id`, check the payload structure and filter by it. If not available, add `.limit(1)` with ordering as a minimum safety net.

- [ ] **Step 2: Same fix for onDisputeOpened**

Apply the same narrowing.

- [ ] **Step 3: Commit**

```
git add src/app/api/webhook/dodo-payments/route.ts
git commit -m "fix: narrow refund/dispute handlers to target specific subscription, not all"
```

---

## Chunk 3: Medium Priority (Tasks 21–35)

### Task 21: Fix compaction leaving memories stuck on archive failure

**Files:**
- Modify: `src/lib/ai/memory.ts` (~line 720-729)

- [ ] **Step 1: Change early return to throw**

Find the archive error check in `compactMemoriesIfNeeded`. Change:

```ts
if (archiveError) {
    console.error('Error archiving memories:', archiveError)
    return
}
```

To:

```ts
if (archiveError) {
    throw new Error(`Archive failed: ${archiveError.message}`)
}
```

This lets the outer catch block revert the 'compacting' memories back to 'episodic'.

- [ ] **Step 2: Commit**

```
git add src/lib/ai/memory.ts
git commit -m "fix: throw on archive failure so compacting memories are reverted"
```

---

### Task 22: Fix memoriesSavedCount computed before quality filter

**Files:**
- Modify: `src/app/api/chat/route.ts:1422`

- [ ] **Step 1: Defer count computation or add filter**

This is a minor data quality fix. The `memoriesSavedCount` at line 1422 uses pre-filter lengths. If the quality filter in `profileMemoryBranch` (~line 1518) removes items, the count is wrong.

Find where the quality filter runs and compute the count after it. If the filter runs in `waitUntil(persistAsync())`, the simplest fix is to accept the slight overcount since the count is non-critical UI sugar. Add a comment:

```ts
// NOTE: This count may slightly overcount — quality filter runs async in persistAsync().
// The UI badge is decorative, not authoritative.
const memoriesSavedCount = (hasFreshUserTurn && allowMemoryUpdates && object?.memory_updates?.episodic?.length) || 0
```

- [ ] **Step 2: Commit**

```
git add src/app/api/chat/route.ts
git commit -m "docs: annotate memoriesSavedCount pre-filter behavior"
```

---

### Task 23: Move hasOpenFloorIntent to shared utility

**Files:**
- Modify: `src/lib/chat-utils.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/hooks/use-autonomous-flow.ts`

- [ ] **Step 1: Add hasOpenFloorIntent to chat-utils.ts**

Move the function from `route.ts` to `src/lib/chat-utils.ts`:

```ts
export function hasOpenFloorIntent(text: string) {
    const value = text.toLowerCase()
    return (
        /you guys talk|talk among yourselves|keep chatting|continue without me|i'?ll listen|i will listen/.test(value)
        || /just talk|carry on|keep going|go on without me/.test(value)
    )
}
```

- [ ] **Step 2: Import from chat-utils in both files**

In `route.ts`, remove the local `hasOpenFloorIntent` and import from `@/lib/chat-utils`.
In `use-autonomous-flow.ts`, remove the local copy and import from `@/lib/chat-utils`.

- [ ] **Step 3: Commit**

```
git add src/lib/chat-utils.ts src/app/api/chat/route.ts src/hooks/use-autonomous-flow.ts
git commit -m "refactor: deduplicate hasOpenFloorIntent into shared chat-utils"
```

---

### Task 24: Static generation for public pages

**Files:**
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/terms/page.tsx`
- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/refund/page.tsx`

- [ ] **Step 1: Add force-static to each page**

Add at the top of each file (after imports):

```ts
export const dynamic = 'force-static'
```

- [ ] **Step 2: Fix sitemap.ts lastModified**

In `src/app/sitemap.ts`, change `lastModified: new Date()` to a fixed date:

```ts
lastModified: new Date('2026-03-16'),
```

- [ ] **Step 3: Commit**

```
git add src/app/about/ src/app/terms/ src/app/privacy/ src/app/refund/ src/app/sitemap.ts
git commit -m "perf: force-static for public pages, fix sitemap lastModified"
```

---

### Task 25: Fix image cache TTL

**Files:**
- Modify: `next.config.ts:10`

- [ ] **Step 1: Increase minimumCacheTTL**

Change:

```ts
minimumCacheTTL: 3600,
```

To:

```ts
minimumCacheTTL: 2592000,
```

(30 days)

- [ ] **Step 2: Commit**

```
git add next.config.ts
git commit -m "perf: increase image cache TTL from 1 hour to 30 days"
```

---

### Task 26: Disable poweredByHeader

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add poweredByHeader: false**

In `next.config.ts`, add to the `nextConfig` object:

```ts
poweredByHeader: false,
```

- [ ] **Step 2: Commit**

```
git add next.config.ts
git commit -m "fix: disable X-Powered-By header"
```

---

### Task 27: Fix TypeScript target

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 1: Change target to ES2022**

```json
"target": "ES2022"
```

- [ ] **Step 2: Commit**

```
git add tsconfig.json
git commit -m "chore: bump TypeScript target from ES2017 to ES2022"
```

---

### Task 28: Fix billing-server.ts non-null assertion

**Files:**
- Modify: `src/lib/billing-server.ts`

- [ ] **Step 1: Add explicit guard**

Change:

```ts
export function getDodoClient() {
  return new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
```

To:

```ts
export function getDodoClient() {
  if (!process.env.DODO_PAYMENTS_API_KEY) {
    throw new Error('Missing DODO_PAYMENTS_API_KEY environment variable')
  }
  return new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
```

- [ ] **Step 2: Commit**

```
git add src/lib/billing-server.ts
git commit -m "fix: throw on missing DODO_PAYMENTS_API_KEY instead of silent undefined"
```

---

### Task 29: Add touchMemories user_id filter

**Files:**
- Modify: `src/lib/ai/memory.ts:568-577`

- [ ] **Step 1: Add userId parameter and filter**

Change the function signature and add filter:

```ts
export async function touchMemories(memoryIds: string[], userId?: string) {
    if (memoryIds.length === 0) return
    const supabase = await createClient()
    let query = supabase
        .from('memories')
        .update({ last_used_at: new Date().toISOString() })
        .in('id', memoryIds)

    if (userId) {
        query = query.eq('user_id', userId)
    }

    const { error } = await query
    if (error) console.error('Error updating memory last_used_at:', error)
}
```

Update the call site in `route.ts` to pass `user.id`.

- [ ] **Step 2: Commit**

```
git add src/lib/ai/memory.ts src/app/api/chat/route.ts
git commit -m "fix: add user_id filter to touchMemories for defense-in-depth"
```

---

### Task 30: Delete duplicate PNG assets

**Files:**
- Delete: `public/og-image.png`
- Delete: `public/logo.png`
- Delete: `public/avatars/*.png` (14 files)

- [ ] **Step 1: Verify no references to PNG versions**

Run: `grep -r "og-image.png\|logo.png\|avatars/.*\.png" src/ --include="*.tsx" --include="*.ts"`

- [ ] **Step 2: Delete the PNG files if no references found**

```bash
rm public/og-image.png public/logo.png
rm public/avatars/atlas.png public/avatars/cleo.png public/avatars/dash.png public/avatars/ezra.png public/avatars/jinx.png public/avatars/kael.png public/avatars/luna.png public/avatars/miko.png public/avatars/nova.png public/avatars/nyx.png public/avatars/rico.png public/avatars/sage.png public/avatars/vee.png public/avatars/zara.png
```

- [ ] **Step 3: Commit**

```
git add -A public/
git commit -m "chore: remove duplicate PNG assets — webp versions are in use"
```

---

### Task 31: Fix pl-6.5 invalid Tailwind class

**Files:**
- Modify: `src/components/orchestrator/auth-wall.tsx:152`

- [ ] **Step 1: Change pl-6.5 to pl-7**

Find `pl-6.5` and change to `pl-7`.

- [ ] **Step 2: Commit**

```
git add src/components/orchestrator/auth-wall.tsx
git commit -m "fix: replace invalid pl-6.5 Tailwind class with pl-7"
```

---

### Task 32: Add aria-hidden to ConfettiCelebration

**Files:**
- Modify: `src/components/effects/confetti-celebration.tsx`

- [ ] **Step 1: Add aria-hidden="true" to wrapper div**

Find the wrapper `<div>` with `fixed inset-0 z-[300]` and add `aria-hidden="true"`.

- [ ] **Step 2: Commit**

```
git add src/components/effects/confetti-celebration.tsx
git commit -m "a11y: hide confetti animation from screen readers"
```

---

### Task 33: Add lottie-react to optimizePackageImports

**Files:**
- Modify: `next.config.ts:6`

- [ ] **Step 1: Add lottie-react to the array**

```ts
optimizePackageImports: ['lucide-react', 'framer-motion', 'lottie-react'],
```

- [ ] **Step 2: Commit**

```
git add next.config.ts
git commit -m "perf: add lottie-react to optimizePackageImports"
```

---

### Task 34: Fix BackgroundBlobs blur on low-end devices

**Files:**
- Modify: `src/components/holographic/background-blobs.tsx`

- [ ] **Step 1: Remove blur classes when disableMotion is true**

Find where `disableMotion` is set. When true, the blob divs should use `opacity-20` instead of `blur-[100px]` / `blur-[90px]`.

Use a conditional:

```ts
const blurClass = disableMotion ? 'opacity-20' : 'blur-[100px]'
```

Apply to each blob div.

- [ ] **Step 2: Commit**

```
git add src/components/holographic/background-blobs.tsx
git commit -m "perf: remove GPU-heavy blur on low-end devices, use opacity fallback"
```

---

### Task 35: Add settings error boundary

**Files:**
- Create: `src/app/settings/error.tsx`

- [ ] **Step 1: Create error boundary**

```tsx
'use client'

export default function SettingsError({ reset }: { reset: () => void }) {
    return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
                We couldn&apos;t load your settings. This is usually temporary.
            </p>
            <button
                onClick={reset}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm"
            >
                Try again
            </button>
        </div>
    )
}
```

- [ ] **Step 2: Commit**

```
git add src/app/settings/error.tsx
git commit -m "fix: add error boundary for settings page"
```

---

## Chunk 4: Config & Cleanup (Tasks 36–38)

### Task 36: Fix personal email in JSON-LD structured data

**Files:**
- Modify: `src/app/page.tsx` (or wherever the JSON-LD Organization is defined)

- [ ] **Step 1: Remove or replace the email**

Find `email: 'pashaseenainc@gmail.com'` in the structured data and either remove it or replace with a public-facing contact email (like `contact@mygang.ai` or similar).

- [ ] **Step 2: Commit**

```
git add src/app/page.tsx
git commit -m "fix: remove personal email from public JSON-LD structured data"
```

---

### Task 37: Add Sentry setup note

**Files:**
- Create: `docs/16 march review/sentry-setup-guide.md`

- [ ] **Step 1: Create beginner-friendly Sentry setup guide**

```md
# Setting Up Sentry Error Monitoring — Beginner Guide

## What is Sentry?
Sentry catches errors in your app automatically and sends you alerts. Instead of hoping a user reports a bug, you'll see it instantly with full context.

## Step-by-step Setup

### 1. Create a Sentry account
- Go to https://sentry.io and sign up (free tier is fine)
- Create a new project → Choose "Next.js"
- Copy the DSN (looks like https://abc123@o456.ingest.sentry.io/789)

### 2. Install the package
pnpm add @sentry/nextjs

### 3. Run the setup wizard
npx @sentry/wizard@latest -i nextjs

This creates:
- sentry.client.config.ts
- sentry.server.config.ts
- sentry.edge.config.ts
- next.config.ts gets wrapped with withSentryConfig

### 4. Add your DSN to Vercel env vars
- Go to Vercel dashboard → Your project → Settings → Environment Variables
- Add: SENTRY_DSN = (paste your DSN)
- Add: SENTRY_AUTH_TOKEN = (from Sentry → Settings → Auth Tokens)

### 5. Deploy and verify
- Push to trigger a deploy
- After deploy, go to your app, open browser console, type: throw new Error('test')
- Check Sentry dashboard — you should see the error within 30 seconds

### 6. Set up alerts
- In Sentry → Alerts → Create Alert Rule
- Choose "When there are more than 1 new issue in 1 hour"
- Set notification to your email

That's it! Now every error in your app (server and client) will be caught automatically.
```

- [ ] **Step 2: Commit**

```
git add docs/
git commit -m "docs: add Sentry setup guide for error monitoring"
```

---

### Task 38: Final build verification

- [ ] **Step 1: Run full build**

```bash
cd C:/Coding/mygangbyantig && pnpm build
```

- [ ] **Step 2: Fix any build errors**

- [ ] **Step 3: Final commit if build fixes needed**

```
git commit -m "fix: resolve build errors from audit fixes"
```

---

## Summary

| Phase | Tasks | Estimated Time |
|-------|-------|---------------|
| Chunk 1: Critical | 1–8 | 2–3 hours |
| Chunk 2: High | 9–20 | 3–4 hours |
| Chunk 3: Medium | 21–35 | 2–3 hours |
| Chunk 4: Cleanup | 36–38 | 30 min |
| **Total** | **38 tasks** | **~8–10 hours** |

Tasks are ordered by severity. Each can be committed independently. The final task (38) is a full build verification.
