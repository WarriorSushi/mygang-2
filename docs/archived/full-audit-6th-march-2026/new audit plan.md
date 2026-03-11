 MyGang Full-Stack Audit Report

  Project: MyGang — AI group chat with character friends
  Stack: Next.js 16 + Supabase + Zustand + DodoPayments + OpenRouter
  Date: 2026-03-06

  ---
  CRITICAL (13 findings)

  Security & Auth

  #: C1
  Finding: Auth bypass in /activate — Ownership check skipped when subCustomerId is falsy; users with no
  dodo_customer_id
    also bypass it. Any authenticated user can activate any subscription.
  File: api/checkout/activate/route.ts:27-39
  Fix: Reject if !subCustomerId; flip check to deny-by-default
  ────────────────────────────────────────
  #: C2
  Finding: Activate doesn't check subscription status — Cancelled/expired subscriptions still grant tier upgrades
  File: api/checkout/activate/route.ts:22-49
  Fix: Validate subscription.status is active or trialing before proceeding
  ────────────────────────────────────────
  #: C3
  Finding: increment_profile_counters is SECURITY DEFINER with no caller check — Any authenticated user can call this
  RPC
     with another user's ID, incrementing their abuse score or corrupting counters
  File: migrations/20260305000001
  Fix: Add IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION
  ────────────────────────────────────────
  #: C4
  Finding: chat_history SELECT policy leaks all guest rows — USING (user_id = auth.uid() OR is_guest = TRUE) lets anyone

    read any guest's chat history
  File: migrations/20260203190126:91
  Fix: Drop and recreate: USING (user_id = auth.uid())
  ────────────────────────────────────────
  #: C5
  Finding: SHA-256 admin password with no salt — Trivially brute-forceable if hash leaks
  File: lib/admin/auth.ts:44
  Fix: Use bcrypt/argon2 or PBKDF2 with high iterations
  ────────────────────────────────────────
  #: C6
  Finding: No Next.js middleware — Chat page has no server-side auth guard; full JS bundle served to unauthenticated
    users before client-side redirect
  File: Missing src/middleware.ts
  Fix: Create middleware with @supabase/ssr session check

  Billing & Data Integrity

  #: C7
  Finding: Conflicting CHECK constraints block basic tier — Initial migration constrains to ('free','pro'), later
    migration adds ('free','basic','pro'). Both active = basic writes fail
  File: migrations/20260203...:9 vs 20260306...:3-4
  Fix: Drop the original inline constraint
  ────────────────────────────────────────
  #: C8
  Finding: Webhook errors silently swallowed — upsertSubscription and updateProfileTier don't check Supabase errors.
    Returns 200 to payment processor even if DB write fails → payment taken, tier never updated
  File: api/webhook/dodo-payments/route.ts:19-33
  Fix: Check { error } and throw to return non-2xx
  ────────────────────────────────────────
  #: C9
  Finding: Plan defaults to basic for unknown products — Both activate and webhook silently upgrade users if product ID
    is unrecognized or env vars misconfigured
  File: activate/route.ts:43, webhook/route.ts:44-48
  Fix: Validate against both known product IDs; reject unknowns
  ────────────────────────────────────────
  #: C10
  Finding: No webhook idempotency — No UNIQUE constraint on billing_events.dodo_event_id. Duplicate webhook deliveries
    double-process everything
  File: webhook/route.ts:35-42
  Fix: Add UNIQUE(dodo_event_id) constraint; check before processing

  Performance

  ┌─────┬────────────────────────────────────────────────┬─────────────────────────────┬────────────────────────────┐
  │  #  │                    Finding                     │            File             │            Fix             │
  ├─────┼────────────────────────────────────────────────┼─────────────────────────────┼────────────────────────────┤
  │     │ N+1 waterfall in persistAsync — Gang lookup +  │                             │ Cache gang_id; merge dedup │
  │ C11 │ double chat_history query on every single chat │ api/chat/route.ts:1291-1450 │  query into history select │
  │     │  request                                       │                             │                            │
  ├─────┼────────────────────────────────────────────────┼─────────────────────────────┼────────────────────────────┤
  │     │ Missing index on memories.kind — Every memory  │                             │ CREATE INDEX ON memories   │
  │ C12 │ read/count does a full table scan              │ No migration adds it        │ (user_id, kind, created_at │
  │     │                                                │                             │  DESC)                     │
  ├─────┼────────────────────────────────────────────────┼─────────────────────────────┼────────────────────────────┤
  │     │ In-memory rate limiting useless on serverless  │                             │ Require UPSTASH_REDIS_*    │
  │ C13 │ — Each Vercel container has its own counter;   │ lib/rate-limit.ts:10-34     │ env vars in production     │
  │     │ free-tier message limits are unenforceable     │                             │                            │
  └─────┴────────────────────────────────────────────────┴─────────────────────────────┴────────────────────────────┘

  ---
  IMPORTANT (26 findings)

  Backend & Database

  ┌─────┬────────────────────────────────────────┬─────────────────────────────┬────────────────────────────────────┐
  │  #  │                Finding                 │            File             │                Fix                 │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │     │ Memory compaction crash leaves rows    │                             │ Add cron job or safety query that  │
  │ I1  │ stuck in 'compacting' state            │ lib/ai/memory.ts:158-261    │ resets stuck rows after 5 min      │
  │     │ permanently — user loses memories      │                             │                                    │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │     │ saveGang deletes then inserts gang     │                             │ Use Supabase RPC transaction or    │
  │ I2  │ members non-atomically — concurrent    │ auth/actions.ts:167-176     │ upsert strategy                    │
  │     │ chat can see empty gang                │                             │                                    │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │ I3  │ Race condition creating duplicate Dodo │ api/checkout/route.ts:42-52 │ Use .is('dodo_customer_id', null)  │
  │     │  customers on double-click checkout    │                             │ conditional update                 │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │ I4  │ user.email! non-null assertion — OAuth │ api/checkout/route.ts:44    │ Check for email; return 400 if     │
  │     │  users may not have email              │                             │ missing                            │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │ I5  │ Webhook squad restore can hit          │ webhook/route.ts:70-115     │ Use upsert with ON CONFLICT DO     │
  │     │ duplicate key error                    │                             │ NOTHING                            │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │ I6  │ characters table has no RLS enabled in │ migrations/20260203190126   │ Enable RLS + add SELECT-only       │
  │     │  any migration                         │                             │ policy                             │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │ I7  │ deleteAccount silently succeeds on     │ auth/actions.ts:119-133     │ Return error object, handle in UI  │
  │     │ auth error, no feedback to user        │                             │                                    │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │ I8  │ 9 RLS policies re-evaluate auth.uid()  │ Multiple tables             │ Wrap in (select auth.uid())        │
  │     │ per-row instead of per-query           │                             │                                    │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │     │ Overlapping permissive policies on     │                             │                                    │
  │ I9  │ billing_events + subscriptions         │ Migrations                  │ Scope to TO service_role           │
  │     │ (service_role targets public)          │                             │                                    │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │ I10 │ Leaked password protection disabled in │ Dashboard setting           │ Enable in Auth > Password          │
  │     │  Supabase Auth                         │                             │ Protection                         │
  ├─────┼────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────┤
  │ I11 │ Admin session cookie SameSite: lax     │ lib/admin/session.ts:63     │ Change to strict                   │
  │     │ instead of strict                      │                             │                                    │
  └─────┴────────────────────────────────────────┴─────────────────────────────┴────────────────────────────────────┘

  Architecture & Performance

  ┌─────┬────────────────────────────────────┬───────────────────────────────────┬─────────────────────────────────┐
  │  #  │              Finding               │               File                │               Fix               │
  ├─────┼────────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────┤
  │     │ useCapacityManager subscribes to   │                                   │ Use useChatStore((s) =>         │
  │ I12 │ entire store — re-renders on every │ use-capacity-manager.ts:16        │ s.lowCostMode)                  │
  │     │  message                           │                                   │                                 │
  ├─────┼────────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────┤
  │     │ useChatHistory subscribes to       │                                   │                                 │
  │ I13 │ entire store + fragile             │ use-chat-history.ts:208,246       │ Use useShallow selector         │
  │     │ messages.length dep                │                                   │                                 │
  ├─────┼────────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────┤
  │ I14 │ Recursive sendToApi uses stale     │ use-chat-api.ts:415,430           │ Call sendToApiRef.current(...)  │
  │     │ closure instead of ref             │                                   │                                 │
  ├─────┼────────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────┤
  │     │ fetchJourneyState makes 3          │                                   │ Parallelize profile + gang with │
  │ I15 │ sequential DB calls on every auth  │ client-journey.ts:23-56           │  Promise.all                    │
  │     │ load                               │                                   │                                 │
  ├─────┼────────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────┤
  │     │ History polling interval restarts  │                                   │ Use stable ref; split event     │
  │ I16 │ on every dep change; irregular     │ use-chat-history.ts:332-355       │ listeners from interval         │
  │     │ cadence                            │                                   │                                 │
  ├─────┼────────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────┤
  │ I17 │ hasOpenFloorIntent duplicated in   │ use-autonomous-flow.ts:13 +       │ Extract to shared               │
  │     │ client hook and server route       │ chat/route.ts:308                 │ lib/intent-detection.ts         │
  ├─────┼────────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────┤
  │ I18 │ useTypingSimulation timer cleanup  │ use-typing-simulation.ts:79-91    │ Add mounted guard like peer     │
  │     │ incomplete; no mounted guard       │                                   │ hooks                           │
  ├─────┼────────────────────────────────────┼───────────────────────────────────┼─────────────────────────────────┤
  │     │ Webhook creates bare Supabase      │                                   │                                 │
  │ I19 │ client at module scope, bypasses   │ webhook/route.ts:5-8              │ Import from lib/supabase/admin  │
  │     │ createAdminClient()                │                                   │                                 │
  └─────┴────────────────────────────────────┴───────────────────────────────────┴─────────────────────────────────┘

  UI/UX

  ┌─────┬────────────────────────────────────────────┬─────────────────────────────────┬────────────────────────────┐
  │  #  │                  Finding                   │              File               │            Fix             │
  ├─────┼────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┤
  │ I20 │ alert() used for checkout errors on        │ pricing/page.tsx:189,201        │ Use InlineToast or local   │
  │     │ pricing page                               │                                 │ error state                │
  ├─────┼────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┤
  │ I21 │ confirm() used for account deletion        │ settings-panel.tsx:297          │ Use in-page confirmation   │
  │     │                                            │                                 │ dialog                     │
  ├─────┼────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┤
  │ I22 │ Checkout success page has no fallback      │ checkout/success/page.tsx:38,43 │ Add "Go to chat" link      │
  │     │ button if auto-redirect fails              │                                 │                            │
  ├─────┼────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┤
  │ I23 │ No loading state during store hydration —  │ chat/page.tsx:188-199           │ Return loading skeleton    │
  │     │ flash of empty chat UI                     │                                 │ when !isHydrated           │
  ├─────┼────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┤
  │ I24 │ Admin tier toggle only free↔pro, ignores   │ admin/users/page.tsx:294        │ Use <select> with all      │
  │     │ basic tier entirely                        │                                 │ three tiers                │
  ├─────┼────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┤
  │ I25 │ Memory vault search only filters loaded    │ memory-vault.tsx:165-168        │ Add note or implement      │
  │     │ page (30 items), not full history          │                                 │ server-side search         │
  ├─────┼────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┤
  │ I26 │ Typing indicator uses <img> instead of     │ message-list.tsx:374-381        │ Replace with <Image>       │
  │     │ next/image                                 │                                 │ component                  │
  └─────┴────────────────────────────────────────────┴─────────────────────────────────┴────────────────────────────┘

  ---
  MINOR (18 findings)

  ┌─────┬───────────────────────────────────────────────────────────┬───────────────────────────────────────────────┐
  │  #  │                          Finding                          │                     File                      │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M1  │ burstCount from client is trusted in API request schema   │ chat/route.ts:432                             │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M2  │ characterIdsSchema allows 6 but basic tier limit is 5     │ auth/actions.ts:26 vs billing.ts:15           │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M3  │ Chat route hard-caps at 4 characters regardless of pro    │ chat/route.ts:557                             │
  │     │ tier's 6                                                  │                                               │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M4  │ storeMemory creates new Supabase client inside waitUntil  │ memory.ts:41                                  │
  │     │ background task                                           │                                               │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M5  │ _messageIdSet is module-level shared mutable state        │ chat-store.ts:72                              │
  │     │ outside Zustand store                                     │                                               │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M6  │ No remotePatterns in next.config for external images      │ next.config.ts:5-7                            │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M7  │ tsconfig.json targets ES2017 (ignored by Next.js/SWC      │ tsconfig.json:4                               │
  │     │ anyway)                                                   │                                               │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M8  │ No streaming in chat API — long LLM waits show blank      │ chat/route.ts (by design)                     │
  │     │ typing indicator                                          │                                               │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M9  │ No DELETE policy on squad_tier_members                    │ Migrations                                    │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M10 │ 22 unused indexes (mostly on empty tables)                │ Live DB                                       │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M11 │ match_memories RPC accepts arbitrary p_user_id (RLS still │ migrations/20260204100000                     │
  │     │  protects)                                                │                                               │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M12 │ Checkout success page hardcoded dark theme colors         │ checkout/success/page.tsx:52-91               │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M13 │ Admin "Delete Chat History" button has no confirmation    │ admin/users/page.tsx:323-331                  │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M14 │ Avatar lightbox missing keyboard Escape close             │ message-item.tsx:435-476                      │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M15 │ About page spinning logo ignores prefers-reduced-motion   │ about/page.tsx:16-25                          │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M16 │ Downgrade/upgrade modals missing role="dialog" and focus  │ downgrade-keeper-modal.tsx,                   │
  │     │ trap                                                      │ upgrade-picker-modal.tsx                      │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M17 │ Paywall countdown timer leaks intervals (deps include     │ paywall-popup.tsx:34-46                       │
  │     │ secondsLeft)                                              │                                               │
  ├─────┼───────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
  │ M18 │ Duplicate auto-dismiss logic for inline toasts            │ inline-toast.tsx + chat/page.tsx              │
  └─────┴───────────────────────────────────────────────────────────┴───────────────────────────────────────────────┘

  ---
  Feature Suggestions (5 high-impact ideas)

  1. Streamed responses with progressive typing — Currently the entire LLM response is buffered. Streaming
  token-by-token would dramatically reduce perceived latency and make conversations feel more alive.
  2. Push notifications for autonomous replies — Characters reply autonomously but users only see them when they open
  the app. Web push notifications when a character "initiates" a conversation would drive daily return rates.
  3. Character relationship progression — Track relationship depth per character (friendship level, inside jokes,
  milestones). Show visual progression (e.g., heart meters). This creates emotional investment and long-term retention
  hooks.
  4. Group memory highlights / "Remember when..." — Surface old shared memories as spontaneous character callbacks
  ("Remember when you told me about your cat?"). The memory system exists but isn't surfaced proactively in
  conversations.
  5. Voice messages — Let users send voice notes and have characters "respond" with TTS. Even one-way (user voice → text
   transcription → character text response) adds intimacy and differentiates from every other chat app.

  ---
  Prioritized Action Plan

  Week 1 — Critical Security & Billing (ship-blocking)

  1. Fix auth bypass in /activate (C1, C2)
  2. Add auth.uid() guard to increment_profile_counters (C3)
  3. Fix chat_history SELECT policy leak (C4)
  4. Drop conflicting CHECK constraint blocking basic tier (C7)
  5. Add error checking to webhook DB writes (C8)
  6. Add webhook idempotency constraint (C10)
  7. Validate product IDs instead of defaulting (C9)

  Week 2 — Auth & Performance

  8. Create Next.js middleware for server-side auth (C6)
  9. Add memories(user_id, kind, created_at) index (C12)
  10. Eliminate gang lookup waterfall in persistAsync (C11)
  11. Require Redis in production for rate limiting (C13)
  12. Fix non-atomic gang member updates (I2)
  13. Parallelize fetchJourneyState queries (I15)
  14. Fix RLS (select auth.uid()) wrapping (I8)

  Week 3 — UX & Code Quality

  15. Add hydration loading state to chat page (I23)
  16. Replace alert()/confirm() with proper UI (I20, I21)
  17. Fix store subscription selectors (I12, I13)
  18. Fix stale closure in recursive sendToApi (I14)
  19. Add checkout success fallback button (I22)
  20. Fix admin tier controls (I24)

  Week 4 — Polish

  21. Fix checkout success page theming (M12)
  22. Add confirmation to admin destructive actions (M13)
  23. Fix modal accessibility (M16)
  24. Upgrade admin password hashing (C5)
  25. Clean up duplicated hasOpenFloorIntent (I17)