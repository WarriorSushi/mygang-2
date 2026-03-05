# Database & Supabase Integration -- Deep Review

**Date:** 2026-02-18
**Reviewer:** Senior Database/Backend Architect
**Scope:** All Supabase client setup, authentication, database queries, types, migrations, RLS, real-time, and data access patterns.

---

## Table of Contents

1. [Supabase Client Setup](#1-supabase-client-setup)
2. [Authentication](#2-authentication)
3. [Database Queries](#3-database-queries)
4. [Type Safety](#4-type-safety)
5. [Row Level Security (RLS)](#5-row-level-security-rls)
6. [Real-Time](#6-real-time)
7. [Data Model & Schema Design](#7-data-model--schema-design)
8. [Error Handling](#8-error-handling)
9. [Migrations](#9-migrations)
10. [Edge Cases & Data Consistency](#10-edge-cases--data-consistency)
11. [Summary: What's Great](#11-whats-great)
12. [Summary: What's Buggy or Risky](#12-whats-buggy-or-risky)
13. [Summary: What's Missing](#13-whats-missing)
14. [Prioritized Improvements](#14-prioritized-improvements)

---

## 1. Supabase Client Setup

### Files reviewed
- `src/lib/supabase/client.ts` -- browser client
- `src/lib/supabase/server.ts` -- server client (RSC / server actions / route handlers)
- `src/lib/supabase/admin.ts` -- service-role admin client

### Assessment: GOOD

The three-client separation follows Supabase best practices exactly:

**Browser client** (`client.ts`):
- Uses `createBrowserClient` from `@supabase/ssr` -- correct.
- Validates env vars before construction -- good defensive coding.
- Typed with `Database` generic -- correct.

**Server client** (`server.ts`):
- Uses `createServerClient` from `@supabase/ssr` with cookie adapter -- correct for Next.js App Router.
- `await cookies()` pattern is correct for Next.js 15+.
- The `setAll` try/catch swallowing errors from Server Components is the documented pattern -- fine as long as middleware handles token refresh (see risk below).

**Admin client** (`admin.ts`):
- Singleton pattern (`let adminClient`) avoids re-instantiation -- good for serverless cold starts.
- `autoRefreshToken: false, persistSession: false` -- correct for service role.
- Validates env vars -- good.

### Risks

| Risk | Severity | Detail |
|------|----------|--------|
| **No middleware.ts exists** | **HIGH** | The server client's `setAll` silently swallows cookie-set errors in Server Components, which is documented as safe *only if middleware refreshes sessions*. There is **no `middleware.ts`** in this project. This means expired JWTs may not get refreshed during SSR navigation, causing auth state to become stale. Users could hit server actions with expired tokens. |
| Admin client singleton in serverless | LOW | The module-level singleton works on long-lived servers but in serverless (Vercel), each cold start creates a new one anyway. Not a bug, just no real benefit. |

### Recommendation

**Create a `src/middleware.ts`** that refreshes the Supabase session on every request. This is critical for the `@supabase/ssr` cookie pattern to work reliably:

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  await supabase.auth.getUser()
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

---

## 2. Authentication

### Files reviewed
- `src/app/auth/callback/route.ts`
- `src/app/auth/actions.ts`
- `src/app/auth/layout.tsx`
- `src/app/auth/auth-code-error/page.tsx`
- `src/app/post-auth/page.tsx`
- `src/components/orchestrator/auth-manager.tsx`

### Auth Flow

| Method | Implementation | Status |
|--------|---------------|--------|
| Google OAuth | `signInWithGoogle()` via `supabase.auth.signInWithOAuth` | OK |
| Email/Password | `signInOrSignUpWithPassword()` -- tries sign-in first, then auto-sign-up | OK with caveats |
| Callback | `/auth/callback` exchanges code for session | OK |
| Sign Out | `signOut()` with redirect | OK |
| Account Deletion | Uses admin client to delete user from `auth.users` | OK |
| Post-Auth Routing | `/post-auth` page resolves gang/name state then routes to `/chat` or `/onboarding` | OK |

### What's Good

1. **Open redirect prevention** in callback: `const next = requestedNext.startsWith('/') ? requestedNext : '/post-auth'` -- good guard against redirect attacks.
2. **Zod validation** on all user inputs in server actions (username, character IDs, settings) -- excellent.
3. **Auth layout** sets `robots: { index: false }` -- correct, auth pages shouldn't be crawled.
4. **Auth error page** is user-friendly with clear recovery actions.
5. **Admin account deletion** properly uses the admin client, then signs out the user.
6. **AuthManager** listens to `onAuthStateChange` to handle session lifecycle reactively.

### Risks and Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **Email sign-up/sign-in auto-merge is fragile** | **MEDIUM** | `signInOrSignUpWithPassword` infers "should try sign-up" based on error message string matching (`includes('invalid login')`, `includes('credentials')`). If Supabase changes error messages (which they have done between versions), this logic breaks silently. The retry-sign-in after sign-up (`retrySignIn`) is also a workaround for email confirmation being disabled. |
| **`getSession()` usage on client** | **MEDIUM** | In `auth-manager.tsx` line 46: `(await supabase.auth.getSession()).data.session`. Supabase docs warn that `getSession()` reads from local storage and should not be trusted for security decisions. `getUser()` should be preferred for server-side auth checks. The server actions all use `getUser()` correctly, but the client-side `AuthManager` uses `getSession()` as a fallback. |
| **No CSRF protection on server actions** | LOW | Next.js server actions have built-in CSRF protection via the `__next_action_id` header, but the `POST /api/chat` route handler does not have explicit CSRF protection beyond rate limiting. In practice, the auth check + rate limiting make this low-risk. |
| **Missing email confirmation** | LOW | `enable_confirmations = false` in `config.toml` means email accounts are created without verification. This can enable spam account creation. Appropriate for early-stage MVP but should be enabled before scaling. |
| **Password policy is weak** | LOW | `minimum_password_length = 6` with `password_requirements = ""` (no requirements). Should be at least 8 chars with mixed requirements for production. |

---

## 3. Database Queries

### Files reviewed
- `src/app/auth/actions.ts` (all server actions)
- `src/app/api/chat/route.ts`
- `src/lib/ai/memory.ts`
- `src/lib/supabase/client-journey.ts`
- `src/hooks/use-chat-history.ts`

### Query Patterns

**Pagination** (chat history & memories): Uses cursor-based pagination with `limit + 1` pattern to detect `hasMore` -- **correct and efficient**. The chat history uses a composite cursor (`created_at|id`) which handles ties properly.

**N+1 Issues:**

| Location | Pattern | Severity |
|----------|---------|----------|
| `client-journey.ts:fetchJourneyState` | 3 sequential queries: profiles, gangs, gang_members | **MEDIUM** -- could be a single query with joins |
| `client-journey.ts:persistUserJourney` | Up to 4 sequential queries: profile update, gang upsert, delete members, insert members | **MEDIUM** -- the delete+insert is not transactional |
| `chat/route.ts` persistence block | ~6 sequential queries: profile update, RPC call, gang upsert, read recent history, check existing IDs, insert history | **LOW** -- fire-and-forget, doesn't block response |

**Efficient Queries:**
- Chat history pagination uses proper indexes (`chat_history_user_created_idx`).
- Memory retrieval uses `retrieveMemoriesLite` which fetches top 50 by recency then scores in-memory -- avoids embedding cost for every request. Smart trade-off.
- The `match_memories` RPC uses vector cosine distance with a threshold -- efficient for similarity search.

**Potential Inefficiency:**
- `compactMemoriesIfNeeded` fetches ALL episodic memories for a user (`order by created_at ASC` with no limit). For power users with hundreds of memories, this could be slow. However, the compaction threshold of 10 is very low, so this fires often but on small sets.

### Missing Indexes (Inferred)

The following queries lack explicit index coverage based on the migrations:

| Query Pattern | Index Needed |
|---------------|-------------|
| `memories.eq('user_id', userId).eq('kind', 'episodic')` (used heavily) | Composite index on `(user_id, kind, created_at DESC)` -- currently only `(user_id, created_at DESC)` exists |
| `chat_history.in('client_message_id', [...])` with `user_id` + `gang_id` | Partial index exists but the `IN` clause may not use it efficiently |
| `gang_members.eq('gang_id', gang.id)` | No explicit index -- relies on FK index which Postgres does NOT auto-create on the referencing side |

---

## 4. Type Safety

### Files reviewed
- `src/lib/database.types.ts`

### Assessment: GOOD

- Types are generated from Supabase CLI (`supabase gen types`) -- the standard `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `CompositeTypes` helpers are all present.
- All three client constructors use `<Database>` generic -- queries are type-checked at compile time.
- The `__InternalSupabase.PostgrestVersion: "14.1"` annotation is present for correct PostgREST typing.

### Gaps

| Gap | Severity |
|-----|----------|
| **Manual type overrides throughout** | MEDIUM | Files like `client-journey.ts`, `chat/route.ts`, and `memory.ts` define their own row types (`JourneyProfile`, `ChatHistoryPageRow`, `ProfileStateRow`, etc.) instead of using the generated `Tables<'profiles'>` helper. This means schema changes won't cause compile errors in these files -- the manually defined types could drift from the actual schema. |
| **`embedding` typed as `string` in generated types** | LOW | The `embedding` column is `VECTOR(768)` in Postgres but shows as `string | null` in the generated types. The code casts `embedding as unknown as string` in multiple places. This is a known limitation of Supabase type generation for the `vector` extension. |
| **`custom_character_names` not in profiles type** | LOW | The field `custom_character_names` appears in queries (`select('... custom_character_names')`) but is not visible in the generated `database.types.ts` profiles definition. This suggests the types file may be slightly out of date, or the column was added via a migration not reflected in regeneration. |

### Recommendation

Run `supabase gen types typescript` to regenerate types, and replace manual type definitions with the generated helpers:

```typescript
// Instead of:
type ProfileStateRow = { user_profile: Record<string, unknown> | null; ... }

// Use:
type ProfileStateRow = Pick<Tables<'profiles'>, 'user_profile' | 'relationship_state' | ...>
```

---

## 5. Row Level Security (RLS)

### Assessment: GOOD with critical gaps

All tables have RLS enabled -- verified in migrations:

| Table | RLS Enabled | Policies |
|-------|-------------|----------|
| `profiles` | Yes | SELECT own, UPDATE own |
| `gangs` | Yes | SELECT own, ALL own |
| `gang_members` | Yes | SELECT via gang ownership, ALL via gang ownership |
| `chat_history` | Yes | SELECT (own OR guest), INSERT (own OR guest) |
| `memories` | Yes | ALL own |
| `analytics_events` | Yes | INSERT (own or null user_id), SELECT own |
| `characters` | **Yes (implicit)** | **No policies defined** |
| `admin_runtime_settings` | Yes | **No policies defined** |
| `admin_audit_log` | Yes | **No policies defined** |

### Critical Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **`characters` table has no RLS policies** | **HIGH** | RLS is enabled (implicitly, since it was created without `ALTER TABLE ... ENABLE RLS` in the initial migration -- but checking the initial migration, RLS is NOT enabled on `characters`). The `characters` table lacks any policies AND lacks `ENABLE ROW LEVEL SECURITY`. This means any authenticated user can read characters via the API, which is likely intentional (characters are shared data), but they could also potentially INSERT/UPDATE/DELETE characters if they craft raw Supabase API calls. |
| **`admin_runtime_settings` has no SELECT/UPDATE policies** | **MEDIUM** | RLS is enabled but no policies are defined. The admin client uses the service role key (bypasses RLS) so admin operations work, but if any code accidentally uses the regular client against this table, it will silently return empty results. The `getGlobalLowCostOverride()` in `chat/route.ts` correctly uses `createAdminClient()`, so this works in practice. |
| **`admin_audit_log` has no policies** | **MEDIUM** | Same as above -- relies entirely on admin client bypassing RLS. Correct in practice. |
| **`chat_history` guest policy is overly permissive** | **MEDIUM** | `USING (user_id = auth.uid() OR is_guest = TRUE)` allows ANY authenticated user to read ALL guest messages (where `is_guest = TRUE`). Similarly, any user can INSERT rows with `is_guest = TRUE`. This could be exploited to read other users' pre-auth messages. |
| **No DELETE policy on `chat_history`** | **MEDIUM** | `deleteAllMessages()` in actions.ts calls `.delete().eq('user_id', user.id)` but there is no DELETE policy on `chat_history`. This will silently fail (return 0 deleted rows) via the regular client. It likely works because the INSERT policy allows the operation or because PostgREST treats it differently -- but this should be explicitly tested. |
| **No UPDATE policy on `chat_history`** | LOW | Reactions are stored on insert, not updated. The `reaction` column in existing rows is never updated after insertion, so this is fine for current usage. |

### Recommendations

1. **Add `ENABLE ROW LEVEL SECURITY` on `characters`** and create a SELECT-only policy for authenticated/anon users.
2. **Add DELETE policy on `chat_history`** for `user_id = auth.uid()`.
3. **Tighten the guest policy**: Remove `is_guest = TRUE` from SELECT or scope it to a time window.

---

## 6. Real-Time

### Assessment: NOT USED (intentionally)

There are **no Supabase Realtime subscriptions** in this project. The only subscription is `supabase.auth.onAuthStateChange()` for session management, which uses Supabase's built-in auth listener (not Realtime channels).

Instead, the project uses a **polling-based sync strategy** via `useChatHistory`:
- Polls every 12 seconds (`setInterval`)
- Syncs on window focus/visibility change
- Manual refresh button in chat header

This is a reasonable choice for a chat application where messages are generated server-side (AI responses) and the primary consumer is the single authenticated user. Realtime would add complexity and cost for marginal benefit here since messages are pushed back in the API response, not from another client.

### Trade-off

The 12-second polling interval means a user won't see externally-persisted changes (e.g., messages from another device) for up to 12 seconds. The `syncLatestHistory(force)` on focus/visibility mitigates this well.

---

## 7. Data Model & Schema Design

### Entity Relationship (Inferred)

```
auth.users (Supabase managed)
  |-- 1:1 --> profiles (id = auth.users.id, CASCADE)
  |              |-- 1:1 --> gangs (user_id, CASCADE)
  |              |              |-- 1:N --> gang_members (gang_id, CASCADE)
  |              |                            |-- N:1 --> characters (character_id)
  |              |-- 1:N --> chat_history (user_id, CASCADE)
  |              |-- 1:N --> memories (user_id, CASCADE)
  |              |-- 1:N --> analytics_events (user_id, SET NULL)
  |
  characters (standalone reference table)
  admin_runtime_settings (singleton config)
  admin_audit_log (append-only log)
```

### What's Good

1. **CASCADE deletes** on all user-facing foreign keys -- deleting a user cleanly removes all their data.
2. **`gangs.user_id` UNIQUE constraint** -- enforces 1:1 relationship correctly.
3. **`gang_members` UNIQUE(gang_id, character_id)** -- prevents duplicate character assignments.
4. **`profiles.id` references `auth.users(id)`** -- standard Supabase pattern for extending auth.
5. **`analytics_events.user_id` ON DELETE SET NULL** -- preserves analytics after user deletion for aggregate analysis.
6. **Vector column** (`embedding VECTOR(768)`) for semantic memory search is well-designed.

### Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **`chat_history.gang_id` is mandatory** | **MEDIUM** | Every chat message requires a `gang_id` FK to `gangs`. But the chat API has to `upsert` a gang before persisting messages. If the gang doesn't exist yet (first message), the persistence logic must create it first. This creates a dependency chain and potential race condition on first message. |
| **`profiles` is a "god table"** | **LOW** | The profiles table accumulates many concerns: user settings (theme, wallpaper, chat_mode), AI state (session_summary, summary_turns, user_profile, relationship_state), usage tracking (daily_msg_count, abuse_score), and account info (username, subscription_tier). At 18+ columns, consider extracting `user_settings` and `user_ai_state` into separate tables for maintainability. |
| **`chat_history.speaker` is TEXT, not FK** | LOW | The `speaker` column holds either `'user'` or a character ID but has no FK constraint to `characters`. This is pragmatic (allows `'user'` as a value) but means orphaned character IDs can persist if characters are renamed/removed. |
| **No `updated_at` trigger** | LOW | `profiles.updated_at` exists but no trigger auto-updates it. It relies on the application setting it manually, which is done inconsistently. |
| **`custom_character_names` column missing from initial migration** | LOW | Referenced in code but not visible in the migration files reviewed. Either added outside tracked migrations or in a migration not included in the listing. |

---

## 8. Error Handling

### Assessment: ADEQUATE with gaps

**Good patterns:**
- All server actions check `getUser()` before proceeding and return early if unauthenticated.
- Zod validation on all user inputs prevents malformed data from reaching the database.
- The chat route has comprehensive error handling with different status codes (400, 429, 502, 500).
- `isMissingHistoryMetadataColumnsError()` gracefully handles schema migrations mid-flight (backward compatibility for the `client_message_id` / `reaction` / `reply_to_client_message_id` columns).

**Gaps:**

| Gap | Severity | Detail |
|-----|----------|--------|
| **Silent error swallowing in server actions** | **MEDIUM** | Many actions log errors with `console.error` but return `undefined` (void) to the caller. For example, `saveGang()`, `saveUsername()`, `updateUserSettings()` return nothing on failure. The UI has no way to know the operation failed. |
| **No retry logic anywhere** | **MEDIUM** | Database operations have zero retry logic. A transient connection error (common in serverless with connection pooling) will fail permanently. At minimum, the critical chat history persistence should retry once. |
| **`deleteAccount()` returns void on error** | **MEDIUM** | If admin deletion fails, the function just returns. The user has no feedback. Worse, it doesn't sign them out if deletion fails, leaving them in an inconsistent state. |
| **Fire-and-forget persistence** | LOW | The chat route's `persistAsync().catch(...)` pattern means the response is returned before persistence completes. If persistence fails, the user's messages are in local state but not in the database. The periodic sync will eventually detect the discrepancy, but messages could be lost on device switch. This is a deliberate performance trade-off and is documented in the code. |

---

## 9. Migrations

### Files reviewed
- 14 migration files in `supabase/migrations/`

### Assessment: GOOD

**Migration history:**
```
20260203190126 -- initial_schema (tables, RLS, trigger, seed characters)
20260204000000 -- match_memories function (v1)
20260204100000 -- match_memories function (v2, adds public schema)
20260206220000 -- add memory state columns to profiles + memories
20260206221000 -- add character prompt_block column
20260206223000 -- add chat_wallpaper to profiles
20260206223500 -- add analytics_events table
20260207014500 -- fix gang_members RLS policies
20260207061000 -- add performance indexes
20260207123000 -- add chat_history user+created index
20260210173000 -- add low_cost_mode to profiles
20260210224000 -- add admin runtime settings + audit log
20260211001000 -- add chat history message metadata columns
20260216200000 -- atomic profile increment function
```

**What's Good:**
1. Migrations are well-structured, incremental, and use `IF NOT EXISTS` / `IF NOT EXISTS` for idempotency.
2. Indexes are added in dedicated migrations after the schema stabilized.
3. The `increment_profile_counters` RPC function uses `SECURITY DEFINER` to avoid race conditions on counter updates -- excellent pattern.
4. `CREATE OR REPLACE FUNCTION` for the match_memories function allows safe re-deployment.

**Issues:**

| Issue | Severity | Detail |
|-------|----------|--------|
| **Duplicate migration** | LOW | `20260204000000_match_memories.sql` and `20260204100000_add_match_memories.sql` define the same function. The second one (with `public.` schema qualifier) supersedes the first. The first migration is dead weight. |
| **`match_memories` not `SECURITY DEFINER`** | LOW | The function runs as the calling user, which is fine because RLS on `memories` already restricts access. But it means the RPC call goes through RLS twice (once for the function, once for the underlying table access). Adding `SECURITY DEFINER` with explicit `p_user_id` filtering would be slightly more efficient. |
| **No down migrations** | LOW | There are no rollback scripts. This is common in production Supabase projects and is acceptable if the team uses forward-only migration strategy. |
| **Seed data in migration** | LOW | Character seed data is in the initial migration rather than a separate seed file (though `seed.sql` is configured in `config.toml`). This means re-running migrations will re-insert characters (though the PK constraint prevents duplicates due to `INSERT ... VALUES` not using `ON CONFLICT`). |

---

## 10. Edge Cases & Data Consistency

### Concurrent Writes

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Two tabs sending messages simultaneously | **MEDIUM** | Both will persist to `chat_history`. The `client_message_id` dedup check in the chat route prevents exact duplicates, but near-simultaneous messages with different content will both persist. The `reconcileMessagesFromHistory` hook handles merging on the client. |
| Profile counter race condition | **LOW** | Solved by `increment_profile_counters` RPC which uses atomic `SET column = column + increment`. This was a known issue that was fixed in migration `20260216200000`. |
| Gang member update race condition | **MEDIUM** | `persistUserJourney` and `saveGang` both do DELETE-all-then-INSERT for gang members. If two requests overlap, the second DELETE could wipe the first INSERT. No transaction wrapping. |

### Orphaned Records

| Scenario | Risk |
|----------|------|
| User deleted | **NONE** -- CASCADE on all FKs properly cleans up. |
| Character removed from `characters` table | **MEDIUM** -- `gang_members.character_id` FK has no CASCADE, so deleting a character will fail if any user has it in their gang. This is actually *correct* behavior (prevents data loss) but needs admin handling. |
| Gang deleted without cleanup | **NONE** -- `chat_history.gang_id` and `gang_members.gang_id` both CASCADE. |

### Data Consistency

| Concern | Assessment |
|---------|-----------|
| **`preferred_squad` vs `gang_members` dual source of truth** | **MEDIUM** -- The gang composition is stored in both `profiles.preferred_squad` (array) and `gang_members` (rows). `fetchJourneyState` falls back from `gang_members` to `preferred_squad` if the gang has < 2 members. `saveGang` updates both. If either write fails, they can drift. |
| **`daily_msg_count` reset logic** | **LOW** -- The chat route checks `last_msg_reset` and resets to 0 if > 24 hours. This is a best-effort daily reset, not a precise midnight reset. Acceptable for rate limiting purposes. |
| **Guest messages** | **LOW** -- `is_guest = TRUE` messages have `user_id = NULL`. When a guest signs up, there's no migration of guest messages to their new user account. These messages become orphaned. |

---

## 11. What's GREAT

1. **Three-client architecture** (browser/server/admin) follows Supabase best practices perfectly.
2. **Comprehensive RLS** -- every table has RLS enabled. The policies are well-thought-out with proper `auth.uid()` checks.
3. **Zod validation** on all server action inputs prevents injection and malformed data.
4. **Atomic counter increments** via the `increment_profile_counters` RPC function -- eliminates race conditions on profile updates.
5. **Cursor-based pagination** with the `limit + 1` pattern is efficient and correct.
6. **Backward-compatible schema evolution** -- the `isMissingHistoryMetadataColumnsError` fallback allows the app to work during migration rollout without downtime.
7. **Fire-and-forget persistence** in the chat route -- returning the response immediately while persisting in the background is excellent for perceived performance.
8. **Sophisticated client-side reconciliation** in `use-chat-history.ts` -- the dedup, signature matching, and merge logic handles local/remote message conflicts gracefully.
9. **Vector similarity search** with `match_memories` RPC for semantic memory retrieval.
10. **Admin audit logging** on all admin operations with IP, user agent, and before/after state.

---

## 12. What's BUGGY or RISKY

### Priority 1 (Fix now)

1. **No `middleware.ts` for session refresh** -- expired JWTs will not be refreshed during server-side navigation, causing intermittent auth failures. This is the single most impactful missing piece.

2. **`chat_history` DELETE policy missing** -- `deleteAllMessages()` in `auth/actions.ts` calls `.delete().eq('user_id', user.id)` but there is no RLS DELETE policy on `chat_history`. This operation likely silently returns 0 deleted rows. Users who try to clear their history may think it succeeded while nothing was actually deleted.

3. **Guest messages RLS is overly permissive** -- Any authenticated user can read all `is_guest = TRUE` messages from all users via the Supabase API. The policy should be scoped more tightly.

### Priority 2 (Fix soon)

4. **Gang member update is not transactional** -- The DELETE-then-INSERT pattern in `saveGang()` and `persistUserJourney()` can leave users with 0 gang members if the INSERT fails after the DELETE succeeds.

5. **`characters` table lacks RLS** -- While characters are meant to be public data, without RLS enabled, any authenticated user could potentially INSERT/UPDATE/DELETE characters via direct API calls.

6. **Server actions return void on failure** -- `saveGang`, `saveUsername`, `updateUserSettings`, `deleteMemory` all swallow errors. The UI cannot inform the user of failures.

---

## 13. What's MISSING

1. **Middleware for session refresh** (critical).
2. **Database connection retry logic** -- no retry on transient failures.
3. **`updated_at` auto-update trigger** on `profiles`.
4. **Index on `memories(user_id, kind, created_at DESC)`** -- the most common query pattern filters by both `user_id` and `kind`.
5. **Index on `gang_members(gang_id)`** -- Postgres does not auto-create indexes on FK columns.
6. **Monitoring/alerting on RLS policy violations** -- no way to detect if queries are being blocked by RLS.
7. **Database connection pooling configuration** -- `db.pooler.enabled = false` in config.toml. For production with serverless functions, PgBouncer should be enabled.
8. **Soft delete support** -- account deletion is hard delete only. No recovery window.
9. **Data export capability** -- no way for users to export their data (GDPR requirement).
10. **Rate limiting at the database level** -- all rate limiting is in-memory (Node.js Map), which resets on serverless cold starts.

---

## 14. Prioritized Improvements

### P0 -- Critical (do this week)

| # | Improvement | Effort | Impact |
|---|-------------|--------|--------|
| 1 | **Add `middleware.ts` for Supabase session refresh** | Small | Prevents auth failures across the entire app |
| 2 | **Add DELETE policy on `chat_history`** | Trivial | Fixes broken "clear history" feature |
| 3 | **Enable RLS on `characters` table with SELECT-only policy** | Trivial | Prevents unauthorized mutations to shared data |

### P1 -- Important (do this sprint)

| # | Improvement | Effort | Impact |
|---|-------------|--------|--------|
| 4 | **Wrap gang member updates in a transaction** (use RPC or `supabase.rpc`) | Medium | Prevents orphaned gang state |
| 5 | **Tighten guest message RLS policy** | Small | Closes data leakage vector |
| 6 | **Return error states from server actions** | Medium | Enables UI error feedback |
| 7 | **Regenerate `database.types.ts`** and replace manual type definitions | Small | Catches schema drift at compile time |
| 8 | **Add composite index on `memories(user_id, kind, created_at DESC)`** | Trivial | Improves memory query performance |

### P2 -- Good Practice (do next sprint)

| # | Improvement | Effort | Impact |
|---|-------------|--------|--------|
| 9 | Add `updated_at` trigger on `profiles` | Small | Data hygiene |
| 10 | Enable connection pooling for production | Small | Better serverless performance |
| 11 | Add retry logic (1 retry) on critical database operations | Medium | Resilience to transient failures |
| 12 | Strengthen password requirements to 8+ chars with mixed case | Trivial | Security baseline |
| 13 | Enable email confirmation | Small | Prevents spam accounts |
| 14 | Consolidate `preferred_squad` and `gang_members` to single source of truth | Medium | Eliminates data consistency bugs |

### P3 -- Long-term

| # | Improvement | Effort | Impact |
|---|-------------|--------|--------|
| 15 | Extract profiles into `user_settings` and `user_ai_state` tables | Large | Cleaner schema, better query performance |
| 16 | Add data export endpoint (GDPR compliance) | Medium | Legal requirement |
| 17 | Migrate rate limiting to Redis or Supabase-backed storage | Medium | Survives serverless cold starts |
| 18 | Add database-level audit triggers for sensitive operations | Large | Defense in depth |

---

## Appendix: File Index

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client (RSC, actions, route handlers) |
| `src/lib/supabase/admin.ts` | Service-role admin client (bypasses RLS) |
| `src/lib/supabase/client-journey.ts` | Client-side gang/profile fetch+persist helpers |
| `src/lib/database.types.ts` | Generated TypeScript types for all tables |
| `src/lib/chat-utils.ts` | Message ID sanitization, error detection helpers |
| `src/app/auth/callback/route.ts` | OAuth callback handler |
| `src/app/auth/actions.ts` | Auth + data server actions (sign in, CRUD) |
| `src/app/auth/layout.tsx` | Auth layout (noindex robots) |
| `src/app/auth/auth-code-error/page.tsx` | Auth error recovery page |
| `src/hooks/use-chat-history.ts` | Client-side chat history sync + reconciliation |
| `src/app/api/chat/route.ts` | Main chat API route (LLM + persistence) |
| `src/lib/ai/memory.ts` | Memory storage, retrieval, compaction |
| `src/app/admin/actions.ts` | Admin server actions |
| `src/app/api/analytics/route.ts` | Analytics event ingestion |
| `src/components/orchestrator/auth-manager.tsx` | Client-side auth state manager |
| `src/app/post-auth/page.tsx` | Post-OAuth routing logic |
| `supabase/config.toml` | Local Supabase configuration |
| `supabase/migrations/*.sql` | 14 migration files |
