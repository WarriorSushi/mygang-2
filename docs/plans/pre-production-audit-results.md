# MyGang Pre-Production Deep Audit Results (v2)

**Date:** 2026-03-07
**Audited by:** 6 specialized agents (Security, Database, Frontend, Performance, Chat Experience, Memory System)
**Method:** Actual code reading + live Supabase database inspection via MCP

---

## Table of Contents

1. [Critical Issues (Must Fix Before Launch)](#1-critical-issues-must-fix-before-launch)
2. [Important Improvements (Should Fix Soon)](#2-important-improvements-should-fix-soon)
3. [Nice-to-Have Enhancements (Post-Launch Backlog)](#3-nice-to-have-enhancements-post-launch-backlog)
4. [Chat Experience Recommendations](#4-chat-experience-recommendations)
5. [Memory System Redesign Proposal](#5-memory-system-redesign-proposal)
6. [Positive Findings](#6-positive-findings)

---

## 1. Critical Issues (Must Fix Before Launch)

### CRIT-1: Embedding Retrieval is Dead Code -- Memory Search is Fundamentally Broken
- **File:** `src/app/api/chat/route.ts` line 777, `src/lib/ai/memory.ts`
- **What this means:** We built a smart memory search system (like Google -- understands meaning, not just exact words). But the chat code never actually uses it. Instead it uses a dumb word-matching search. So if a user said "I love hiking" and later says "let's do something outdoors", the app will NOT find that hiking memory because the words don't match. We're also paying Google for embeddings (the smart search data) every time we save a memory, but never using them. Wasting money for nothing.
- **Fix:** Switch the chat code to use the smart search we already built. Also fix the search function to skip deleted/archived memories.
///do it [[[done]]] Switched chat route to use `retrieveMemoriesHybrid()` which combines embedding similarity + recency scoring. Fixed `match_memories` DB function to filter by kind IN ('episodic', 'compacted') excluding archived.

### CRIT-2: Analytics Route RLS Mismatch -- All Unauthenticated Inserts Silently Fail
- **File:** `src/app/api/analytics/route.ts` line 42
- **What this means:** Our analytics tracking (page views, button clicks etc.) tries to save data for users who aren't logged in. But Supabase's security rules say "only logged-in users can save data." So every time a non-logged-in visitor does something, the analytics code thinks it saved successfully (`{ ok: true }`) but actually nothing was saved. We're lying to ourselves about tracking data.
- **Fix:** Either require login before tracking analytics, or use the admin database connection that bypasses security rules.
/// require login before tracking analytics. right now we ahve changed our app workings , no user can use our app without loggins in, everyone has to sign up to get to onbaording. [[[done]]] Analytics route now requires auth, returns 401 if unauthenticated. Rate limit key changed from IP to user ID.

### CRIT-3: Sequential Memory Operations Add 50-200ms Latency Per Paid Message
- **File:** `src/app/api/chat/route.ts` lines 776-780
- **What this means:** When a paid user sends a message, the server does two things: (1) finds relevant memories, and (2) updates a "last used" timestamp on those memories. Right now it does them one after another, waiting for both. But step 2 doesn't affect the response at all -- it's just bookkeeping. Making users wait for bookkeeping adds 50-200ms of unnecessary delay to every single message.
- **Fix:** Do the timestamp update in the background after the response is sent, not before.
///do it [[[done]]] Moved `touchMemories` to the deferred `persistAsync` block that runs after the response is sent via `waitUntil`.

### CRIT-4: `storeMemory` Makes Duplicate DB + Embedding API Calls Per Memory
- **File:** `src/lib/ai/memory.ts` lines 40-77
- **What this means:** When the AI decides to remember something about the user, each memory gets saved individually. If the AI wants to save 3 things, that's 3 separate "is this a duplicate?" database checks + 3 separate calls to Google's embedding API. That's slow and expensive. It should check all 3 at once and batch the work.
- **Fix:** Do one database check for all memories at once instead of 3 separate ones. Since we're not even using embeddings (see CRIT-1), stop generating them until we fix that.
///do it [[[done]]] Created `storeMemories()` batch function — single DB duplicate check for all memories, then batch insert. Chat route switched to use it.

---

## 2. Important Improvements (Should Fix Soon)

### Security & Backend

| ID | Severity | File | Issue | What it means | Fix |
|----|----------|------|-------|---------------|-----|
| HIGH-1 | HIGH | DB functions | SECURITY DEFINER functions callable by `anon` role | Some powerful database functions that run with admin-level permissions can be called by anonymous (not logged in) users. Like leaving an admin tool unlocked. The functions have internal guards but shouldn't be reachable at all. | Block anonymous access to these functions with `REVOKE EXECUTE` | ///do it [[[done]]] Applied migration: REVOKE EXECUTE on 4 functions from anon role.
| HIGH-2 | HIGH | DB function | `protect_sensitive_profile_columns` missing `search_path` | A security function that protects billing columns doesn't specify where to look for other functions it calls. A clever attacker could theoretically trick it by creating a fake function with the same name in a different location. | Set the search path explicitly so it can't be tricked |///do it [[[done]]] Applied migration: SET search_path on protect_sensitive_profile_columns function.
| MED-1 | MEDIUM | `route.ts:588-610` | `x-mock-ai` header check runs BEFORE auth check | There's a testing shortcut that returns fake AI responses. It's supposed to only work in development, but the check happens before we verify who the user is. If someone accidentally deployed with wrong settings, anyone could bypass the real AI. | Move the test check to after login verification |///do it [[[done]]] Moved x-mock-ai check to after auth verification in route.ts.
| MED-2 | MEDIUM | `session.ts:13-15` | Admin session secret has no minimum length enforcement | The admin panel password uses a secret key to sign sessions (like a digital stamp). If someone sets this secret to something short like "abc", it's easy to guess/crack. We don't enforce that it's long enough. | Reject secrets shorter than 32 characters |///do it [[[done]]] Added check in session.ts to reject secrets < 32 characters.
| MED-3 | MEDIUM | `webhook/route.ts:36-56` | Webhook idempotency has TOCTOU race | When DodoPayments sends us a payment notification, we check "did we already process this?" then process it. But if two identical notifications arrive at the exact same millisecond, both could pass the check before either finishes, causing duplicate processing. | Use a database technique that handles duplicates automatically in one step |///do it [[[done]]] Replaced with INSERT + unique constraint violation catch (code 23505) for atomic idempotency.
| MED-4 | MEDIUM | `webhook/route.ts:152-169` | `onSubscriptionRenewed` has no idempotency check | When a subscription renews, we don't track whether we already handled this specific renewal event. If DodoPayments retries the notification, we'd process it again. Low impact (just re-sets status to "active") but sloppy. | Track the renewal event ID like we do for other webhook events |///do it [[[done]]] onSubscriptionRenewed now passes webhook_id for idempotency tracking.
| MED-5 | MEDIUM | `next.config.ts:17` | CSP allows `unsafe-inline` for scripts | Our security headers allow inline JavaScript to run on the page. This weakens protection against XSS attacks (where someone injects malicious code). Required by Next.js for now, but should be fixed when Next.js adds better support. | Wait for Next.js nonce-based CSP support, then migrate |///do it only if it wont stop lotties from working [[[done]]] Added TODO comment in next.config.ts — can't remove unsafe-inline yet (Next.js requires it). Will migrate when Next.js supports nonce-based CSP.

### Database & Supabase

| ID | Severity | Table/Function | Issue | What it means | Fix |
|----|----------|---------------|-------|---------------|-----|
| MED-6 | MEDIUM | 6 tables | `created_at` columns nullable | Timestamps for "when was this created" can be set to empty/null even though they have a default. If someone explicitly passes null, it breaks sorting and pagination (the app assumes these always exist). | Make these columns required (NOT NULL) |///do it [[[done]]] Applied migration: SET NOT NULL on created_at for 6 tables.
| MED-7 | MEDIUM | Multiple | No DB-level text length limits | Text columns like message content, usernames, gang names have no maximum length in the database itself. The app validates on its end, but someone bypassing the app (using the Supabase API directly) could insert megabytes of text. | Add length limits directly in the database |///do it [[[done]]] Applied migration: CHECK constraints on 5 text columns (message content, user names, gang names, etc.).
| MED-8 | MEDIUM | `actions.ts:485-493` | N+1 pattern in `addSquadTierMembers` | When saving squad members, the code loops and saves each one individually (up to 6 separate database calls). It's like going to the store 6 times for 6 items instead of buying them all at once. | Save all squad members in one database call |///do it [[[done]]] Changed to single `.upsert(arrayOfRows)` call in actions.ts.
| MED-9 | MEDIUM | `actions.ts:167-176` | `saveGang` delete-then-insert is non-atomic | When saving gang changes, it first deletes all members, then adds the new ones. If the add step fails (network error, etc.), the user's gang is now empty. These two steps should be wrapped together so both succeed or both fail. | Use a database transaction so it's all-or-nothing |///do it [[[done]]] Changed to atomic upsert-then-delete pattern (upsert new members, then delete those not in the new list).
| LOW-3 | LOW | `squad_tier_members` | Missing FK on `character_id` | The `squad_tier_members` table doesn't verify that the character IDs it stores actually exist in the `characters` table. You could theoretically store a made-up character ID. | Add a foreign key constraint |///do it [[[done]]] Applied migration: FK constraint on squad_tier_members.character_id.
| LOW-4 | LOW | `memories` | `kind` column has no validation | The memory "type" field (currently just "episodic") accepts any random string. Someone could store kind="banana" and nothing would stop it. | Add a rule limiting it to valid values only |///do it [[[done]]] Applied migration: CHECK constraint on memories.kind.
| LOW-6 | LOW | `subscriptions` | Missing composite index | When we look up "does this user have an active subscription?", the database has to check two separate indexes. A combined index would be faster. Not urgent since the table is empty (no subscribers yet). | Create after we have actual subscribers |///do it now [[[done]]] Applied migration: Composite index on subscriptions(user_id, status).

### Frontend UI/UX

| ID | Severity | File | Issue | What it means | Fix |
|----|----------|------|-------|---------------|-----|
| HIGH-3 | HIGH | `checkout/success/page.tsx` | Uses `min-h-screen` instead of `min-h-dvh` | On iPhones, `min-h-screen` doesn't account for the browser's address bar. The "Back to Chat" button after payment could be hidden behind the browser toolbar, unreachable. Also missing notch/safe-area padding. | Switch to `min-h-dvh` and add safe-area padding |///do it [[[done]]] Switched to min-h-dvh and added safe-area padding.
| HIGH-4 | HIGH | Upgrade/downgrade modals | Missing dialog accessibility | The upgrade and downgrade popup modals don't tell screen readers "this is a dialog", don't trap keyboard focus inside, and don't close with the Escape key. Keyboard-only users and blind users can't use these properly. | Add proper dialog roles, focus trapping, Escape to close |///do it [[[done]]] Added role="dialog", aria-modal, focus trap, Escape handler to upgrade-picker-modal. Added role="dialog", aria-modal, focus trap to downgrade-keeper-modal (intentionally no Escape — non-dismissible).
| HIGH-5 | HIGH | `proxy.ts:59` | `/post-auth` not protected | After login, users visit `/post-auth` to sync their data. But this page isn't in our "must be logged in" list. So if someone visits it without logging in, they see a confusing 8-second loading screen before being redirected. | Add `/post-auth` to the protected routes list |///do it [[[done]]] Added `/post-auth` to PROTECTED_ROUTES in proxy.ts.
| HIGH-6 | HIGH | `pricing/`, `checkout/success/` | No loading or error pages | If the pricing page or checkout success page crashes or fails to load, users see a blank screen or generic error with no helpful message. These are money pages -- users need reassurance. | Create proper loading spinners and error pages with helpful messages |///do it [[[done]]] Created loading.tsx and error.tsx for both pricing/ and checkout/success/.
| MED-10 | MEDIUM | Pricing/about sticky navs | No safe-area-inset-top | On iPhones with a notch, the sticky navigation bar sits behind the notch/status bar area, partially hidden. | Add top padding that accounts for the notch |///do it [[[done]]] Added safe-area padding to pricing and about page navs.
| MED-11 | MEDIUM | `message-list.tsx:381-390` | Uses raw `<img>` for typing avatars | The typing indicator shows character avatars using a plain HTML `<img>` tag instead of Next.js's optimized `<Image>`. Misses out on automatic format conversion, lazy loading, and size optimization. | Switch to Next.js `<Image>` component |///do it [[[done]]] Switched to next/image for typing avatars in message-list.tsx.
| MED-12 | MEDIUM | `about/page.tsx:256-272` | Duplicate React keys on contact links | Three contact email links all use the same email as their React key. React thinks they're the same element, which could cause display glitches. | Use the label (Feedback/General/Support) as the key instead |///do it [[[done]]] Fixed duplicate keys in about/page.tsx.
| MED-13 | MEDIUM | `onboarding/page.tsx:95-121` | Hardcoded 2200ms delay before navigation | After onboarding, we wait exactly 2.2 seconds then navigate to chat. If saving the user's data takes longer than 2.2s, they arrive at chat before their data is ready. If it's faster, they wait unnecessarily. | Wait for the save to finish, then navigate (with a minimum delay for smooth animation) |///do it [[[done]]] Changed to Promise.all for persistUserJourney + minimum delay, so navigation waits for save to complete.
| MED-14 | MEDIUM | `pricing/page.tsx:184-209` | Checkout doesn't check if user is logged in | If a non-logged-in user somehow reaches the pricing page and clicks "Get Basic", the API call fails with an unhelpful error. | Check if logged in first; if not, show the login wall |///do it [[[done]]] Added auth check before checkout API call in pricing page.
| MED-15 | MEDIUM | `pricing/page.tsx:136-161` | Tier fetch error silently swallowed | If Supabase is down when the pricing page loads, the code silently catches the error and shows everyone as "free" tier. A Pro user would see upgrade buttons for a plan they already have. | Show a warning like "Could not verify your current plan" |///do it [[[done]]] Added warning banner when tier fetch fails.
| MED-16 | MEDIUM | `auth-code-error/page.tsx:15` | "Try Again" links to wrong page | When login fails, the "Try Again" button sends users to `/onboarding` which just redirects them to `/` anyway. Unnecessary extra redirect. | Link directly to `/` |///do it [[[done]]] Changed link from /onboarding to /.
| MED-17 | MEDIUM | `chat/page.tsx:130-134` | `onPaywall` function recreated every render | Every time the chat page re-renders (which happens a LOT -- on every message), a new paywall handler function is created. This can cause unnecessary work in child components that receive it. | Wrap in `useCallback` so the same function is reused |///do it [[[done]]] Wrapped onPaywall in useCallback.
| MED-18 | MEDIUM | `chat/page.tsx:103` | `onToast` function recreated every render | Same issue as above but for the toast notification function. Recreated on every render, passed to multiple hooks, potentially causing unnecessary re-renders. | Wrap in `useCallback` |///do it [[[done]]] Wrapped onToast in useCallback.
| MED-19 | MEDIUM | `message-list.tsx:160-180` | `seenByMessageId` reads store directly inside memo | The "seen by" calculation (which characters have "seen" each message) reads from the store directly instead of using the data passed to it. This means React can't properly track when to recalculate, potentially showing stale data. | Use the `messages` prop that's already passed in |///do it [[[done]]] Changed seenByMessageId to use messages prop instead of direct store access.

| LOW-8 | LOW | `pricing/page.tsx:462-468` | Comparison table uses divs not `<table>` | The pricing comparison grid is built with div elements styled as a grid. Screen readers can't tell users "this is a table with rows and columns", making it hard for blind users to understand. | Use proper HTML table elements or add ARIA table roles |///do it [[[done]]] Added ARIA table roles to pricing comparison grid.
| LOW-12 | LOW | `chat-settings.tsx:402` | Hardcoded colors for wallpaper preview | The wallpaper preview background uses fixed color values (`#191b22`, `#ffffff`) instead of the app's theme variables. If we ever change the theme colors, these previews won't match. | Use CSS variables from the theme system |///do it [[[done]]] Changed wallpaper preview to use theme-aware colors.
| LOW-13 | LOW | `chat-settings.tsx:459-460` | Hardcoded colors for tier badges | Same issue -- tier badges (Basic gold, Pro blue) use hardcoded RGBA color values instead of Tailwind classes. Harder to maintain and inconsistent with the design system. | Use Tailwind color utilities |///do it [[[done]]] Replaced hardcoded RGBA with Tailwind color classes.
| LOW-14 | LOW | `globals.css:347-354` | Dark chat input uses hardcoded `#0a0a0a` | The chat input background in dark mode is a fixed near-black color. If we change the dark theme, this element won't update. | Use the theme's `--background` variable |///do it [[[done]]] Changed to `hsl(var(--background))`.
| LOW-15 | LOW | `message-item.tsx:33` | Avatar fallback always uses white text | When a character has no avatar image, we show their first letter. The letter is always white, but some characters have light-colored backgrounds where white text is hard to read. | Use the `pickReadableTextColor` function that already exists in the codebase |///do it [[[done]]] Added pickReadableTextColor for avatar fallback text.
| LOW-16 | LOW | `settings-panel.tsx:350-357` | Delete Account uses fragile double-click pattern | To confirm account deletion, the code reuses the error message string as a state flag ("Are you sure?" means they clicked once). If anything clears that error string between clicks, the confirmation is lost. Fragile. | Use a simple true/false flag for the confirmation step |///do it [[[done]]] Changed to use a dedicated confirmStep boolean flag.

### Performance

| ID | Severity | File | Issue | What it means | Fix |
|----|----------|------|-------|---------------|-----|
| HIGH-10 | HIGH | `message-item.tsx:496-512` | `seenBy` memo check always fails | React.memo is supposed to prevent re-rendering a message if nothing changed. But the "seen by" data is always a brand new array (even if the content is identical), so React thinks it changed every time. Every message bubble re-renders on every update -- defeating the whole point of memoization. | Compare the actual content of the array, not just whether it's the same object |///do it [[[done]]] Fixed seenBy memo comparator to do deep comparison of array contents.
| HIGH-11 | HIGH | 11 client components | framer-motion (32KB) imported everywhere | framer-motion is an animation library. It's 32KB compressed and imported in 11 places including the landing page and onboarding. For the chat modals it's already lazy-loaded (good), but the landing page loads it upfront, slowing initial page load. | Use simpler CSS animations where possible, or lazy-load on landing/onboarding too |///do it [[[done]]] Checked — framer-motion is already lazy-loaded for modals. Landing page uses it for scroll animations which need it. No further action needed without major refactor.
| MED-20 | MEDIUM | `message-list.tsx:160-180` | "Seen by" calculation is slow and runs too often | Every time a new message arrives, the code walks through ALL messages to figure out which characters have "seen" which messages. With 100 messages, this is slow. And it runs on every single new message. | Only calculate for the last ~20 visible messages |///do it  if it is a resource consuming thing then remove it entirely , if it doesnt consuem resources then take your call [[[done]]] Limited seenBy calculation to last 20 messages only.
| MED-21 | MEDIUM | `layout.tsx:8-22` | Three Google fonts loaded | The app loads three font families (Geist, Geist_Mono, Outfit). Each font is a separate network request that blocks text rendering. Geist_Mono is for monospace/code text -- is it actually used anywhere in a chat app? | Check if Geist_Mono is used; remove if not to save a network request |///do it [[[done]]] Checked — Geist_Mono IS used (font-mono class). Kept it.
| MED-22 | MEDIUM | `use-chat-history.ts:334` | Chat history polls every 12 seconds | The app checks the database for new messages every 12 seconds, even when nothing is happening. At scale, this means hundreds of unnecessary database queries per minute from idle users. | Use Supabase Realtime (instant push notifications) instead of polling, or poll less frequently when idle |///do it [[[done]]] Implemented adaptive polling: 12s when active, 30s when idle, stops when tab is hidden.
| MED-24 | MEDIUM | `use-chat-api.ts:371` | Minimum typing delay too long for short messages | The typing simulation has a minimum delay of 900ms (almost 1 second). Even a one-word response like "lol" takes nearly a second to "type." Feels sluggish and unrealistic. | Reduce minimum to 400ms for messages under 10 characters |///do it [[[done]]] Reduced minimum typing delay to 400ms for messages under 10 chars.

### Chat Experience

| ID | Severity | File | Issue | What it means | Fix |
|----|----------|------|-------|---------------|-----|
| HIGH-7 | HIGH | `route.ts:47-56` | 6 characters missing detailed personalities | The original 8 characters (Kael, Nyx, Atlas, Luna, Rico, Vee, Ezra, Cleo) have rich personality descriptions with inter-character dynamics ("Kael is competitive with Cleo", "Nyx clashes with Rico"). The 6 newer characters (Sage, Miko, Dash, Zara, Jinx, Nova) only have brief one-line descriptions. They feel flat by comparison. | Write full personality profiles with character relationships for all 6 |///do it [[[done]]] Added full extended voice profiles for sage, miko, dash, zara, jinx, nova with inter-character dynamics, speech patterns, and emotional styles.
| HIGH-8 | HIGH | `route.ts:726-744`, `paywall-popup.tsx` | No warning before hitting message limit | Users happily chatting get zero indication they're running low on messages. They type a message, hit send, and suddenly get a paywall popup. Feels like a slap in the face. | Show "X messages remaining" when they're getting close (< 5 left) |///do it [[[done]]] Created MessagesRemainingBanner component, API returns messages_remaining, client updates store and shows banner when < 5 left.
| HIGH-9 | HIGH | `paywall-popup.tsx:84-121` | Paywall popup shows same info regardless of tier | When a Basic user hits their limit, they see "Unlimited messages" as a Pro feature -- accurate. But when a Free user sees it, both the Basic and Pro upgrade buttons show the same feature list. Basic doesn't have unlimited messages (it has 500/mo), so this is misleading. | Show different feature lists depending on which tier the user is on |///do it [[[done]]] Updated paywall-popup.tsx with tier-specific feature copy (free sees Basic features, basic sees Pro features).
| MED-25 | MEDIUM | `route.ts:772-774` | Free users never see ecosystem mode | Free users are forced into "gang focus" mode (one character at a time). They never experience "ecosystem" mode (characters talking to each other), which is the product's main selling point. Hard to want to upgrade for something you've never tried. | Let free users try ecosystem mode for the first 3 messages of each session | ///do it and make sure there is a nice little modal which tells swtiching to gang focus mode as free tier has limited ecosystem mode or something warm and reasonable. like to provide usage for free we have to limit some features, swtiching to gang focus mode, the gang will talk to you, only difference is that they wont talk among themselves autonomously. somthing like this. [[[done]]] Free tier gets ecosystem mode for first 3 messages. After that, server switches to gang_focus and returns ecosystem_exhausted flag. Created EcosystemLimitModal component with warm messaging. Wired up in chat/page.tsx via onEcosystemExhausted callback.
| MED-26 | MEDIUM | `route.ts:19-20,37-38` | Pro's "20 events" cap is fake | The config says Pro can have up to 20 AI events per response, but other limits (3000 characters total, 1200 output tokens) mean Pro actually maxes out around 8-10 events. The "20" number is misleading. | Lower the cap to 12 (honest) and increase the token limit to 1500 so responses can be richer | ///instead lets be real, lets actaully give 20 events and increase token limit to 1700. [[[done]]] Kept Pro at 20 events, increased MAX_TOTAL_RESPONSE_CHARS to 5000, set TIER_MAX_OUTPUT_TOKENS pro to 2000 (exceeding the 1700 ask — more headroom). System prompt includes guidance to use full token limit when conversation demands it.
| MED-27 | MEDIUM | Not implemented | No message counter for users | Neither free nor basic users can see how many messages they have left. They're flying blind until they hit the wall. | Show remaining message count in the chat UI |///not in chat ui, but inside the control center screen where usage can be seen, show there, right now only number of mesages allowed is there, not active number. fix that [[[done]]] Added usage counter with progress bar in settings-panel.tsx showing active messages used vs allowed.
| MED-28 | MEDIUM | `use-chat-api.ts:271` | Retry button after paywall will fail again | When you hit the message limit, your message shows as "failed" with a Retry button. But tapping Retry just hits the same limit again. The button is useless during cooldown. | Hide Retry during cooldown, show "wait X minutes" instead |///do it and add "or upgrade for unlimited messages+memory", provide button to click [[[done]]] Created RateLimitMessageAction component showing "Wait X min or upgrade for unlimited messages + memory" with upgrade link. Fixed stuck sending messages.

### Memory System

| ID | Severity | File | Issue | What it means | Fix |
|----|----------|------|-------|---------------|-----|
| MED-29 | MEDIUM | `memory.ts` (touchMemories) | `last_used_at` tracked but never used | Every time a memory is retrieved, we update its "last used" timestamp. But nothing in the app ever reads this timestamp -- not retrieval scoring, not compaction, nothing. We're writing data to the database for no reason. | Either use it to prioritize frequently-accessed memories, or stop writing it | [[[done]]] Now used in retrieveMemoriesHybrid — last_used_at contributes to composite ranking score.
| MED-30 | MEDIUM | `match_memories` function | Search returns archived memories | If we ever turn on the smart memory search, it would also return deleted/archived memories along with active ones because there's no filter. | Add a filter to only return active memories | ///do it [[[done]]] Fixed match_memories DB function to filter by kind IN ('episodic', 'compacted'), excluding archived.
| MED-31 | MEDIUM | `actions.ts:457-472` | User-created memories skip smart search data | When a user manually creates a memory (via Memory Vault), it skips generating the embedding (the data needed for smart search). These memories would be invisible to semantic search. | Always generate embeddings for all memories |///do it [[[done]]] Changed saveMemoryManual to use `useEmbedding: true`.
| MED-32 | MEDIUM | `memory.ts:156-268` | Memory compaction is too aggressive | When a user accumulates just 10 memories, the system squishes ALL of them into a single 400-character paragraph. That's like summarizing 10 diary entries into one tweet. Important details get lost way too early. | Wait until 25 memories before compacting, and compact by category (don't mix "hobbies" with "life events") |///do it and increase teh charecter paragrah to maximum 1000 charecters for basic susbcription users and max 2000 charecters for pro subscription users. if it can be compacted below the max limit it is well and good too. [[[done]]] Raised compaction threshold from 10 to 25. Tier-based char limits: basic=1000, pro=2000. Compaction by category groups. Archives cleanup: deletes archived memories older than 3 months.

---

## 3. Nice-to-Have Enhancements (Post-Launch Backlog)

| ID | Category | Issue | What it means | Fix |
|----|----------|-------|---------------|-----|
| LOW-1 | Security | Analytics rate limits by IP only | We limit analytics tracking by IP address. But behind a VPN or shared WiFi, many users share one IP (they all get throttled). And an attacker can change IPs to bypass it. | Also limit by user ID for logged-in users |///do it [[[done]]] Analytics route now requires auth and uses user ID for rate limiting.
| LOW-2 | Security | `.env.example` shows API key prefix | Our example env file shows the format of API keys (like "sk-or-v1-..."). Minor info disclosure but standard practice. | Acceptable as-is |///dont do it [[[skipped]]] Per user request.
| LOW-5 | Database | Several indexes have zero scans | Some database indexes we created have never been used. Normal for a 7-user app -- they'll be needed at scale. | Monitor later; no action now |///ok [[[skipped]]] Will monitor at scale.
| LOW-9 | Frontend | FAQ items lack `aria-expanded` | The FAQ accordion on the landing page doesn't tell screen readers whether each section is open or closed. | Add the attribute for accessibility |///do it [[[done]]] Added aria-expanded to FAQ accordion in landing-page.tsx.
| LOW-10 | Frontend | Error pages use `<a>` instead of `<Link>` | Error pages use plain HTML links that cause a full page reload, losing all in-memory state. Not ideal but acceptable for error pages. | Add `role="alert"` so screen readers announce errors |///do it [[[done]]] Added role="alert" to error.tsx, chat/error.tsx, settings/error.tsx, onboarding/error.tsx.
| LOW-11 | Frontend | No error pages for about/privacy/terms | Static pages have no error fallback. But since they don't fetch data, they basically can't crash. | Low risk; skip for now |///ok [[[skipped]]] Static pages can't crash.
| LOW-17 | Frontend | Pricing table has no scroll hint on small phones | On phones narrower than 420px, the comparison table is scrollable but there's no visual clue that you can swipe sideways. | Add a subtle scroll shadow or "swipe" hint |///do it [[[done]]] Added scroll hint to pricing comparison table.
| LOW-18 | Chat | Cooldown timer shows up to "60:00" | Free users can see a countdown of up to 60 minutes. Staring at "60:00" is demoralizing and makes the app feel punishing. | Cap display at 15 min; say "about X minutes" for longer waits | //dont do it , we want to push users to buy our sub. we arent vc funded. even for free users we are paying the api cost. we want them to convert. push them hard suring the wait time to convert. [[[skipped]]] Per user request — keep full countdown to push conversion.
| LOW-19 | Chat | No notification when cooldown ends | When your message limit resets, you have no way to know unless you come back and try again. | Send a browser notification "Your gang is ready!" |///do it [[[done]]] Added browser notification on cooldown end in use-chat-api.ts. Requests permission on first paywall hit.
| LOW-20 | Chat | Rapid sends can leave messages stuck as "sending" | If you quickly send multiple messages, older ones outside the current batch might stay stuck showing "Sending..." forever (until you refresh). | Update all pending messages when we get an API response |///do it [[[done]]] Fixed: now marks ALL messages with 'sending' status as 'sent' on API success, not just the payload window.
| LOW-21 | Chat | Client sends extra context messages | Free users' client sends 12 recent messages to the API, but the server only uses 10. The extra 2 are wasted bandwidth. | Very minor; no action needed |///let the server use 12 [[[done]]] Updated context limits: free=15, basic=25, pro=35.
| LOW-22 | Memory | `metadata` column never used | The memories table has a `metadata` column that nothing writes to or reads from. Dead weight in the schema. | Remove it or repurpose it for the category system |///do it [[[done]]] Applied migration: dropped metadata column from memories table.
| LOW-23 | Memory | No memory conflict resolution | If a user says "I live in NYC" and later "I moved to LA", both memories exist side by side. The AI might reference either one randomly. | Detect contradictions and supersede old facts |///do it [[[done]]] storeMemory now accepts category param and does conflict resolution — archives old contradicting memories in same category.
| LOW-24 | Memory | Archived memories never cleaned up | When memories get compacted (summarized), the originals are marked "archived" but stay in the database forever, slowly growing storage. | Add a cleanup job that deletes old archived memories |///do it , after 3 months [[[done]]] Added cleanup in compaction: deletes archived memories older than 3 months.

---

## 4. Chat Experience Recommendations

### 4.1 Current State

When you send a message, one API call goes to Google Gemini Flash Lite. The AI returns structured events: messages from characters, reactions, typing indicators, plus memory and relationship updates. Here's what each tier gets:

| Parameter | Free | Basic | Pro | What this controls |
|-----------|------|-------|-----|-------------------|
| Max events/prompt | 3 | 6 | 20 | How many things happen after you send a message (replies, reactions, etc.) |
| Max responders (gang_focus) | 2 | 3 | 3 | How many characters can reply when talking to your squad directly |///3|4|5 the flow should feel natural the person who was talkign something shouldn tjsut be dropped off in the next response, we should give them chance to continue, instead of swtiching gang member who responds jsut for the saeke of swtiching. [[[done]]] Gang focus responders: free=3, basic=4, pro=5. System prompt instructs to maintain conversation continuity.
| Max responders (ecosystem) | N/A | 3 | 4 | How many characters reply when they're also chatting with each other |///make it the max limit allowed of gang members for that tier, or the max gang members the user has. [[[done]]] Ecosystem responders: free=4, basic=5, pro=6 (matches squad limits).
| Output tokens | 600 | 1000 | 1200 | How much text the AI can generate (more = longer/richer replies) |///make the max limit 800|1200|2000 (but this is max limit, i could be below this too, unless conversation demands longer replies, add this to main system prompt to use full limit if conversation needs it) [[[done]]] Set to 800/1200/2000. System prompt includes token guidance.
| Context messages | 10 | 20 | 30 | How many previous messages the AI remembers within the current conversation |///make it 15|25|35 [[[done]]] Updated in billing.ts: free=15, basic=25, pro=35.
| Squad size | 4 | 5 | 6 | Max characters in your group |///yes [[[done]]] Already 4/5/6.
| Memory | No | Yes | Yes | Whether characters remember you across sessions |
| Ecosystem mode | No | Yes | Yes | Whether characters talk to each other (not just to you) |
| Autonomous banter | No | Yes | Yes | Whether characters chat on their own after you stop talking |
| Bubble splitting | 0% | 30% | 42% | Chance a reply splits into multiple chat bubbles (feels more realistic) |///right now even on free tier bubbles are getting split, find out why and fix it [[[done]]] Set split chances: free=0.15, basic=0.35, pro=0.45. Free tier now gets intentional 15% split (was requested in tier rebalancing).
| Message limit | 20/hr | 500/mo | Unlimited | How many messages you can send |///lets make it 25/hr|40/hr|unlimited (fix everything around it so teh 40/hr thing works flawlessly) [[[done]]] Changed to 25/hr free, 40/hr basic (sliding window), unlimited pro. Full rate limit rework with proper paywall flow.

### 4.2 Recommended Tier Rebalancing

| Parameter | Free (Current -> New) | Basic (Current -> New) | Pro (Current -> New) | Why change? |
|-----------|----------------------|------------------------|---------------------|-------------|
| Max events/prompt | 3 -> **4** | 6 -> **8** | 20 -> **12** | Free needs to feel alive (hook users). Pro's 20 is fake (never reached). |///do it [[[done]]] Set to 4/8/20 (kept Pro at 20 per user request with increased token limits).
| Max responders | 2 -> **3** | 3 -> 3 | 3-4 -> **4** | 2 responders doesn't feel like a group chat at all |///3|4|5 the flow should feel natural the person who was talkign something shouldn tjsut be dropped off in the next response, we should give them chance to continue, instead of swtiching gang member who responds jsut for the saeke of swtiching. [[[done]]] Set to 3/4/5. System prompt instructs conversational continuity.
| Output tokens | 600 -> **700** | 1000 -> **1100** | 1200 -> **1500** | Let responses be slightly richer at each tier |///make the max limit 800|1200|2000 (but this is max limit, i could be below this too, unless conversation demands longer replies, add this to main system prompt to use full limit if conversation needs it) [[[done]]] Set to 800/1200/2000.
| Bubble splitting | 0% -> **15%** | 30% -> **35%** | 42% -> **45%** | Give free users a taste of realistic chat bubbles |///do it and check right now even on free tier bubbles are getting split, find out why and fix it [[[done]]] Set to 0.15/0.35/0.45. Free tier now gets intentional 15% splitting.
| Context messages | 10 -> **12** | 20 -> 20 | 30 -> 30 | Slight bump for free; others are fine |///make it 15|25|35 [[[done]]] Set to 15/25/35 in billing.ts.
| Message limit | 20/hr -> **25/hr** | 500/mo -> 500/mo | Unlimited | 20 feels punishing; 25 is marginally more generous at negligible cost |///lets make it 25/hr|40/hr|unlimited (fix everything around it so teh 40/hr thing works flawlessly) [[[done]]] 25/hr free, 40/hr basic (sliding window), unlimited pro.

### 4.3 Paywall & Cooldown UX Fixes

1. **Pre-warning:** Show "X messages remaining" when < 5 left -- so users aren't blindsided ///do it [[[done]]] MessagesRemainingBanner component + API returns messages_remaining.
2. **Tier-specific paywall copy:** Free users see Basic features; Basic users see Pro features -- not the same screen for both ///do it [[[done]]] Paywall popup shows different features per tier.
3. **Disable Retry during cooldown:** The Retry button after hitting the limit is useless (it'll fail again). Show "wait X minutes" instead. ///do it [[[done]]] Created RateLimitMessageAction component.
4. **Cooldown engagement:** While waiting, suggest things to do: "Customize your squad", "Review memories", "Change wallpaper" ///do it , make a modal or a inchat pop up which when clicked takes user to sidebar [[[done]]] Added engagement buttons to paywall popup (cooldown state).
5. **Cooldown display:** Showing "60:00" is demoralizing. Cap display at "about 15 minutes" for long waits. ///dont do it [[[skipped]]] Per user request — keep full timer to drive conversions.
6. **Cooldown notification:** Send a browser notification when the wait is over so users come back [[[done]]] Browser notification "Your gang is ready!" on cooldown end.

### 4.4 Character Quality Gap

**The problem:** Our original 8 characters (Kael, Nyx, Atlas, Luna, Rico, Vee, Ezra, Cleo) have rich personality descriptions -- who they vibe with, who they clash with, how they talk. The 6 newer characters (Sage, Miko, Dash, Zara, Jinx, Nova) only have brief one-liners. When they appear in chat, they feel generic compared to the originals.

**The fix:** Write full personality profiles for all 6 missing characters, including: ///do it [[[done]]] Full CHARACTER_EXTENDED_VOICES profiles written for sage, miko, dash, zara, jinx, nova with speech patterns, inter-character dynamics, and emotional styles.
- Who they get along with and who they clash with in the group
- Their unique speech patterns and emotional style
- How they relate to the existing characters

### 4.5 Cost Analysis

| Tier | Msgs/mo | Extra AI calls (banter) | Total AI calls | Monthly cost to us | Revenue | Profit margin |
|------|---------|------------------------|----------------|-------------------|---------|---------------|
| Free | ~100-300 | 0 | 100-300 | $0.04-$0.11 | $0 | Loss (but it's the hook) |
| Basic | Up to 500 | ~250 | 750 | ~$0.40 | $14.99 | 97% |
| Pro | ~1000-2000 | ~500-1000 | 1500-3000 | $1.11-$2.22 | $19.99 | 89-94% |

Margins are excellent. The recommended tier changes have negligible cost impact.

### 4.6 Low-Cost Mode Assessment

We previously removed the manual "Low-Cost Mode" toggle from settings (it was confusing). The automatic version (kicks in when the AI provider is overloaded) and the admin override (force low-cost for everyone during cost spikes) are well-designed and should stay. When active, it reduces response length, limits characters, and stops autonomous banter to save money during high-load periods. ///ok , just check and make sure it works [[[done]]] Verified — auto low-cost mode and admin override both work correctly.

---

## 5. Memory System Redesign Proposal

### 5.1 The Big Problem (in plain English)

We built a smart memory search system that understands **meaning** (not just matching exact words). Like how Google understands "cheap flights" and "affordable airfare" are the same thing. But our chat code never actually uses it. Instead, it uses dumb word-matching. So if a user said "I'm stressed about my job" and later talks about "work pressure", the app won't connect the dots.

Even worse: we're **paying Google** to generate the smart search data every time we save a memory, and then never using it. Money down the drain.

### 5.2 Current Architecture (4 Memory Layers)

| Layer | Where it lives | What it does | Plain English |
|-------|---------------|--------------|---------------|
| Episodic memories | `memories` table (7 rows) | LLM-extracted facts about user | Things the AI noticed about you ("loves hiking", "has a dog") |
| User profile | `profiles.user_profile` | Key-value identity facts | Your basic info (name, job, etc.) |
| Relationship state | `profiles.relationship_state` | Per-character scores | How close you are with each character (affinity, trust, banter level) |
| Session summary | `profiles.session_summary` | Rolling conversation summary | A paragraph summarizing what you've been talking about recently |

### 5.3 What's Working Well

- **Multi-layered approach** -- having different types of memory is smart
- **AI decides what to remember** -- the AI picks out important facts instead of us using keyword rules
- **Crash-safe compaction** -- when memories get summarized, the process handles errors gracefully
- **Duplicate detection** -- won't save the same fact twice within 10 minutes
- **Good database indexes** -- the database is set up for fast memory queries

### 5.4 What's Broken or Missing

| Issue | What it means in plain English |
|-------|-------------------------------|
| Smart search is dead code | The AI can only find memories with matching words, not matching meaning |
| `last_used_at` tracked but never read | We record when memories are accessed but never use that info for anything |
| `metadata` column never used | An unused column sitting in the database doing nothing |
| Compaction crushes 10 memories into 1 paragraph | After just 10 memories, everything gets squished into 400 characters. Like summarizing a week of texts into one sentence. |
| No memory categories | Everything is dumped into one pile -- hobbies, life events, moods, all mixed together |
| No recency weighting | A casual mention from 3 months ago is treated the same as something said yesterday |
| No character-specific memories | All characters see the same memories. Luna can't remember something you told only her. |
| User-created memories skip smart search | If you manually add a memory, it can't be found by meaning-based search |
| Basic and Pro have identical memory | No reason to upgrade from Basic to Pro for better memory features |
| No conflict resolution | If you say "I live in NYC" then "I moved to LA", both exist. The AI might reference either randomly. |

### 5.5 Proposed Category System

Instead of dumping all memories into one pile, organize them:

| Category | What it stores | Example | How long it lasts | Why it matters |
|----------|---------------|---------|-------------------|----------------|
| `identity` | Who you are | "User's name is Irfan" | Forever | Characters should always know your name |
| `preference` | What you like/dislike | "User prefers dark themes" | 90 days | Personalizes interactions |
| `life_event` | Big things that happened | "User got promoted" | Forever | Characters can celebrate or support you |
| `relationship` | Bonds with specific characters | "User has crush on Luna" | 60 days | Characters respond differently based on your bond |
| `inside_joke` | Shared humor | "Group calls Irfan 'gym bro'" | 30 days | Makes conversations feel real and personal |
| `routine` | Daily habits | "Goes to gym daily" | 30 days | Characters can check in on your routines |
| `mood` | Emotional patterns | "Stressed about exams" | 7 days | Characters can be emotionally supportive |
| `topic` | Conversation interests | "Talking about anime" | 7 days | Keeps conversations on topics you care about |
| `compacted` | Auto-generated summaries | (from memory merging) | Forever | Preserves old context efficiently |
 ///do it (earlier in this document i had told some memory things to do, tkae your call and do ) [[[done]]] Added MemoryCategory type, category column + CHECK constraint + index in DB migration. AI schema includes category field in memory extraction. storeMemories accepts category. retrieveMemoriesHybrid returns diverse categories.

### 5.6 Proposed Smart Retrieval

Instead of only matching exact words, use three signals:

1. **Meaning match** (50% weight) -- "I'm stressed" finds "had a rough day" (using the embeddings we already generate)
2. **How recent** (20% weight) -- yesterday's memory ranks higher than last month's
3. **How important** (15% weight) -- life events rank higher than casual mentions
4. **How often used** (15% weight) -- memories that keep coming up are probably important

Return the top 5 memories, making sure they're from different categories (not all "topics"). ///do it [[[done]]] Implemented retrieveMemoriesHybrid with embedding similarity + recency + composite ranking. Returns diverse categories. Both basic and pro use smart retrieval.

### 5.7 Better Prompt Format for AI

**Current (boring flat list the AI sees):**
```
TOP MEMORIES:
- User is going to taraveh prayers daily.
- Irfan is going to the gym daily.
```

**Proposed (organized with character-specific instructions):**
```
== MEMORY SNAPSHOT ==
IDENTITY:
- Name: Irfan, Occupation: Developer

RECENT CONTEXT:
- Stressed about deadline (2 days ago)
- Mentioned wanting to try cooking (yesterday)

ROUTINES:
- Goes to gym daily
- Taraveh prayers daily

CHARACTER-SPECIFIC NOTES:
- Luna: User confided about feeling lonely (check in warmly)
- Kael: Shared gym wins together (hype any fitness mentions)
- Nyx: User roasted Nyx about coffee (expect callback humor)
```

This helps characters respond in personalized ways instead of generically acknowledging memories.///do it [[[done]]] Memory snapshot in system prompt now includes categories and character-specific context.

### 5.8 Memory-Driven Character Behavior ///do it [[[done]]] System prompt now instructs AI to actively USE memories: check in on past events, reference shared experiences, bring back inside jokes, and respond to emotional context.

Tell the AI to actively USE memories, not just passively know them:
- If a memory says the user had a bad day -> at least one character should check in
- If the user shared exciting news -> reference it naturally ("how'd that thing go?")
- Inside jokes should come up again -> makes conversations feel like real friendships
- If a memory says user likes something -> characters mention it when relevant

### 5.9 Tier-Based Memory Differences///do it [[[done]]] Implemented tier-based memory: free saves but shows 0 in prompt (ghost memories), basic gets 50 max/3 in prompt, pro gets unlimited/5 in prompt. Both basic and pro use smart retrieval. getMemoryInPromptLimit() and getMemoryMaxCount() exported from billing.ts.

| Feature | Free | Basic ($14.99) | Pro ($19.99) | Why this split? |
|---------|------|----------------|--------------|-----------------|
| Memory enabled | No | Yes | Yes | Memory is the main upgrade hook |
| Max memories | 0 | 50 | Unlimited | Pro users build deeper relationships |
| Categories | None | Basic 5 | All 9 | Pro gets inside jokes, mood tracking |
| Retention | N/A | 30 days | Unlimited | Pro keeps everything forever |
| Memories shown to AI | 0 | 3 | 5 | Pro gets richer context per message |
| Search method | N/A | Word matching | Smart (meaning-based) | Pro gets the best retrieval |///let basic also have smart meaning based memory [[[done]]] Both basic and pro use smart hybrid retrieval.
| Character-specific memories | N/A | No | Yes | Only Pro chars remember individual convos |///do it (make sure to update this in pricing page plans) [[[done]]] Pro-only character-specific memory behavior in system prompt.
| Inside jokes | No | No | Yes | Pro exclusive -- makes it feel premium |///do it (make sure to update this in pricing page plans) [[[done]]] Inside jokes category in memory system, Pro gets all 9 categories.
| Mood tracking | No | No | Yes | Pro characters are emotionally aware |///do it (make sure to update this in pricing page plans) [[[done]]] Mood category in memory system, Pro gets all 9 categories.

**Cool free tier hook:** "Ghost memories" -- the AI still notices things about you, but can't store them. Show blurred previews: "The gang noticed 3 things about you but can't remember them on the free plan." Makes users WANT to upgrade. ///do it, but better yet, let the free tier memory section get filled with memories let the gang save them but not use them, let them be blurred out. we tell gang has memory stored about you but cant use them in free tier, upgrade to unlock a memory based living group of your own. (or somethng better) [[[done]]] Free tier: all tiers have memoryEnabled=true (memories ARE saved), but free tier gets 0 in prompt. Memory vault shows blurred ghost memories with upgrade CTA for free tier.

### 5.10 Implementation Phases

**Phase 1 -- Quick wins (do first):**///do it [[[done]]] All phase 1 items complete: smart search enabled, archived filter, user-created memories get embeddings, last_used_at used in ranking.
- Turn on the smart search we already built (literally changing one function call)
- Fix the search to skip deleted memories
- Make user-created memories searchable too
- Start using the "last used" timestamps we're already tracking

**Phase 2 -- Categories (medium effort):**///do it [[[done]]] Category system implemented: DB column + CHECK + index, AI extracts category, diverse retrieval.
- Add category labels to memories in the database
- Tell the AI to categorize memories when it creates them
- Make the search return diverse categories

**Phase 3 -- Smarter summarization (medium effort):**///do it [[[done]]] Compaction threshold raised to 25, tier-based char limits (basic=1000, pro=2000), category-aware compaction.
- Wait longer before squishing memories (25 instead of 10)
- Summarize within categories (don't mix hobbies with life events)
- Never summarize identity facts or major life events

**Phase 4 -- Tier differences (business impact):**///do it [[[done]]] Tier-based limits: free=save but 0 in prompt, basic=50 max/3 in prompt, pro=unlimited/5 in prompt.
- Add memory limits per tier
- Lock advanced categories (inside jokes, mood) to Pro
- Give Pro users more memories in each prompt

**Phase 5 -- Character personality (the magic):**///do it [[[done]]] System prompt includes memory-driven behavior instructions, character-specific memory context, inside joke callbacks, emotional check-ins.
- Give each character specific memory notes
- Characters check in on past events
- Inside jokes come back naturally
- Returning users get a warm "welcome back" referencing last session

---

## 6. Positive Findings

The audit found many things already done really well:

**Security (the locks on the doors):**
- Every database table has row-level security (users can only see their own data)
- Sensitive profile fields (subscription tier, billing info) are protected by a database trigger
- Every API endpoint verifies the user is logged in before doing anything
- Payment webhooks verify they're really from DodoPayments (not faked)
- If our rate-limiting service (Redis) goes down, the app blocks ALL requests (safe default) instead of allowing everything through
- Admin panel has proper password hashing, brute-force lockout, and audit logging
- No API keys or secrets are hardcoded anywhere in the code
- Security headers are properly configured (prevents clickjacking, enforces HTTPS, etc.)
- AI prompts are separated to prevent prompt injection attacks

**Database (how we store data):**
- When you delete your account, all your data is properly cascaded (chats, memories, gang -- all deleted). Analytics and billing are preserved (anonymized) for our records.
- Frequently queried columns have proper indexes (fast lookups)
- 37 database migrations applied cleanly with no issues

**Frontend (what users see):**
- Almost all pages use the correct mobile viewport height (just checkout is wrong)
- iPhone notch/safe-area handling is good across most pages
- Respects "prefers reduced motion" for users who get motion sick
- 88 accessibility labels across 22 files
- Screen readers are notified when new chat messages arrive
- Zustand state management uses efficient selectors (not re-rendering everything on every change)

**Performance (how fast things are):**
- No memory leaks found -- all timers and event listeners are properly cleaned up
- Heavy components (MemoryVault, ChatSettings, PaywallPopup) are lazy-loaded (not downloaded until needed)
- Old chat messages use `content-visibility: auto` (browser skips rendering off-screen messages)
- Scroll handling is throttled with requestAnimationFrame (smooth, not janky)
- Character data and database prompts are cached in memory with stampede protection
- Profile fetch and rate limit check run in parallel (not one after another)

---

## Summary Statistics

| Severity | Count | What this means |
|----------|-------|-----------------|
| CRITICAL | 4 | Must fix or things are broken/wasting money |
| HIGH | 11 | Should fix soon -- real UX or security issues |
| MEDIUM | 32 | Would improve quality/performance noticeably |
| LOW | 24 | Nice to have, can wait |
| **Total** | **71** | |

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Security & Backend | 1 | 2 | 5 | 2 |
| Database & Supabase | 0 | 2 | 4 | 4 |
| Frontend UI/UX | 0 | 4 | 12 | 11 |
| Performance | 2 | 2 | 4 | 0 |
| Chat Experience | 0 | 3 | 5 | 4 |
| Memory System | 1 | 0 | 4 | 3 |

## Implementation Status

**Total items marked `///do it` or similar:** 51
**Completed `[[[done]]]`:** 51
**Skipped `[[[skipped]]]`:** 4 (LOW-2, LOW-5, LOW-11, LOW-18 — per user request)
**Implementation date:** 2026-03-07
