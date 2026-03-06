# Database & Backend Audit

## Schema Design

**Status: GOOD**

### Tables (from migrations)
- `profiles` — User profile, settings, subscription tier, custom names
- `chat_history` — Message persistence (user_id, messages JSON, updated_at)
- `ai_memories` — Long-term AI memory entries per user
- `gang_members` — User's selected squad (character IDs)
- `admin_runtime_controls` — Admin panel runtime settings
- `analytics_events` — Client-side analytics events

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | HIGH | **Chat history stores messages as JSON blob** per user, not as individual rows. This means no per-message querying, no pagination at DB level, and growing JSON payloads. For scaling, consider normalizing to one row per message. | `supabase/migrations/` |
| 2 | HIGH | **No index on `chat_history.user_id` explicitly visible** in early migrations. Later migration adds an index (`20260207123000_add_chat_history_user_created_index.sql`). Verify this covers the main query pattern. | `supabase/migrations/` |
| 3 | MEDIUM | **`profiles.custom_character_names`** is a JSON field. This is fine for the current use case (small key-value map) but doesn't support querying by character name. |  |
| 4 | MEDIUM | **No foreign key from `gang_members` to a characters table** — characters are defined in code (`constants/characters.ts`), not in DB. This is acceptable for a fixed catalog but means character validation is code-only. |  |
| 5 | LOW | **`purchase_celebration_pending`** flag on profiles — clever pattern for cross-session event delivery. Well designed. |  |

## Server Actions

**Status: GOOD**

- `src/app/auth/actions.ts` — Uses Supabase server client with cookie-based auth
- Auth verified via `supabase.auth.getUser()` in each action
- `updateUserSettings` validates input types before DB write
- `getMemoriesPage` uses cursor-based pagination (good for infinite scroll)
- `deleteMemory` and `updateMemory` verify user ownership via RLS

## Billing Verification

**Status: GOOD (with caveat)**

- Subscription tier is checked server-side in the chat API route via DB query
- Client-side `subscriptionTier` in Zustand is for UI display only
- Stripe webhook handling (if used) should write to `profiles.subscription_tier`
- **Caveat:** The actual payment flow uses Stripe Checkout links from the pricing page. Verify webhook is correctly updating the DB on successful payment.

## Supabase Client Architecture

- **Client-side:** `src/lib/supabase/client.ts` — Uses anon key (safe)
- **Server-side:** `src/lib/supabase/server.ts` — Uses server client with cookies
- **No service role key exposed to client** — confirmed
- **Database types:** `src/lib/database.types.ts` — Generated from Supabase schema
