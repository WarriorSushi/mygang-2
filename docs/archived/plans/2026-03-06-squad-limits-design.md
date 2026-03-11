# Tier-Based Squad Limits Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement squad member limits differentiated by subscription tier (Free=4, Basic=5, Pro=6), with upgrade/downgrade character management, intro/welcome-back messages, tier-based chat context depth, and pricing page updates.

**Architecture:** Add `squadLimit` and `contextLimit` to `TIER_LIMITS` in `billing.ts`. Create a new `squad_tier_members` DB table to track which characters were added at which tier (for downgrade/restore). Add character intro and welcome-back message templates. Create an upgrade character picker modal and a downgrade keeper modal. Modify the webhook to handle squad changes on tier transitions. Update the chat API to use tier-based history limits.

**Tech Stack:** Next.js 16, TypeScript, Supabase (PostgreSQL), Zustand, Framer Motion, Zod, Tailwind CSS v4

---

### Task 1: Add Squad & Context Limits to Billing Config

**Files:**
- Modify: `src/lib/billing.ts`

**Step 1: Add squadLimit and contextLimit to TIER_LIMITS**

```typescript
export const TIER_LIMITS = {
  free: { messagesPerWindow: 20, windowMs: 60 * 60 * 1000, monthlyLimit: null, memoryEnabled: false, squadLimit: 4, contextLimit: 10 },
  basic: { messagesPerWindow: null, windowMs: null, monthlyLimit: 500, memoryEnabled: true, squadLimit: 5, contextLimit: 20 },
  pro: { messagesPerWindow: null, windowMs: null, monthlyLimit: null, memoryEnabled: true, squadLimit: 6, contextLimit: 30 },
} as const
```

**Step 2: Add helper function**

```typescript
export function getSquadLimit(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].squadLimit
}

export function getContextLimit(tier: SubscriptionTier): number {
  return TIER_LIMITS[tier].contextLimit
}
```

**Step 3: Commit**

```bash
git add src/lib/billing.ts
git commit -m "feat: add squad and context limits to tier config"
```

---

### Task 2: Create Database Migration for Squad Tier Tracking

**Files:**
- Create: `supabase/migrations/20260306100000_add_squad_tier_members.sql`

**Step 1: Write migration**

```sql
-- Track which characters were added at which subscription tier
-- Used for downgrade (remove upgrade-added chars) and restore (re-subscribe)
create table if not exists squad_tier_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  character_id text not null,
  added_at_tier text not null check (added_at_tier in ('basic', 'pro')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (user_id, character_id)
);

-- RLS
alter table squad_tier_members enable row level security;

create policy "Users can read own squad_tier_members"
  on squad_tier_members for select
  using (auth.uid() = user_id);

create policy "Users can insert own squad_tier_members"
  on squad_tier_members for insert
  with check (auth.uid() = user_id);

create policy "Users can update own squad_tier_members"
  on squad_tier_members for update
  using (auth.uid() = user_id);

-- Index for fast lookups
create index idx_squad_tier_members_user on squad_tier_members(user_id);
```

**Step 2: Apply migration**

Run: `pnpm supabase db push` or apply via Supabase dashboard.

**Step 3: Commit**

```bash
git add supabase/migrations/20260306100000_add_squad_tier_members.sql
git commit -m "feat: add squad_tier_members table for tier-based squad tracking"
```

---

### Task 3: Add Character Intro & Welcome-Back Templates

**Files:**
- Create: `src/constants/character-messages.ts`

**Step 1: Write character intro and welcome-back templates**

Each character gets a unique intro message (in their voice) and a unique welcome-back message. These are displayed as chat messages when a character is added or restored.

```typescript
export const CHARACTER_INTRO_MESSAGES: Record<string, string> = {
  kael: "Yooo we just got BIGGER. I'm Kael — the energy, the look, the whole package. Let's make this group iconic.",
  nyx: "got added to another group chat. cool. i'm nyx. don't be weird.",
  atlas: "Atlas, reporting in. Good to be on the team. I've got your back — let's keep things moving.",
  luna: "Hi everyone... I'm Luna. I can already feel the energy in here and it's beautiful. So glad to be part of this.",
  rico: "YOOO WHAT'S GOOD!! I'm Rico and this group just got 10x more fun!! LET'S GOOO",
  vee: "Hi, I'm Vee. Fun fact: the average group chat sends 47 messages before anyone says anything useful. Let's beat that.",
  ezra: "Ezra, here. Think of me as the one who'll make you question everything you thought you knew. In a good way. Probably.",
  cleo: "Oh hello, darlings. Cleo has arrived. The group just got significantly more fabulous, you're welcome.",
  sage: "Hey, I'm Sage. Really happy to be here. I'm the one who actually listens, so feel free to share whatever's on your mind.",
  miko: "THE LEGENDARY MIKO HAS JOINED THE PARTY!! This is the beginning of our greatest arc yet!!",
  dash: "What's up, I'm Dash. Time is money and we're about to make both. Let's optimize this group's potential.",
  zara: "Hey. Zara. I'm the one who'll tell you the truth when nobody else will. You'll thank me later.",
  jinx: "okay so i just got added and i already have three theories about why. i'm jinx. buckle up.",
  nova: "heyyy... nova here. just vibing. glad to be part of whatever this is. no rush on anything.",
}

export const CHARACTER_WELCOME_BACK_MESSAGES: Record<string, string> = {
  kael: "THE COMEBACK KID IS HERE. Miss me? Of course you did. Kael's back and the group is whole again.",
  nyx: "oh look, i'm back. did anything interesting happen while i was gone? probably not.",
  atlas: "Atlas back on duty. Good to be back with the team. What'd I miss — give me the sitrep.",
  luna: "I'm back... and honestly it felt weird being away. Like a piece of the energy was missing. Anyway, hi again.",
  rico: "I'M BAAAAAACK BABY!! DID YOU MISS THE CHAOS?? BECAUSE THE CHAOS MISSED YOU!!",
  vee: "I've returned. Statistically, groups perform 23% better with me in them. That's not real but it feels true.",
  ezra: "The prodigal artist returns. Absence makes the heart grow fonder — or was it the art? Either way, I'm back.",
  cleo: "Miss me? Don't answer that, I already know. Cleo is BACK and better than ever, darlings.",
  sage: "Hey, I'm back. Whatever happened while I was gone — it's okay. We can talk about it whenever you're ready.",
  miko: "THE HERO RETURNS FROM EXILE!! My character arc demanded a brief absence but NOW WE RISE AGAIN!!",
  dash: "Back in the game. Every setback is a setup for a comeback. Let's get this bread.",
  zara: "I'm back. Missed you too, even if I won't say it twice. Now catch me up.",
  jinx: "okay so... i was gone. and things happened. and i have QUESTIONS. but first — i'm back.",
  nova: "oh hey... i'm back. time is a flat circle anyway so did i even leave? deep thoughts. anyway hi.",
}
```

**Step 2: Commit**

```bash
git add src/constants/character-messages.ts
git commit -m "feat: add character intro and welcome-back message templates"
```

---

### Task 4: Update Squad Validation (Server-Side)

**Files:**
- Modify: `src/app/auth/actions.ts`
- Modify: `src/app/api/chat/route.ts`

**Step 1: Update `saveGang` to accept tier-based limits**

In `src/app/auth/actions.ts`, update the `characterIdsSchema` max and add tier-aware validation in `saveGang`:

```typescript
// Change max from 8 to 6 (the absolute max across all tiers)
const characterIdsSchema = z.array(z.string()).min(1).max(6).refine(
    ids => ids.every(id => validCharacterIds.includes(id)),
    'Invalid character ID'
)
```

In `saveGang`, add tier validation:

```typescript
export async function saveGang(characterIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const parsed = characterIdsSchema.safeParse(characterIds)
    if (!parsed.success) return

    // Fetch user's tier and enforce squad limit
    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()

    const tier = getTierFromProfile(profile?.subscription_tier ?? null)
    const limit = getSquadLimit(tier)

    if (parsed.data.length > limit) return

    // ... rest of existing logic
}
```

**Step 2: Update chat route schema**

In `src/app/api/chat/route.ts` line 426-427, change `.max(4)` to `.max(6)`:

```typescript
activeGangIds: z.array(z.string().min(1).max(32)).max(6).optional(),
activeGang: z.array(z.object({ id: z.string().min(1).max(32) })).max(6).optional(),
```

**Step 3: Commit**

```bash
git add src/app/auth/actions.ts src/app/api/chat/route.ts
git commit -m "feat: enforce tier-based squad limits in server validation"
```

---

### Task 5: Update Chat API to Use Tier-Based Context Limits

**Files:**
- Modify: `src/app/api/chat/route.ts`

**Step 1: Replace hardcoded LLM_HISTORY_LIMIT with tier-based value**

At the top of the file, remove the fixed `LLM_HISTORY_LIMIT = 12` constant. In the POST handler where `HISTORY_LIMIT` is computed (~line 945-947), replace it:

```typescript
// Import getContextLimit from billing
import { getTierFromProfile, isMemoryEnabled, getContextLimit } from '@/lib/billing'

// Remove these constants (or keep only for low-cost/idle fallbacks):
// const LLM_HISTORY_LIMIT = 12
// const LLM_IDLE_HISTORY_LIMIT = 8

// In the POST handler, after tier is determined, replace the HISTORY_LIMIT logic:
const tierContextLimit = getContextLimit(tier)
const HISTORY_LIMIT = lowCostMode
    ? (autonomousIdle ? LOW_COST_IDLE_HISTORY_LIMIT : LOW_COST_HISTORY_LIMIT)
    : (autonomousIdle ? Math.min(tierContextLimit, 8) : tierContextLimit)
```

**Step 2: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: use tier-based context limits for LLM history"
```

---

### Task 6: Update Selection Step UI for Tier-Based Limits

**Files:**
- Modify: `src/components/onboarding/selection-step.tsx`

**Step 1: Accept `maxMembers` prop and use it instead of hardcoded 4**

```typescript
interface SelectionStepProps {
    selectedIds: string[]
    toggleCharacter: (id: string) => void
    onNext: () => void
    maxMembers?: number  // defaults to 4
}

export function SelectionStep({ selectedIds, toggleCharacter, onNext, maxMembers = 4 }: SelectionStepProps) {
```

**Step 2: Replace all hardcoded `4` with `maxMembers`**

- Line 42: `Choose 2–${maxMembers} friends for your gang.`
- Line 52: `const isMaxed = selectedIds.length >= maxMembers && !isSelected`
- Line 228-229: Update "Pick 2–4" to `Pick 2–${maxMembers}`

**Step 3: Commit**

```bash
git add src/components/onboarding/selection-step.tsx
git commit -m "feat: make selection step squad limit configurable via prop"
```

---

### Task 7: Create Upgrade Character Picker Modal

**Files:**
- Create: `src/components/squad/upgrade-picker-modal.tsx`

**Step 1: Build the modal component**

This modal shows when a user upgrades and has new squad slots to fill. It displays only characters NOT currently in their squad. User can pick characters up to their new limit.

Key props:
- `currentSquad: string[]` — current character IDs
- `newSlots: number` — how many new characters they can add (1 for Basic, 2 for Pro from Free)
- `onConfirm: (newCharacterIds: string[]) => void`
- `onDismiss: () => void`

Uses the same card design as SelectionStep but filtered to exclude current squad. Character cards show avatar, name, archetype, sample quote.

On confirm:
1. Save new squad (existing + new picks) via `saveGang`
2. Record new characters in `squad_tier_members` with `added_at_tier`
3. Inject intro messages into chat via `addMessage`

**Step 2: Commit**

```bash
git add src/components/squad/upgrade-picker-modal.tsx
git commit -m "feat: add upgrade character picker modal"
```

---

### Task 8: Create Downgrade Keeper Modal

**Files:**
- Create: `src/components/squad/downgrade-keeper-modal.tsx`

**Step 1: Build the modal component**

Shows when user's squad exceeds their new tier's limit. Displays current squad and lets user pick which ones to keep (up to new limit).

Key props:
- `currentSquad: Character[]` — full current squad
- `maxKeep: number` — how many they can keep
- `onConfirm: (keepIds: string[]) => void`
- `onTimeout: () => void` — called if user dismisses, triggers auto-removal

If user dismisses without choosing, auto-remove the characters that were added during upgrades (query `squad_tier_members` for `added_at_tier` entries, remove most recent first).

On confirm:
1. Save reduced squad via `saveGang`
2. Deactivate removed characters in `squad_tier_members` (set `is_active = false`, `deactivated_at = now()`)
3. Update `activeGang` in store

**Step 2: Commit**

```bash
git add src/components/squad/downgrade-keeper-modal.tsx
git commit -m "feat: add downgrade keeper modal"
```

---

### Task 9: Add Server Actions for Squad Tier Operations

**Files:**
- Modify: `src/app/auth/actions.ts`

**Step 1: Add `addSquadTierMembers` action**

```typescript
export async function addSquadTierMembers(characterIds: string[], tier: 'basic' | 'pro') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const id of characterIds) {
        await supabase.from('squad_tier_members').upsert({
            user_id: user.id,
            character_id: id,
            added_at_tier: tier,
            is_active: true,
            deactivated_at: null,
        }, { onConflict: 'user_id,character_id' })
    }
}
```

**Step 2: Add `deactivateSquadTierMembers` action**

```typescript
export async function deactivateSquadTierMembers(characterIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
        .from('squad_tier_members')
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('character_id', characterIds)
}
```

**Step 3: Add `getRestorable` action**

```typescript
export async function getRestorableMembers() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('squad_tier_members')
        .select('character_id, added_at_tier, deactivated_at')
        .eq('user_id', user.id)
        .eq('is_active', false)
        .order('deactivated_at', { ascending: false })

    return data ?? []
}
```

**Step 4: Add `restoreSquadTierMembers` action**

```typescript
export async function restoreSquadTierMembers(characterIds: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
        .from('squad_tier_members')
        .update({ is_active: true, deactivated_at: null })
        .eq('user_id', user.id)
        .in('character_id', characterIds)
}
```

**Step 5: Commit**

```bash
git add src/app/auth/actions.ts
git commit -m "feat: add server actions for squad tier member tracking"
```

---

### Task 10: Wire Up Auth Manager for Tier Transitions

**Files:**
- Modify: `src/components/orchestrator/auth-manager.tsx`

**Step 1: Detect tier changes and trigger modals**

In the `syncSession` function, after setting subscription tier, compare with previous tier. Add state for pending upgrade/downgrade:

Add to chat store:
```typescript
// In chat-store.ts
pendingUpgrade: { previousTier: SubscriptionTier; newTier: SubscriptionTier; newSlots: number } | null
pendingDowngrade: { newLimit: number } | null
setPendingUpgrade: (upgrade: ...) => void
setPendingDowngrade: (downgrade: ...) => void
```

In auth-manager, after setting tier:
```typescript
const previousTier = useChatStore.getState().subscriptionTier
const newTier = profile.subscription_tier as SubscriptionTier

if (newTier !== previousTier) {
    const oldLimit = getSquadLimit(previousTier)
    const newLimit = getSquadLimit(newTier as SubscriptionTier)
    const currentSquadSize = localGang.length || remoteSquad.length

    if (newLimit > oldLimit) {
        // UPGRADE — show picker for new slots
        setPendingUpgrade({
            previousTier,
            newTier: newTier as SubscriptionTier,
            newSlots: newLimit - currentSquadSize
        })
        // Also check for restorable members first
    } else if (newLimit < oldLimit && currentSquadSize > newLimit) {
        // DOWNGRADE — show keeper modal
        setPendingDowngrade({ newLimit })
    }
}
```

**Step 2: Render modals in a parent component**

In the chat layout or orchestrator, conditionally render `UpgradePickerModal` or `DowngradeKeeperModal` based on store state.

**Step 3: Commit**

```bash
git add src/components/orchestrator/auth-manager.tsx src/stores/chat-store.ts
git commit -m "feat: detect tier transitions and trigger squad modals"
```

---

### Task 11: Handle Subscription Restoration in Webhook

**Files:**
- Modify: `src/app/api/webhook/dodo-payments/route.ts`

**Step 1: On `onSubscriptionActive`, check for restorable members**

After updating the tier, query `squad_tier_members` for deactivated members that match the new tier, and re-activate them. Also add them back to `gang_members`:

```typescript
onSubscriptionActive: async (payload) => {
    // ... existing logic ...
    const plan = planFromProductId(productId)
    await upsertSubscription(subscriptionId, userId, productId, plan, 'active')
    await updateProfileTier(userId, plan)

    // Restore previously removed squad members
    const newLimit = plan === 'pro' ? 6 : plan === 'basic' ? 5 : 4
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
            // Re-activate in squad_tier_members
            await supabase
                .from('squad_tier_members')
                .update({ is_active: true, deactivated_at: null })
                .eq('user_id', userId)
                .in('character_id', restoreIds)

            // Add back to gang_members
            const { data: gang } = await supabase
                .from('gangs')
                .select('id')
                .eq('user_id', userId)
                .single()
            if (gang) {
                await supabase.from('gang_members').insert(
                    restoreIds.map(id => ({ gang_id: gang.id, character_id: id }))
                )
            }

            // Update preferred_squad
            const allIds = [...(currentGang?.map(g => g.character_id) ?? []), ...restoreIds]
            await supabase.from('profiles').update({ preferred_squad: allIds }).eq('id', userId)

            // Flag for welcome-back messages
            await supabase.from('profiles').update({
                restored_members_pending: restoreIds,
                purchase_celebration_pending: true,
            }).eq('id', userId)
        }
    }
    // ... rest of existing logic ...
}
```

**Step 2: On `onSubscriptionCancelled`/`onSubscriptionExpired`, handle squad trim**

After setting tier to 'free', deactivate upgrade-added members and trim `gang_members` if needed. Set a `pending_squad_downgrade` flag on the profile so the client shows the keeper modal on next load.

```typescript
// After updateProfileTier(userId, 'free'):
await supabase.from('profiles').update({ pending_squad_downgrade: true }).eq('id', userId)
```

**Step 3: Commit**

```bash
git add src/app/api/webhook/dodo-payments/route.ts
git commit -m "feat: handle squad restoration and downgrade in webhooks"
```

---

### Task 12: Update Pricing Page

**Files:**
- Modify: `src/app/pricing/page.tsx`

**Step 1: Update features comparison table**

```typescript
const features: Feature[] = [
  { text: 'Gang members in chat', free: 'Up to 4', basic: 'Up to 5', pro: 'Up to 6' },
  { text: 'Messages per month', free: '~20/hr', basic: '500/mo', pro: 'Unlimited' },
  { text: 'Chat memory', free: 'Standard memory', basic: 'Improved longer memory', pro: 'Solid large memory' },
  { text: 'Hourly cooldowns', free: '60 min when capped', basic: 'None', pro: 'None' },
  { text: 'Priority response speed', free: false, basic: false, pro: true },
  { text: 'Ecosystem chat mode', free: false, basic: true, pro: true },
  { text: 'Chat wallpapers', free: false, basic: true, pro: true },
  { text: 'Custom character nicknames', free: false, basic: true, pro: true },
  { text: 'Memory vault access', free: false, basic: true, pro: true },
  { text: 'Dark & light themes', free: true, basic: true, pro: true },
  { text: 'Pro badge in chat', free: false, basic: false, pro: true },
]
```

**Step 2: Update plan cards with squad info**

In the Free card features list, change `'Pick up to 4 gang members'` to stay as-is.

In the Basic card features list, add:
```typescript
{ text: 'Up to 5 gang members', icon: Users, highlight: true },
{ text: 'Improved longer memory', icon: Brain, highlight: true },
```

In the Pro card features list, add:
```typescript
{ text: 'Up to 6 gang members', icon: Users, highlight: true },
{ text: 'Solid large memory', icon: Brain, highlight: true },
```

Reorder so the most enticing features are at the top of each list.

**Step 3: Update FAQ about downgrading**

Update the "What happens to my messages if I downgrade?" FAQ:
```typescript
{
    q: 'What happens to my gang if I downgrade?',
    a: "Your chat history stays exactly where it is. If your squad is larger than your new plan allows, you'll get to choose which members to keep. If you re-subscribe later, your removed members come right back.",
}
```

**Step 4: Commit**

```bash
git add src/app/pricing/page.tsx
git commit -m "feat: update pricing page with tier-based squad limits and memory descriptions"
```

---

### Task 13: Update User Settings Schema & Auth Manager Validation

**Files:**
- Modify: `src/app/auth/actions.ts`
- Modify: `src/components/orchestrator/auth-manager.tsx`

**Step 1: Update `userSettingsSchema` preferred_squad max**

```typescript
preferred_squad: z.array(z.string()).max(6).optional(),
```

**Step 2: Update auth-manager squad size validation**

In auth-manager.tsx, replace hardcoded `4` in squad validation:

```typescript
// Import getSquadLimit
import { getSquadLimit } from '@/lib/billing'

// Replace: savedIds.length >= 2 && savedIds.length <= 4
// With dynamic check based on tier
const tier = profile?.subscription_tier || 'free'
const maxSquad = getSquadLimit(tier as any)
const remoteIds = savedIds.length >= 2 && savedIds.length <= maxSquad ? savedIds : null
const hasLocalGang = localIds.length >= 2 && localIds.length <= maxSquad
```

**Step 3: Commit**

```bash
git add src/app/auth/actions.ts src/components/orchestrator/auth-manager.tsx
git commit -m "feat: update squad validation to use tier-based limits"
```

---

### Task 14: Add Database Migration for Profile Flags

**Files:**
- Create: `supabase/migrations/20260306100001_add_squad_downgrade_flags.sql`

**Step 1: Add columns for upgrade/downgrade state**

```sql
alter table profiles add column if not exists pending_squad_downgrade boolean default false;
alter table profiles add column if not exists restored_members_pending text[] default '{}';
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260306100001_add_squad_downgrade_flags.sql
git commit -m "feat: add profile columns for squad tier transition flags"
```

---

### Task 15: Integration — Inject Intro & Welcome-Back Messages

**Files:**
- Modify: `src/components/squad/upgrade-picker-modal.tsx`
- Modify: `src/components/orchestrator/auth-manager.tsx`

**Step 1: On upgrade confirm, inject intro messages**

After saving new squad members via the picker modal, for each new character, call `addMessage` with their intro template:

```typescript
import { CHARACTER_INTRO_MESSAGES } from '@/constants/character-messages'

// After saveGang succeeds:
for (const charId of newCharacterIds) {
    const character = CHARACTERS.find(c => c.id === charId)
    const introMsg = CHARACTER_INTRO_MESSAGES[charId]
    if (character && introMsg) {
        addMessage({
            id: `intro-${charId}-${Date.now()}`,
            speaker: charId,
            content: introMsg,
            created_at: new Date().toISOString(),
        })
    }
}
```

**Step 2: On restore (auth-manager detects restored members), inject welcome-back messages**

When auth-manager syncs and detects `restored_members_pending` on the profile, inject welcome-back messages and clear the flag:

```typescript
import { CHARACTER_WELCOME_BACK_MESSAGES } from '@/constants/character-messages'

if (profile?.restored_members_pending?.length) {
    for (const charId of profile.restored_members_pending) {
        const msg = CHARACTER_WELCOME_BACK_MESSAGES[charId]
        if (msg) {
            addMessage({
                id: `wb-${charId}-${Date.now()}`,
                speaker: charId,
                content: msg,
                created_at: new Date().toISOString(),
            })
        }
    }
    // Clear the flag
    await supabase.from('profiles').update({ restored_members_pending: [] }).eq('id', user.id)
}
```

**Step 3: Commit**

```bash
git add src/components/squad/upgrade-picker-modal.tsx src/components/orchestrator/auth-manager.tsx
git commit -m "feat: inject intro and welcome-back messages on squad changes"
```

---

### Task 16: Final Testing & Edge Case Verification

**Step 1: Test upgrade flow**
- Create free user with 4 members
- Simulate Basic upgrade → verify picker shows, 1 new slot, intro message appears
- Simulate Pro upgrade from Basic → verify picker shows, 1 new slot

**Step 2: Test downgrade flow**
- Pro user with 6 members → cancel subscription → verify keeper modal shows
- Select 4 to keep → verify 2 removed, stored in squad_tier_members as inactive
- Dismiss modal → verify auto-removal of upgrade-added characters

**Step 3: Test restoration flow**
- Previously cancelled user re-subscribes → verify characters restored, welcome-back messages appear

**Step 4: Test pricing page**
- Verify all three tiers show correct squad limits
- Verify feature comparison table is updated
- Verify benefit ordering (most enticing first)

**Step 5: Commit**

```bash
git commit -m "feat: tier-based squad limits complete"
```
