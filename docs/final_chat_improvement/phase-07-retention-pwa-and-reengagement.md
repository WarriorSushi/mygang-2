# Phase 07 - Retention, PWA, and Re-engagement

## Goal

Turn chat improvements into durable return behavior:

- installability
- push capability
- better tab presence
- optional recap and re-engagement features

This phase depends heavily on Phase 06 if you want the highest-value retention features.


## Read These Files First

- `public/manifest.json`
- `package.json`
- `src/hooks/use-chat-api.ts`
- `src/app/layout.tsx`
- `src/components/settings/settings-panel.tsx`
- any future WYWA background code from Phase 06

## Current Repo State

Important facts:

1. `public/manifest.json` exists.
2. There is no service worker.
3. There is no `next-pwa` package or equivalent today.
4. There is no push-subscription storage table.
5. There is no web-push package.
6. Browser `Notification` is currently only used for cooldown reminders inside an open browsing context.
7. There is no document-title unread-count system today.

## Scope

This phase should include:

1. installable PWA foundation
2. push subscription infrastructure
3. tab/title presence signals
4. optional re-engagement features built on top of WYWA

This phase should not begin before:

- Phase 06 is stable
- message-source handling exists

## Recommended Breakdown

### Part A - PWA Foundation

Add:

- service worker
- installability support
- optional offline fallback

Recommended package direction:

- `@ducanh2912/next-pwa` or another maintained Next-compatible approach

Important:

- keep the initial PWA scope small
- installability and push are more valuable here than a complicated offline-first experience


### Part B - Push Subscription Infrastructure

Add:

1. `push_subscriptions` table
2. subscription create/delete API endpoints
3. VAPID keys in environment
4. service-worker push handling
5. permission flow UI

Suggested table sketch:

```sql
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_idx
  ON public.push_subscriptions (user_id, endpoint);
```

Suggested security follow-up:

```sql
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
```


### Part C - Tab Presence

Add lightweight indicators such as:

- `document.title = "MyGang (3 new)"`
- optional favicon badge if worth the effort

Recommendation:

- do title count first
- treat favicon badge as optional, because cross-browser support is uneven and iOS Safari is weak here


### Part D - Re-engagement Features

These are only worth doing after Phase 06:

- push teaser from WYWA batches
- question of the day
- weekly recap
- friendship milestones
- optional email follow-ups

## Files Most Likely To Change

- `package.json`
- `public/manifest.json`
- new service worker files
- new API routes for subscription CRUD
- `src/lib/database.types.ts`
- settings or chat UI for notification opt-in
- background send path, likely tied to WYWA generator

## Required Work

### Task 1 - Add PWA Baseline

Implement installability first.

Keep scope narrow:

- service worker registration
- manifest validation
- stable icons

Do not block the phase on full offline chat support.

### Task 2 - Add Push Subscription Storage

You need:

- a DB table
- routes or actions to save and remove subscriptions
- per-user ownership

Recommended behavior:

- store one row per user/endpoint
- upsert safely
- allow multiple devices

### Task 3 - Add Push Permission UX

Do not request push permission on first load.

Better timing:

- after a few chats
- after user has seen value
- with a clear explanation

This repo already has settings UI, so a notification preference entry point there is sensible.


### Task 4 - Integrate Push With WYWA

Best-value flow:

- WYWA generates a small batch
- if push is enabled, send one teaser notification
- notification opens the chat

Do not send one push per message.


### Task 5 - Add Title-Based Presence Signals

This is cheap and useful even before perfect push support.

Recommended:

- count new unseen ecosystem or WYWA rows
- update `document.title`
- clear count on focus/read

## Cautions

### Caution 1 - iOS Browser Limits Are Real

Do not oversell favicon badges or platform-specific PWA behavior.

Title updates are the safest cross-platform lightweight signal.

### Caution 2 - Push Without Product Timing Feels Spammy

Permission prompts too early will hurt conversion.

Tie prompts to user value, not page load.


### Caution 3 - Separate Transport From Product Logic

Push infrastructure is transport.
WYWA, recap, and question-of-the-day are product logic.

Build transport first, then hook product triggers into it.


### Caution 4 - Keep Local Notification Fallback In Mind

The existing browser `Notification` path for cooldown completion is not a substitute for push, but it is a useful fallback to preserve if it does not conflict with the new system.

## Suggested Implementation Order

1. Add service worker and PWA baseline.
2. Add push subscription table and CRUD.
3. Add notification permission UI.
4. Add title-based presence signals.
5. Integrate push sends with WYWA.
6. Add optional recap or question-of-the-day features.

## Acceptance Criteria

This phase is done when:

1. The app is installable as a PWA.
2. Users can opt into push notifications.
3. Push subscriptions are stored safely per device.
4. Title-based presence indicators work.
5. WYWA can trigger one teaser push, not a spam burst.

## Test Plan

Minimum:

```bash
pnpm lint
```

Recommended:

1. manual installability check in desktop and mobile browsers
2. manual push subscription create/delete test
3. manual notification-open-to-chat flow
4. manual title-count update test

## Suggested Commits

1. `pwa: add service worker and installability foundation`
2. `push: add subscription storage and client registration`
3. `chat: add title presence indicators`
4. `retention: hook wywa into push notifications`

## Nice To Have, Not Required

- add weekly recap cards only after push and WYWA are proven stable
- add email only if push adoption is weak and compliance work is acceptable
