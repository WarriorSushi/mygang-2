# Spam Message Fix + Start Fresh Button — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the message spam exploit (usage counting + client throttle) and add a "Start Fresh" button to reset onboarding without touching billing.

**Architecture:** Two independent tracks. Track A fixes the spam exploit with a client-side send throttle in ChatInput and server-side per-message usage counting in the chat API route. Track B adds a "Start Fresh" button in the settings panel that calls existing delete actions + a new resetOnboarding server action, clears local state, and redirects to onboarding.

**Tech Stack:** Next.js 16, React, Zustand, Supabase, Upstash Redis rate limiting

---

## Track A: Fix Spam Message Exploit

### Task 1: Client-Side Send Throttle

**Files:**
- Modify: `src/components/chat/chat-input.tsx`

**Step 1: Add throttle ref and guard to ChatInput**

In `src/components/chat/chat-input.tsx`, add a `useRef` for throttle timing and block sends during the cooldown:

```tsx
// Add after line 33 (after draftSaveTimerRef)
const sendThrottleRef = useRef(false)
```

Then modify `handleSubmit` (line 67-77) to set the throttle:

```tsx
const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (input.trim() && !disabled && !sendThrottleRef.current) {
        sendThrottleRef.current = true
        setTimeout(() => { sendThrottleRef.current = false }, 800)
        onSend(input, { replyToId: replyingTo?.id })
        setInput('')
        onCancelReply?.()
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(DRAFT_STORAGE_KEY)
        }
    }
}
```

Also update the send button disabled state (line 171) to include throttle:

The button already uses `disabled={!input.trim() || disabled}`. We don't add sendThrottleRef here because refs don't trigger re-renders. The throttle is purely a guard inside handleSubmit — the button stays visually enabled but handleSubmit silently ignores rapid clicks. This is intentional: avoids a flash of disabled state on every send.

**Step 2: Also throttle starter chip sends**

The starter chips at line 134 call `onSend(chip)` directly, bypassing handleSubmit. Wrap them too:

```tsx
onClick={() => {
    if (sendThrottleRef.current) return
    sendThrottleRef.current = true
    setTimeout(() => { sendThrottleRef.current = false }, 800)
    onSend(chip)
}}
```

**Step 3: Verify build compiles**

Run: `pnpm build` (or `pnpm tsc --noEmit` for faster type check)
Expected: No type errors

**Step 4: Commit**

```
fix: add 800ms send throttle to prevent message spam
```

---

### Task 2: Server-Side Per-Message Usage Counting

**Files:**
- Modify: `src/app/api/chat/route.ts` (lines ~721-726 and ~1431)

**Step 1: Count fresh user messages in the payload**

Currently at line 721-725:
```ts
const userMessages = safeMessages.filter((m) => m.speaker === 'user')
const lastUserMessage = userMessages[userMessages.length - 1]
const previousUserMessage = userMessages[userMessages.length - 2]
const latestMessage = safeMessages[safeMessages.length - 1]
const hasFreshUserTurn = latestMessage?.speaker === 'user'
```

Add a count of user messages with `deliveryStatus === 'sending'` IDs (these are the new ones the client just sent). But the server doesn't receive deliveryStatus — it receives raw messages. Instead, we need to count how many user messages in the payload are NEW (not yet in DB).

The simplest approach: count user messages that have client-generated IDs (starting with `user-`). These are unsaved messages. After dedup against DB, the actual inserted count is what matters. But that happens much later in the flow (line ~1540).

**Better approach:** Count user messages in the payload whose IDs start with `user-` (client-generated, not yet persisted). This is the count of fresh user messages in this batch. Use this for `dailyMsgIncrement`.

At line ~725, after `hasFreshUserTurn`, add:

```ts
const freshUserMessageCount = hasFreshUserTurn
    ? userMessages.filter((m) => m.id && m.id.startsWith('user-')).length
    : 0
```

**Step 2: Use freshUserMessageCount for daily increment**

At line 1431, change:
```ts
const dailyMsgIncrement = hasFreshUserTurn && lastUserMsg ? 1 : 0
```
to:
```ts
const dailyMsgIncrement = freshUserMessageCount
```

**Step 3: Consume correct number of rate limit slots**

At lines 780-784, the tier rate limit currently consumes 1 slot per API call. We need to consume `freshUserMessageCount` slots instead. The Upstash `rateLimit()` function always consumes 1 slot per call. To consume N slots, we call it N times (or better, loop).

Actually, looking at the rate limit implementation — it uses `Ratelimit.slidingWindow` which consumes 1 token per `.limit()` call. There's no built-in way to consume multiple tokens in one call.

**Simpler approach:** Don't change the rate limit call itself. Instead, the rate limit already fires once per API call. Since we now have the client throttle preventing rapid sends, the 1-per-call rate limit is fine. The **real fix** is the `dailyMsgIncrement` counting — that's what tracks hourly usage for the paywall. The global rate limit (60/min) is a spam guard and 1-per-call is correct for that.

So the only server change is:
- Line ~725: add `freshUserMessageCount`
- Line ~1431: use `freshUserMessageCount` instead of `1`

**Step 4: Verify build compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```
fix: count each user message toward usage instead of 1 per API call
```

---

## Track B: Start Fresh Button

### Task 3: Add resetOnboarding Server Action

**Files:**
- Modify: `src/app/auth/actions.ts`

**Step 1: Add the resetOnboarding function**

Add after `deleteAllMemories` (after line 547):

```ts
export async function resetOnboarding() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated.' }

    try {
        const rate = await rateLimit('reset-onboarding:' + user.id, 2, 60_000)
        if (!rate.success) return { ok: false, error: 'Too many attempts. Please wait.' }
    } catch {
        return { ok: false, error: 'Too many attempts. Please wait.' }
    }

    // Delete chat history
    const chatResult = await deleteAllMessages()
    if (!chatResult.ok) return { ok: false, error: chatResult.error || 'Failed to delete chat.' }

    // Delete memories
    const memoryResult = await deleteAllMemories()
    if (!memoryResult.ok) return { ok: false, error: memoryResult.error || 'Failed to delete memories.' }

    // Reset onboarding fields (does NOT touch subscription_tier, daily_msg_count, abuse_score)
    const { error } = await supabase
        .from('profiles')
        .update({
            onboarding_completed: false,
            preferred_squad: null,
            username: null,
            custom_character_names: null,
        })
        .eq('id', user.id)

    if (error) {
        console.error('Error resetting onboarding:', error)
        return { ok: false, error: 'Failed to reset profile.' }
    }

    // Delete gang members
    const { data: gang } = await supabase
        .from('gangs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

    if (gang?.id) {
        await supabase.from('gang_members').delete().eq('gang_id', gang.id)
    }

    return { ok: true as const }
}
```

**Step 2: Verify build compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```
feat: add resetOnboarding server action
```

---

### Task 4: Add Start Fresh Button + Modal to Settings Panel

**Files:**
- Modify: `src/components/settings/settings-panel.tsx`

**Step 1: Add import for resetOnboarding and RotateCcw icon**

At line 8, add `resetOnboarding` to the import:
```ts
import { deleteAccount, deleteAllMessages, deleteAllMemories, resetOnboarding, signOut } from '@/app/auth/actions'
```

At line 12, add `RotateCcw` to lucide imports:
```ts
import { Crown, Zap, Brain, Infinity, ArrowRight, Check, Trash2, AlertTriangle, BarChart3, RotateCcw } from 'lucide-react'
```

**Step 2: Add state variables**

Inside the SettingsPanel component, add after the existing state declarations (around line 167, near the other modal states):

```ts
const [freshModalOpen, setFreshModalOpen] = useState(false)
const [isResetting, setIsResetting] = useState(false)
const [freshMsg, setFreshMsg] = useState<string | null>(null)
```

**Step 3: Add handler function**

Add after `handleDeleteAllMemories` (after line ~215):

```ts
const handleStartFresh = async () => {
    setIsResetting(true)
    setFreshMsg(null)
    try {
        const result = await resetOnboarding()
        if (!result.ok) {
            setFreshMsg(result.error || 'Failed to reset.')
            return
        }
        const store = useChatStore.getState()
        store.clearChat()
        store.setActiveGang([])
        store.setUserName(null)
        store.setUserNickname(null)
        store.setCustomCharacterNames({})
        trackEvent('start_fresh', { metadata: { source: 'settings_page' } })
        // Redirect to onboarding
        window.location.href = '/onboarding'
    } catch {
        setFreshMsg('Something went wrong.')
    } finally {
        setIsResetting(false)
    }
}
```

**Step 4: Add the button in Data Management section**

After the "Delete All Memories" block (after line 362, before the closing `</div>` of Data Management), add a divider and the Start Fresh button:

```tsx
<div className="h-px bg-border/40" />

{/* Start Fresh */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div>
        <div className="text-sm font-semibold">Start Fresh</div>
        <div className="text-[11px] text-muted-foreground">
            Wipes chat, memories, and squad — then restarts onboarding. Your subscription stays.
        </div>
    </div>
    <Button
        variant="outline"
        className="rounded-full text-[10px] uppercase tracking-widest border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
        onClick={() => {
            setFreshMsg(null)
            setFreshModalOpen(true)
        }}
    >
        <RotateCcw className="w-3 h-3 mr-1" />
        Start Fresh
    </Button>
</div>
```

**Step 5: Add the confirmation modal**

After the existing "Delete All Memories" modal (after line ~520, after the closing `</Dialog>`), add:

```tsx
{/* Start Fresh Confirmation Modal */}
<Dialog open={freshModalOpen} onOpenChange={setFreshModalOpen}>
    <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-destructive/20 rounded-[1.5rem]">
        <DialogHeader className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-destructive/10">
                <RotateCcw className="w-6 h-6 text-destructive" />
            </div>
            <DialogTitle className="text-lg font-black text-center">
                Start completely fresh?
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground leading-relaxed">
                This will delete all your chat history, memories, and squad — then take you back to onboarding to set up a new gang. Your subscription and billing stay untouched.
            </DialogDescription>
        </DialogHeader>
        {freshMsg && (
            <p className={`text-sm text-center font-medium ${freshMsg.includes('successfully') ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
                {freshMsg}
            </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
                variant="destructive"
                className="w-full rounded-xl font-bold"
                disabled={isResetting}
                onClick={handleStartFresh}
            >
                {isResetting ? 'Resetting...' : 'Yes, start fresh'}
            </Button>
            <DialogClose asChild>
                <Button variant="outline" className="w-full rounded-xl">
                    Cancel
                </Button>
            </DialogClose>
        </DialogFooter>
    </DialogContent>
</Dialog>
```

**Step 6: Verify build compiles**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 7: Commit**

```
feat: add Start Fresh button in settings to reset onboarding
```

---

## Task 5: Final Build Verification

**Step 1:** Run `pnpm build` to verify no build errors across both tracks.

**Step 2:** Single combined commit if any fixes needed, otherwise done.

```
fix: full build verification for spam fix + start fresh
```
