# Admin Pending Setup

This file tracks small environment or ops tasks that are intentionally deferred during implementation.


## Resolved Items

### 1. VAPID subject for push sending

Status: resolved (2026-03-12)

Resolved with:

- `VAPID_SUBJECT=mailto:support@mygang.ai`
- Local `.env.local` already set.
- Vercel env vars: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` must all be set. Confirm in Vercel dashboard if not already done.

Used by:

- Phase 07B: subscription storage and opt-in flow (public key only)
- Phase 07C: server-side web-push sending (all three VAPID vars)
