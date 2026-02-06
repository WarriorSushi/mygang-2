# Production Readiness Review - MyGang.ai

## Verdict (Feb 6, 2026)
Ready for production after the fixes below and with required environment configuration in place (Supabase + AI keys + Upstash). I implemented the fixes noted here in code; the remaining risk is operational (secrets, deployment config, monitoring).

---

## Critical Issues (Must Fix Before Production)

1. **Open AI endpoint without auth or rate limiting**
   - **Where:** `src/app/api/chat/route.ts`, `src/lib/rate-limit.ts`, `package.json`
   - **Impact:** Anyone could hit `/api/chat` and burn API quota.
   - **Fix (Implemented):** Added per-user/per-IP rate limiting with Upstash (Redis) support and an in-memory fallback for local/dev. Guests are limited more strictly than authenticated users.
   - **Status:** Fixed
   - **Notes (What I did):** Added `@upstash/ratelimit` + `@upstash/redis`, created `src/lib/rate-limit.ts`, and wired per-user/per-IP limits in `src/app/api/chat/route.ts`. In production, set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

2. **Server trusts client-provided `activeGang` + `messages` without validation**
   - **Where:** `src/app/api/chat/route.ts`
   - **Impact:** Prompt injection + cost abuse via untrusted payloads.
   - **Fix (Implemented):** Server now validates payloads with `zod`, accepts only character IDs, and rebuilds the gang from trusted constants. Messages are trimmed and filtered to allowed speakers.
   - **Status:** Fixed
   - **Notes (What I did):** Added a strict `requestSchema`, used `activeGangIds`, filtered to known characters, trimmed content, and limited message history.

---

## Major Issues

1. **Chat API error responses are dropped in the UI**
   - **Where:** `src/app/chat/page.tsx`
   - **Impact:** On error, the UI showed no feedback.
   - **Fix (Implemented):** Client now parses error JSON and renders a visible fallback message even when `res.ok === false`.
   - **Status:** Fixed
   - **Notes (What I did):** Added non-OK response handling and a system error message fallback.

2. **Guest auth wall breaks conversation flow**
   - **Where:** `src/app/chat/page.tsx`
   - **Impact:** Guest's second message vanished into auth gate.
   - **Fix (Implemented):** Auth wall triggers before the second guest message is added and queues the message to send after login.
   - **Status:** Fixed
   - **Notes (What I did):** Added `pendingBlockedMessageRef` and post-login replay; auth wall auto-closes once auth completes.

3. **Status updates do not re-render**
   - **Where:** `src/components/chat/message-list.tsx`
   - **Impact:** Status text did not update without a new message.
   - **Fix (Implemented):** Subscribed to `characterStatuses` via store selector.
   - **Status:** Fixed
   - **Notes (What I did):** Replaced `useChatStore.getState()` usage with a reactive selector.

4. **Haptic toggle does not do anything**
   - **Where:** `src/components/chat/message-list.tsx`, `src/components/chat/chat-settings.tsx`
   - **Impact:** Haptics fired even when disabled.
   - **Fix (Implemented):** Haptic feedback now respects the store toggle.
   - **Status:** Fixed
   - **Notes (What I did):** Gated `navigator.vibrate` behind `isHapticEnabled`.

5. **Auth failure route missing**
   - **Where:** `src/app/auth/callback/route.ts`
   - **Impact:** OAuth failure leads to a 404.
   - **Fix (Implemented):** Added a friendly `auth-code-error` page.
   - **Status:** Fixed
   - **Notes (What I did):** Added `src/app/auth/auth-code-error/page.tsx`.

6. **Embedding failures can break chat responses**
   - **Where:** `src/lib/ai/memory.ts`, `src/app/auth/actions.ts`
   - **Impact:** Memory storage failure could fail chat response.
   - **Fix (Implemented):** Memory embedding/storage failures are now caught and logged.
   - **Status:** Fixed
   - **Notes (What I did):** Wrapped embedding and storage in try/catch; graceful fallback on error.

7. **Potential privacy leak on logout**
   - **Where:** `src/components/orchestrator/auth-manager.tsx`
   - **Impact:** Chat state remained after logout on shared devices.
   - **Fix (Implemented):** Cleared user-scoped state on logout.
   - **Status:** Fixed
   - **Notes (What I did):** Cleared messages, names, and gang on logout.

8. **Onboarding/Chat routing flicker for returning users**
   - **Where:** `src/app/chat/page.tsx`
   - **Impact:** `/chat` redirected before hydration was complete.
   - **Fix (Implemented):** Redirect now waits for store hydration.
   - **Status:** Fixed
   - **Notes (What I did):** Gated redirect and intro trigger on `isHydrated`.

---

## Minor Issues / Polish

1. **Broken UTF-8 characters**
   - **Where:** `src/app/page.tsx`, `src/constants/characters.ts`, `src/components/chat/message-item.tsx`, `supabase/migrations/20260203190126_initial_schema.sql`
   - **Impact:** Visible mojibake (bad symbols and corrupted emoji).
   - **Fix (Implemented):** Replaced broken glyphs and normalized user-facing strings.
   - **Status:** Fixed
   - **Notes (What I did):** Cleaned the footer copy, restored bullet separator in message header, and normalized persona samples.

2. **Playwright tests are stale**
   - **Where:** `tests/chat-flow.spec.ts`, `tests/visual-check.spec.ts`
   - **Impact:** Tests no longer matched UI.
   - **Fix (Implemented):** Added stable `data-testid`s and updated tests.
   - **Status:** Fixed
   - **Notes (What I did):** Added test IDs on CTA, onboarding steps, character cards, chat header/input, and auth wall; updated selectors accordingly.

3. **AuthManager never syncs server gang if local gang exists**
   - **Where:** `src/components/orchestrator/auth-manager.tsx`
   - **Impact:** Local gang could diverge from cloud state.
   - **Fix (Implemented):** Always fetch server gang; if none exists, persist local gang.
   - **Status:** Fixed
   - **Notes (What I did):** Sync server-first and push local only if server empty.

4. **LLM schema allows `message` events without content**
   - **Where:** `src/app/api/chat/route.ts`, `src/app/chat/page.tsx`
   - **Impact:** Client could throw on missing content.
   - **Fix (Implemented):** Enforced discriminated union; guarded empty content on client.
   - **Status:** Fixed
   - **Notes (What I did):** Required `content` for `message` events, added defensive handling in UI.

---

## UX / Flow Improvements

1. **Auth wall placement**
   - **Status:** Fixed
   - **Notes (What I did):** Triggered the auth wall before second guest message is added, and queued message replay post-login.

2. **Empty state on Memory Vault for guests**
   - **Status:** Fixed
   - **Notes (What I did):** Added guest-aware empty state messaging in `MemoryVault`.

3. **Landing CTA during hydration**
   - **Status:** Fixed
   - **Notes (What I did):** Disabled CTA and prevented navigation while hydration is in progress.

4. **Autonomous mode clarity**
   - **Status:** Acceptable
   - **Notes:** Existing micro-copy in settings already explains the behavior. If you want more, I can add a tooltip with full descriptions.

---

## Routing / SEO / Production Hardening

1. **Add error route for auth failures**
   - **Status:** Fixed
   - **Notes:** Added `auth-code-error` page with retry/back navigation.

2. **Security headers**
   - **Status:** Fixed
   - **Notes (What I did):** Added HSTS (prod only), X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy in `next.config.ts`.

3. **Rate limit /api/chat**
   - **Status:** Fixed
   - **Notes:** Implemented per-user/per-IP rate limiting with Upstash.

---

## Testing and QA Gaps

1. **E2E tests use brittle selectors**
   - **Status:** Fixed
   - **Notes:** Added stable `data-testid` attributes and updated Playwright selectors.

2. **No API tests for `/api/chat`**
   - **Status:** Fixed
   - **Notes (What I did):** Added a validation test that asserts the API rejects malformed payloads.

3. **No auth flow tests**
   - **Status:** Fixed
   - **Notes (What I did):** Added a test for the auth error route to validate OAuth failure handling.

---

## Notes and Opportunities

- **chat_history table unused:** Now wired to persist user and AI messages for authenticated users only.
- **Monitoring:** Consider adding Sentry (client + server) and basic metrics for AI latency and error rates.

---

## Required Environment Configuration (Production)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## Recommended Fix Order (Completed)

1. Locked down `/api/chat` with rate limiting and input validation.
2. Fixed UI error handling and auth wall flow.
3. Addressed hydration gating, haptics, and status rendering.
4. Added auth error page and updated tests.
5. Cleaned encoding issues and UX polish.
6. Added API/auth tests and wired chat history persistence.

If you want, I can add full mocked LLM tests or make chat history exportable in the UI next.
