# V2 Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix all remaining v2 audit findings across security, frontend, features, and code quality.

**Architecture:** 4 parallel workstreams — DB migrations (Supabase MCP), security config + chat fixes (code), frontend touch targets + a11y (code), code quality cleanup (code).

**Tech Stack:** Next.js 16, Supabase, TypeScript, Tailwind CSS, Radix UI, Zustand

---

### Task 1: Security DB Migrations (Supabase MCP)

**Supabase project ID:** `xiekctfhbqkhoqplobep`

- [x] **Step 1: Fix profiles UPDATE column grants (SEC-V2-H1)** ✅ 2026-03-18

```sql
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (username, user_profile, relationship_state, session_summary, summary_turns,
  custom_character_names, preferred_squad, vibe_profile, theme, chat_mode, chat_wallpaper,
  low_cost_mode, onboarding_completed, avatar_style_preference, last_active_at) ON profiles TO authenticated;
```

- [x] **Step 2: Fix subscriptions status CHECK constraint (SEC-V2-H2)**

```sql
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY['pending', 'active', 'on_hold', 'cancelled', 'cancelled_pending', 'expired', 'refunded', 'disputed']));
```

- [x] **Step 3: Revoke TRUNCATE from authenticated on 10 tables (SEC-V2-M1)**

```sql
REVOKE TRUNCATE ON admin_audit_log, admin_runtime_settings, analytics_events, characters,
  chat_history, gang_members, gangs, memories, push_subscriptions, squad_tier_members
  FROM authenticated;
```

- [x] **Step 4: Revoke all grants on admin tables from authenticated (SEC-V2-M2)**

```sql
REVOKE ALL ON admin_audit_log, admin_runtime_settings FROM authenticated;
```

- [x] **Step 5: Lock down characters table (SEC-V2-M3)**

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON characters FROM authenticated;
```

- [x] **Step 6: Add WITH CHECK to gang_members ALL policy (SEC-V2-M4)**

```sql
DROP POLICY IF EXISTS "Users can manage their gang members" ON gang_members;
CREATE POLICY "Users can manage their gang members" ON gang_members
  FOR ALL USING (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = auth.uid()));
```

- [x] **Step 7: Add WITH CHECK to gangs ALL policy (SEC-V2-M5)**

```sql
DROP POLICY IF EXISTS "Users can manage their own gang" ON gangs;
CREATE POLICY "Users can manage their own gang" ON gangs
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

- [x] **Step 8: Add WITH CHECK to memories ALL policy (SEC-V2-M6)**

```sql
DROP POLICY IF EXISTS "Users can manage their memories" ON memories;
CREATE POLICY "Users can manage their memories" ON memories
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

- [x] **Step 9: Revoke DELETE on profiles, use timingSafeEqual for CRON (SEC-V2-L2/L3)**

```sql
REVOKE DELETE ON profiles FROM authenticated;
```

---

### Task 2: Security Config Fixes (Code)

**Files:**
- Modify: `next.config.ts:21-26` (CSP comment fix)
- Modify: `src/app/api/internal/wywa/route.ts:26` (timing-safe CRON comparison)

- [x] **Step 1: Fix misleading CSP comment about unsafe-eval**
Update the comment in `next.config.ts` to accurately state that `unsafe-eval` IS still present and required by lottie-web. Remove the "has been removed" claim.

- [x] **Step 2: Use timingSafeEqual for CRON secret**
In `src/app/api/internal/wywa/route.ts`, replace `!==` comparison with `crypto.timingSafeEqual`.

- [x] **Step 3: Commit**

---

### Task 3: Frontend Touch Targets + A11y

**Files:**
- Modify: `src/components/chat/message-item.tsx:367-408` (action button sizes)
- Modify: `src/components/chat/chat-header.tsx:342-370` (mobile avatar sizes)
- Modify: `src/components/chat/avatar-lightbox.tsx:85` (close button size)
- Modify: `src/components/ui/pwa-install-prompt.tsx:47-63` (button sizes + aria-live)
- Modify: `src/components/ui/cookie-consent.tsx:52-57` (button size)
- Modify: `src/app/error.tsx:23` (button radius)
- Modify: `src/app/not-found.tsx:18` (button radius)

- [x] **Step 1: Fix message action button touch targets to 44px**
In `message-item.tsx`, change action buttons (like/reply/flag) from `p-2 -m-1.5` to `min-w-[44px] min-h-[44px] p-2.5 -m-2`.

- [x] **Step 2: Fix mobile avatar touch targets**
In `chat-header.tsx`, add `min-w-[44px] min-h-[44px]` to mobile avatar buttons.

- [x] **Step 3: Fix lightbox close button**
In `avatar-lightbox.tsx`, add `min-h-[44px]` to close button.

- [x] **Step 4: Fix PWA prompt buttons + add aria-live**
In `pwa-install-prompt.tsx`: add `min-h-[44px]` to install button, `min-w-[44px] min-h-[44px]` to dismiss button, add `role="status"` and `aria-live="polite"` to wrapper.

- [x] **Step 5: Fix cookie consent button**
In `cookie-consent.tsx`, add `min-h-[44px]` to "Got it" button.

- [x] **Step 6: Fix error/404 button radius**
In `error.tsx` and `not-found.tsx`, change `rounded-lg` to `rounded-full`.

- [x] **Step 7: Commit**

---

### Task 4: Features — Checkout Analytics + Vault Gate

**Files:**
- Modify: `src/app/checkout/success/page.tsx` (add checkout_completed event)
- Modify: `src/app/chat/page.tsx` (add tier check before opening vault)

- [x] **Step 1: Fire checkout_completed on success page**
In checkout success page, add `trackEvent('checkout_completed')` on mount via useEffect. Import from `@/lib/analytics`.

- [x] **Step 2: Gate memory vault behind tier check**
In `src/app/chat/page.tsx`, wrap the `onOpenVault` handler with a tier check. If `subscriptionTier === 'free'`, show paywall instead of opening vault.

- [x] **Step 3: Commit**

---

### Task 5: Code Quality Cleanup

**Files:**
- Modify: `src/lib/billing.ts:85,89` (delete dead functions)
- Modify: `src/hooks/use-chat-history.ts:9,101` (remove re-export + export)
- Modify: `src/hooks/use-chat-api.ts:12,16` (remove exports)
- Modify: `src/hooks/use-tab-presence.ts:10,29` (remove exports)
- Modify: 7 files with inline `SubscriptionTier` type (import from billing.ts)
- Create: `src/app/post-auth/error.tsx`, `src/app/admin/error.tsx`, `src/app/refund/error.tsx`, `src/app/status/error.tsx`
- Delete: `src/app/dev/chat-header-preview/`, `src/app/dev/squad-reconcile-preview/`

- [x] **Step 1: Delete dead functions in billing.ts**
Remove `getTierUsageHeading` and `getTierMessagesLabel`.

- [x] **Step 2: Remove unnecessary exports from hooks**
Remove `export` from: `collapseLikelyDuplicateMessages` (use-chat-history), `isLiveChatMessage`/`getPayloadWindowLimit` (use-chat-api), `countUnseenMessages`/`buildPresenceTitle` (use-tab-presence). Remove `normalizeSource` re-export from use-chat-history.

- [x] **Step 3: Import SubscriptionTier type instead of inlining**
Export `SubscriptionTier` from `src/lib/billing.ts`. Update 7 files to import it instead of using inline `'free' | 'basic' | 'pro'`.

- [x] **Step 4: Add missing error.tsx files**
Create error boundaries for `/post-auth`, `/admin`, `/refund`, `/status`. Use the same pattern as existing error.tsx files.

- [x] **Step 5: Delete empty dev preview directories**
Remove `src/app/dev/chat-header-preview/` and `src/app/dev/squad-reconcile-preview/`.

- [x] **Step 6: Commit**

---

## Execution Order

Tasks 1-5 can run in parallel (no file conflicts between tasks).

After all tasks complete:
1. Build check: `pnpm build` ✅ PASSED 2026-03-18
2. If passing, commit audit docs update and push ✅ DONE 2026-03-18

## Status: ALL TASKS COMPLETE ✅
