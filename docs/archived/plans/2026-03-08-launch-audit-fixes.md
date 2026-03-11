# Launch Audit Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the 1 critical and top ~20 important findings from the full launch audit (`docs/plans/full-launch-audit.md`).

**Architecture:** All fixes are independent, small edits to existing files. No new features, no refactoring.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Upstash Redis, Zustand, Tailwind CSS v4

---

### Task 1: [BILLING-C1] Block ecosystem mode for free tier on server

**Files:**
- Modify: `src/app/api/chat/route.ts:757` (after `profileTier` is determined)

**Step 1: Add ecosystem gate after tier determination**

At line 757 (after `const profileTier = getTierFromProfile(...)` and before the rate limit block), add:

```typescript
        // BILLING-C1: Ecosystem mode is Basic/Pro only
        if (chatMode === 'ecosystem' && profileTier === 'free') {
            return Response.json({
                events: [{
                    type: 'message',
                    character: 'system',
                    content: 'Ecosystem mode is available on Basic and Pro plans. Upgrade to unlock it!',
                    delay: 200
                }],
                paywall: true,
                tier: 'free'
            }, { status: 403 })
        }
```

**Step 2: Verify build**

Run: `pnpm build` (or `pnpm tsc --noEmit`)
Expected: No type errors

**Step 3: Commit**

```
fix: block ecosystem chat mode for free-tier users on server
```

---

### Task 2: [UF-I7] Reset chatMode to gang_focus on free-tier downgrade

**Files:**
- Modify: `src/components/orchestrator/auth-manager.tsx:50-63` (inside `syncProfileState`)

**Step 1: Add chatMode reset in syncProfileState**

Inside the `syncProfileState` function, after determining `nextTier` (line 53), add a check before setting chatMode:

```typescript
        const syncProfileState = (profile: Awaited<ReturnType<typeof fetchJourneyState>>['profile']) => {
            if (!profile) return

            const nextTier = getTierFromProfile(profile.subscription_tier ?? null)
            // UF-I7: Force gang_focus if free tier (ecosystem is paid-only)
            const safeChatMode = nextTier === 'free' ? 'gang_focus' : (profile.chat_mode ?? undefined)
            useChatStore.setState((state) => ({
                ...state,
                subscriptionTier: nextTier,
                chatMode: safeChatMode ?? state.chatMode,
                lowCostMode: typeof profile.low_cost_mode === 'boolean' ? profile.low_cost_mode : state.lowCostMode,
                chatWallpaper: profile.chat_wallpaper ?? state.chatWallpaper,
                customCharacterNames: profile.custom_character_names && typeof profile.custom_character_names === 'object'
                    ? profile.custom_character_names
                    : state.customCharacterNames,
            }))
        }
```

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
fix: reset chatMode to gang_focus when tier is free
```

---

### Task 3: [UF-I8] Clear chat draft on sign-out

**Files:**
- Modify: `src/components/settings/settings-panel.tsx:377` (sign out handler)
- Modify: `src/components/chat/chat-settings.tsx` (sign out handler — find the `signOut()` call)
- Modify: `src/components/orchestrator/auth-manager.tsx:29-47` (clearAuthState)

**Step 1: Add draft cleanup in clearAuthState (covers all sign-out paths)**

In `auth-manager.tsx`, inside the `clearAuthState` function (around line 29), add after `clearChat()`:

```typescript
        const clearAuthState = () => {
            useChatStore.setState({
                userId: null,
                activeGang: [],
                userName: null,
                userNickname: null,
                subscriptionTier: 'free',
                chatMode: 'gang_focus',
                lowCostMode: false,
                chatWallpaper: 'default',
                customCharacterNames: {},
                squadConflict: null,
                pendingUpgrade: null,
                pendingDowngrade: null,
                messagesRemaining: null,
                cooldownSeconds: null,
            })
            clearChat()
            // UF-I8: Clear draft so next user doesn't see it
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem('mygang-chat-draft')
            }
            hadSessionRef.current = false
        }
```

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
fix: clear chat draft from localStorage on sign-out
```

---

### Task 4: [SEC-I1 + SEC-I2] Add rate limiting to unprotected server actions

**Files:**
- Modify: `src/app/auth/actions.ts` (lines 145, 230, 269, 283, 445, 463, 481)

**Step 1: Add rate limiting to deleteAllMessages and deleteAllMemories**

At line 445, inside `deleteAllMessages()`, add after auth check:

```typescript
export async function deleteAllMessages() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated.' }

    // SEC-I1: Rate limit bulk delete
    try {
        const rate = await rateLimit('delete-all-messages:' + user.id, 3, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait.' }
    }

    // ... rest unchanged
```

Same pattern for `deleteAllMemories()` at line 463:

```typescript
export async function deleteAllMemories() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated.' }

    // SEC-I1: Rate limit bulk delete
    try {
        const rate = await rateLimit('delete-all-memories:' + user.id, 3, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait.' }
    }

    // ... rest unchanged
```

**Step 2: Add rate limiting to saveGang, saveUsername, deleteMemory, updateMemory, saveMemoryManual**

For `saveGang` (line 145), add after auth check:
```typescript
    try {
        const rate = await rateLimit('save-gang:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }
```

For `saveUsername` (line 230), add after auth check:
```typescript
    try {
        const rate = await rateLimit('save-username:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }
```

For `deleteMemory` (line 269), add after auth check:
```typescript
    try {
        const rate = await rateLimit('delete-memory:' + user.id, 20, 60_000)
        if (!rate.success) return
    } catch { return }
```

For `updateMemory` (line 283), add after auth check:
```typescript
    try {
        const rate = await rateLimit('update-memory:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }
```

For `saveMemoryManual` (line 481), add after auth check:
```typescript
    try {
        const rate = await rateLimit('save-memory:' + user.id, 10, 60_000)
        if (!rate.success) return
    } catch { return }
```

**Step 3: Verify build**

Run: `pnpm tsc --noEmit`

**Step 4: Commit**

```
fix: add rate limiting to all unprotected server actions
```

---

### Task 5: [SEC-I3] Add rate limiting to signInOrSignUpWithPassword

**Files:**
- Modify: `src/app/auth/actions.ts:66`

**Step 1: Add rate limit at start of function**

```typescript
export async function signInOrSignUpWithPassword(email: string, password: string) {
    // SEC-I3: App-level rate limit for auth attempts
    try {
        const rate = await rateLimit('auth-login:' + email.toLowerCase().trim(), 10, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait a moment.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait a moment.' }
    }

    const supabase = await createClient()
    // ... rest unchanged
```

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
fix: add app-level rate limiting to auth login
```

---

### Task 6: [UF-I4] Handle 401 session expiry in chat API client

**Files:**
- Modify: `src/hooks/use-chat-api.ts:327` (inside the `!res.ok` block)

**Step 1: Add 401 handling before the generic error handler**

After `if (!res.ok) {` (line 327), add a 401-specific check before the existing `trackEvent` call:

```typescript
            if (!res.ok) {
                // UF-I4: Detect expired session and prompt re-login
                if (res.status === 401) {
                    updateUserDeliveryStatus(pendingDeliveryIdsForCall, 'failed', 'Session expired')
                    onToast('Your session has expired. Please sign in again.')
                    setTimeout(() => {
                        if (typeof window !== 'undefined') window.location.href = '/'
                    }, 2000)
                    return
                }

                // ... existing trackEvent and error handling unchanged
```

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
fix: show clear message and redirect on session expiry during chat
```

---

### Task 7: [UF-I5 + UF-I6] Fix checkout success polling and navigation

**Files:**
- Modify: `src/app/checkout/success/page.tsx`

**Step 1: Add cancellation ref and fix router.replace**

Replace the `SuccessContent` component's useEffect:

```typescript
function SuccessContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [status, setStatus] = useState<'activating' | 'pending' | 'success' | 'error'>('activating')
    const [resolvedPlan, setResolvedPlan] = useState<'basic' | 'pro' | null>(null)
    const [statusHint, setStatusHint] = useState('Just a moment while we power up your gang')
    const cancelledRef = useRef(false)  // UF-I5: Track unmount

    useEffect(() => {
        cancelledRef.current = false  // Reset on mount

        const subscriptionId = searchParams.get('subscription_id')
        const expectedPlan = searchParams.get('plan')
        const normalizedPlan = expectedPlan === 'pro' || expectedPlan === 'basic'
            ? expectedPlan
            : null

        const finalizeActivation = (plan: 'basic' | 'pro') => {
            if (cancelledRef.current) return  // UF-I5: Don't update unmounted component
            setResolvedPlan(plan)
            useChatStore.getState().setSubscriptionTier(plan)
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('mygang_just_purchased', plan)
            }
            setStatus('success')
            setTimeout(() => {
                if (!cancelledRef.current) router.replace('/chat')  // UF-I6: replace not push
            }, 3000)
        }

        const pollActivation = async () => {
            const startedAt = Date.now()
            const timeoutMs = 45_000

            if (!subscriptionId && !normalizedPlan) {
                if (!cancelledRef.current) {
                    setStatus('error')
                    setStatusHint('We could not confirm your upgrade yet.')
                }
                return
            }

            while (!cancelledRef.current && Date.now() - startedAt < timeoutMs) {
                // ... existing poll logic unchanged, but wrap setState calls with cancelledRef check
```

Also update the button onClicks from `router.push('/chat')` to `router.replace('/chat')` at lines 148 and 170.

**Step 2: Add useEffect cleanup**

At the end of the useEffect, add:
```typescript
        return () => { cancelledRef.current = true }
```

Also add `useRef` to the import.

**Step 3: Verify build**

Run: `pnpm tsc --noEmit`

**Step 4: Commit**

```
fix: cancel checkout polling on unmount, use router.replace
```

---

### Task 8: [UF-I2] Persist cooldown timer to sessionStorage

**Files:**
- Modify: `src/app/chat/page.tsx` (where `cooldownUntil` state is defined and set)

**Step 1: Initialize cooldownUntil from sessionStorage**

Find `const [cooldownUntil, setCooldownUntil] = useState(0)` and replace with:

```typescript
    const [cooldownUntil, setCooldownUntil] = useState(() => {
        if (typeof window === 'undefined') return 0
        const saved = window.sessionStorage.getItem('mygang-cooldown-until')
        if (!saved) return 0
        const ts = parseInt(saved, 10)
        return ts > Date.now() ? ts : 0
    })
```

**Step 2: Persist cooldownUntil to sessionStorage when set**

Find the place where `setCooldownUntil` is called (should be in the onPaywall callback) and add persistence:

```typescript
    // In the onPaywall callback or wherever setCooldownUntil is called:
    const newCooldownUntil = Date.now() + cooldownSec * 1000
    setCooldownUntil(newCooldownUntil)
    if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('mygang-cooldown-until', String(newCooldownUntil))
    }
```

**Step 3: Verify build**

Run: `pnpm tsc --noEmit`

**Step 4: Commit**

```
fix: persist cooldown timer to sessionStorage across page refresh
```

---

### Task 9: [VIS-I1] Add geistMono.variable to body className

**Files:**
- Modify: `src/app/layout.tsx:106`

**Step 1: Add the missing variable**

Change line 106 from:
```tsx
        className={`${geistSans.variable} ${outfit.variable} antialiased`}
```
to:
```tsx
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
```

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
fix: apply geistMono font variable to body element
```

---

### Task 10: [VIS-I2] Fix upgrade-picker-modal z-index

**Files:**
- Modify: `src/components/squad/upgrade-picker-modal.tsx:117`

**Step 1: Change z-50 to z-[100]**

Find the root overlay div (around line 117) and change `z-50` to `z-[100]`.

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
fix: raise upgrade-picker-modal z-index to match downgrade-keeper
```

---

### Task 11: [PERF-I1] Parallelize semantic dedup match_memories calls

**Files:**
- Modify: `src/lib/ai/memory.ts:281-298`

**Step 1: Replace sequential loop with Promise.all**

Replace lines 281-298:

```typescript
        // M-I3: Semantic deduplication — skip memories with >0.9 embedding similarity to recent ones
        let finalRows = withEmbeddings
        if (!skipEmbeddings) {
            const rowsWithEmbeddings = withEmbeddings.filter(r => r.embedding !== null)
            if (rowsWithEmbeddings.length > 0 && existing && existing.length > 0) {
                const semanticDupIndices = new Set<number>()
                // PERF-I1: Parallel semantic dedup checks
                const checks = await Promise.all(
                    rowsWithEmbeddings.map(async (row) => {
                        try {
                            const { data: similar } = await supabase.rpc('match_memories', {
                                query_embedding: row.embedding,
                                match_threshold: 0.9,
                                match_count: 1,
                                p_user_id: userId,
                            })
                            return similar && similar.length > 0
                        } catch (err) {
                            console.error('Semantic dedup check error:', err)
                            return false
                        }
                    })
                )
                rowsWithEmbeddings.forEach((row, i) => {
                    if (checks[i]) {
                        const idx = withEmbeddings.indexOf(row)
                        if (idx >= 0) semanticDupIndices.add(idx)
                    }
                })
                if (semanticDupIndices.size > 0) {
                    finalRows = withEmbeddings.filter((_, i) => !semanticDupIndices.has(i))
                }
            }
        }
```

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
perf: parallelize semantic dedup memory checks
```

---

### Task 12: [A11Y-I1] Add id="main-content" to About/Privacy/Terms pages

**Files:**
- Modify: `src/app/about/page.tsx` — add `id="main-content"` to `<main>`
- Modify: `src/app/privacy/page.tsx` — add `id="main-content"` to `<main>`
- Modify: `src/app/terms/page.tsx` — add `id="main-content"` to `<main>`

**Step 1: Add the id attribute to each page's main element**

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
fix: add main-content id to about/privacy/terms for skip link
```

---

### Task 13: [A11Y-I3 + A11Y-I4] Typing indicator and pricing table accessibility

**Files:**
- Modify: `src/components/chat/message-list.tsx:378-405` — add role="status" to typing indicator
- Modify: `src/app/pricing/page.tsx:71-87` — add aria-label to check/x icons

**Step 1: Add role="status" to typing indicator wrapper**

Find the typing indicator div (around line 378) and add `role="status"` and an `aria-label`:

```tsx
<div className="px-4 pt-2 pb-1" role="status" aria-label={`${typingCharacterNames} typing`}>
```

**Step 2: Add aria-label to FeatureValue icons**

In the `FeatureValue` component (around line 71-87), wrap icons with accessible labels:

```tsx
if (typeof value === 'boolean') {
    return value ? (
        <span className="..." role="img" aria-label="Included"><Check ... /></span>
    ) : (
        <span className="..." role="img" aria-label="Not included"><X ... /></span>
    )
}
```

**Step 3: Verify build**

Run: `pnpm tsc --noEmit`

**Step 4: Commit**

```
fix: add screen reader support for typing indicator and pricing table
```

---

### Task 14: [SEO-I1] Add metadata to pricing page

**Files:**
- Create: `src/app/pricing/layout.tsx`

**Step 1: Create pricing layout with metadata**

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Pricing',
    description: 'Choose the perfect MyGang.ai plan. Free forever, Basic at $14.99/mo, or Pro at $19.99/mo with unlimited messages and full memory.',
    alternates: { canonical: '/pricing' },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
    return children
}
```

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
feat: add SEO metadata for pricing page
```

---

### Task 15: [SEO-N1] Add /pricing to sitemap

**Files:**
- Modify: `src/app/sitemap.ts`

**Step 1: Add pricing entry**

Add to the routes array:
```typescript
{ url: `${siteUrl}/pricing`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.9 },
```

**Step 2: Commit**

```
fix: add /pricing to sitemap
```

---

### Task 16: [UF-I1] Fix chat settings sign-out error handling

**Files:**
- Modify: `src/components/chat/chat-settings.tsx` (find the Sign Out button handler)

**Step 1: Add loading state and try/catch**

Find the sign-out handler (around line 698-706) and update to match the pattern from settings-panel.tsx. Add an `isSigningOut` state and wrap in try/catch, only clearing store after `signOut()` succeeds.

**Step 2: Verify build**

Run: `pnpm tsc --noEmit`

**Step 3: Commit**

```
fix: add loading state and error handling to chat settings sign-out
```

---

### Task 17: [DB-I1] Add error handling to handle_new_user trigger

**Files:**
- Create: `supabase/migrations/20260308_handle_new_user_exception.sql`

**Step 1: Write migration**

```sql
-- DB-I1: Add error handling to prevent signup failure if profile insert fails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(LEFT(NEW.raw_user_meta_data->>'username', 100), NULL)
  );
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  RETURN NEW;
WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
```

**Step 2: Apply migration**

Run: `supabase db push` (or apply via Supabase dashboard)

**Step 3: Commit**

```
fix: add exception handling to handle_new_user trigger
```

---

### Task 18: [DB-I2] Add CHECK constraint on memories.importance

**Files:**
- Create: `supabase/migrations/20260308_memories_importance_check.sql`

**Step 1: Write migration**

```sql
-- DB-I2: Constrain importance to valid range
ALTER TABLE memories ADD CONSTRAINT memories_importance_range CHECK (importance >= 0 AND importance <= 10);
```

**Step 2: Apply migration**

**Step 3: Commit**

```
fix: add CHECK constraint on memories.importance column
```

---

### Task 19: [PERF-I2] Add composite index for speaker-filtered chat history

**Files:**
- Create: `supabase/migrations/20260308_chat_history_speaker_index.sql`

**Step 1: Write migration**

```sql
-- PERF-I2: Speed up speaker-filtered chat history queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_history_user_gang_speaker_created
ON chat_history(user_id, gang_id, speaker, created_at DESC);
```

**Step 2: Apply migration**

**Step 3: Commit**

```
perf: add composite index for speaker-filtered chat history queries
```

---

### Task 20: Final verification

**Step 1: Run full build**

Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 2: Commit all and push**

```
git add .
git commit -m "chore: full launch audit fixes — 1 critical + 18 important items"
git push origin master
```
