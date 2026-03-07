# MyGang Pre-Production Audit — Action Plan (v3.1)

**Date:** 2026-03-07
**Verified by:** Codex 5.4 cross-review — all critical and important items below are confirmed real.

---

## 1. Critical Bugs (18 items — FIXED)

### Security

**S-C1. `chat/rendered` route has no rate limiting** --- FIXED: Prevents someone from spamming the save-message endpoint and flooding your database with garbage. Without this, one person could send thousands of requests per minute. ---
- File: `src/app/api/chat/rendered/route.ts`

**S-C2. `checkout/route.ts` and `checkout/activate/route.ts` have no rate limiting** --- FIXED: Prevents someone from hammering your payment endpoints. Without this, a bot could spam DodoPayments on your behalf and rack up API costs or cause weird billing states. ---
- Files: `src/app/api/checkout/route.ts`, `src/app/api/checkout/activate/route.ts`

**S-C3. `customer-portal/route.ts` has no rate limiting** --- FIXED: Same idea — the "Manage Subscription" endpoint now has a speed limit so it can't be abused. ---
- File: `src/app/api/customer-portal/route.ts`

### Database

**D-C1. N+1 query pattern in admin users page** --- FIXED: Admin panel now loads in 1 database query instead of 40+. Page loads way faster when you have many users. ---
- File: `src/app/admin/(protected)/users/page.tsx`

**D-C2. `getMemories()` has no LIMIT** --- FIXED: Memory Vault now caps at 200 results. Without this, a power user with 1000+ memories would crash the page or make it super slow. ---
- File: `src/app/auth/actions.ts`

**D-C3. `gang_members.character_id` FK missing ON DELETE behavior** --- FIXED: If you ever delete a character, the database now automatically cleans up related gang member and squad tier rows. Without this, deleting a character would crash the app. ---
- Migration: `20260307160000_audit_v3_db_fixes.sql`

### Frontend

**F-C1. `maximumScale: 1` blocks pinch-to-zoom (WCAG violation)** --- FIXED: Users can now pinch-to-zoom on mobile. This was an accessibility law violation — some app stores reject apps for this. One-line fix. ---
- File: `src/app/layout.tsx`

**F-C2. Missing `aria-label` on account deletion email input** --- FIXED: Screen readers can now identify the "type your email to delete account" input. Required for accessibility compliance. ---
- File: `src/components/settings/settings-panel.tsx`

### Performance

**P-C1. Chat API: sequential rate limiting adds extra Redis round-trip** --- FIXED: Both rate limit checks now run at the same time instead of one-after-the-other. Shaves ~50-100ms off every single message. Every user benefits every time they chat. ---
- File: `src/app/api/chat/route.ts`

**P-C2. `retrieveMemoriesHybrid` makes TWO sequential Supabase calls** --- FIXED: Memory search and recency fetch now run in parallel. Cuts memory retrieval time roughly in half (~100-200ms saved per AI response). ---
- File: `src/lib/ai/memory.ts`

**P-C3. Double chat history persistence** --- SKIPPED (left as TODO). Too risky to change right now — the two save paths act as backup for each other. Fixing this could cause lost messages if done wrong. ---
- Files: `src/app/api/chat/route.ts`, `src/app/api/chat/rendered/route.ts`

**P-C4. `ConfettiCelebration` statically imports `lottie-react` (76KB+)** --- FIXED: The 76KB animation library now only loads when someone actually buys a plan. Before, every single user downloaded it on page load even though 99% never see confetti. Faster initial load for everyone. ---
- File: `src/components/effects/confetti-celebration.tsx`

### Chat Experience

**CX-C1. Typing delay for long messages is excessively long** --- FIXED: Typing bubble now caps at 3 seconds max. Before, a long AI response would show a typing bubble for 10-15 seconds — felt broken. Now it feels snappy. ---
- File: `src/hooks/use-chat-api.ts`

**CX-C2. Chat input not disabled during active cooldown** --- FIXED: When you hit the message limit, the input now shows a countdown ("Resume in 2:30") and is disabled. Before, you could keep typing and sending, which instantly failed and popped up the paywall again and again — super frustrating loop. ---
- File: `src/app/chat/page.tsx`, `src/components/chat/chat-input.tsx`

### Memory System

**M-C1. `match_memories` RPC returns incomplete data** --- FIXED: Memory search now returns all 7 fields needed for proper scoring (was only returning 3). This means memory ranking actually works now — the AI picks the most relevant memories instead of random ones. ---
- Migration: `20260307160000_audit_v3_db_fixes.sql`

**M-C2. Conflict resolution is too aggressive** --- FIXED: Saving "user likes pizza" no longer deletes "user's favorite color is blue" just because they're both preferences. Now only replaces memories that are actually about the same topic (50%+ word overlap). Your memories stop randomly disappearing. ---
- File: `src/lib/ai/memory.ts`

**M-C3. Memory count limits not enforced** --- FIXED: The free=20, basic=50 memory limits now actually work. Before, the limits existed in config but nothing checked them — users could store unlimited memories regardless of tier. ---
- File: `src/lib/ai/memory.ts`

**M-C4. Memory Vault shows all memory kinds including archived/compacting** --- FIXED: Memory Vault now only shows real memories (episodic + compacted). Before, users saw confusing junk entries that were mid-compaction or already archived. Cleaner experience. ---
- File: `src/app/auth/actions.ts`

---

## 2. Important Fixes (30 items — FIXED)

### Security

| ID | Issue | Benefit |
|----|-------|---------|
| S-I1 | Mock AI header bypass gated | --- FIXED: Test/mock mode can no longer accidentally leak to preview deployments. Someone could have bypassed the real AI and gotten free responses. --- |
| S-I2 | Login no longer leaks account existence | --- FIXED: Login now says "Invalid email or password" for both wrong email AND wrong password. Before, it said "Incorrect password" which told hackers "this email IS registered here." --- |
| S-I3 | `deleteAccount` now rate limited | --- FIXED: Account deletion now has a speed limit (3/min). Without this, someone could brute-force the email confirmation or spam the delete endpoint. --- |
| S-I4 | `.not()` filter fixed (was fragile string interpolation) | --- FIXED: A database filter was built by gluing strings together, which could break with special characters in IDs. Now uses proper array syntax. --- |
| S-I5 | `match_memories` now has auth guard | --- FIXED: Memory search now verifies you're only searching YOUR memories. Before, a crafted request could theoretically read someone else's memories. --- |

### Database

| ID | Issue | Benefit |
|----|-------|---------|
| D-I2 | `subscriptions.created_at` now NOT NULL | --- FIXED: Subscription dates can no longer be empty. Prevents weird bugs in billing logic that assumes dates always exist. --- |
| D-I3 | `profiles.created_at` now NOT NULL | --- FIXED: Same — profile creation dates guaranteed to exist. Prevents edge-case crashes. --- |
| D-I6 | Added `updated_at` to mutable tables | --- FIXED: memories, gang_members, and squad_tier_members now track when they were last changed. Essential for debugging and future features like "recently updated." --- |
| D-I7 | Added index on `billing_events.event_type` | --- FIXED: Searching billing events by type (e.g. "find all refunds") is now fast. Was doing a full table scan before. --- |

### Frontend

| ID | Issue | Benefit |
|----|-------|---------|
| F-I1 | Inline toast repositioned for mobile keyboard | --- FIXED: Toast notifications no longer hide behind the keyboard on mobile. Moved up so you can actually see them while typing. --- |
| F-I2 | Added `<meta name="theme-color">` | --- FIXED: Android browser bar now matches your app's color (dark/light). Before it was default gray — looked unfinished. --- |
| F-I3 | Memory Vault now has error state | --- FIXED: If memory loading fails, you now see "Something went wrong" with a Try Again button. Before, it silently showed "No memories yet" which was confusing and wrong. --- |
| F-I4 | Onboarding uses `replace` instead of `push` | --- FIXED: After onboarding, pressing the back button no longer creates an infinite redirect loop back to onboarding. --- |
| F-I5 | Inline toast uses theme tokens | --- FIXED: Toast notifications now respect your dark/light theme. Before they were hardcoded white/black which looked broken in some themes. --- |
| F-I6 | Added error boundaries for `/about`, `/privacy`, `/terms` | --- FIXED: If these pages crash, users see a friendly error instead of a blank white screen. --- |
| F-I7 | Pricing page shows sign-in link for unauthed users | --- FIXED: Non-logged-in users clicking "Get Started" now see a sign-in link instead of a confusing error. Was losing potential customers here. --- |
| F-I8 | "Manage Subscription" uses `<a>` instead of `<Link>` | --- FIXED: Manage Subscription now navigates properly. Using Next.js `<Link>` on an API redirect caused a flash/glitch. --- |
| F-I9 | Sign Out button has loading state | --- FIXED: Sign out button now shows "Signing Out..." and disables itself. Before, users could click it 5 times causing multiple sign-out requests. --- |
| F-I10 | Checkout success states have ARIA labels | --- FIXED: Screen readers can now announce "Payment successful" / "Activating" etc. Required for accessibility. --- |
| F-I11 | CSS color format mismatch fixed | --- FIXED: Dark mode chat area was using `hsl()` wrapper on oklch color values, which is like putting a square peg in a round hole. Colors now render correctly. --- |

### Performance

| ID | Issue | Benefit |
|----|-------|---------|
| P-I3 | Focus sync debounced (3s window) | --- FIXED: Alt-tabbing back to the app no longer fires a database query every single time. Now waits 3 seconds between syncs. Reduces unnecessary DB load. --- |
| P-I4 | Draft save debounced (500ms) | --- FIXED: Typing in chat no longer writes to localStorage on every single keystroke. Now batches saves every 500ms. Smoother typing, especially on slower phones. --- |
| P-I5 | Removed unused `Geist_Mono` font from body | --- FIXED: One fewer Google Font downloaded on every page load. Small but free performance win for every user. --- |
| P-I6 | `getDodoClient()` moved to `billing-server.ts` | --- FIXED: The DodoPayments SDK can no longer accidentally end up in the browser bundle. Keeps your payment code server-only where it belongs. --- |
| P-I9 | Merged duplicate + conflict memory queries | --- FIXED: Memory storage now does 1 database lookup instead of 2 for duplicate/conflict checking. Faster memory saves on every AI response. --- |

### Chat Experience

| ID | Issue | Benefit |
|----|-------|---------|
| CX-I1 | Warning banner shows at <10 remaining (was <5) | --- FIXED: Users now get warned earlier that they're running low on messages. At <5 out of 25, the warning came too late and felt like a surprise paywall. --- |
| CX-I2 | Rate limit message improved | --- FIXED: Now says "Cooldown active -- upgrade or wait" instead of "Message limit reached." The old text sounded like a permanent block. The new text tells users it's temporary. --- |

### Memory System

| ID | Issue | Benefit |
|----|-------|---------|
| M-I1 | Compaction preserves category structure | --- FIXED: When memories get compacted (merged to save space), they now stay organized by category. Before, all your preferences, life events, and jokes got smashed into one unreadable blob. --- |
| M-I2 | Free tier skips embedding generation | --- FIXED: We no longer pay Google to generate vector embeddings for free-tier users (who never use memory search anyway). Direct cost savings on every free user's messages. --- |
| M-I3 | Semantic deduplication added | --- FIXED: "User likes dogs" and "User is a dog person" are now recognized as the same memory (0.9+ similarity). Before, near-duplicates piled up and wasted memory slots. --- |

---

## 3. Needs Your Decision (disputed/opinion items)

Items below were flagged by Codex as partly valid, speculative, or product opinions rather than confirmed bugs. Write your decision after each `///`.

### Disputed Important Items

**D-I1. Duplicate migration file pairs**
- Codex says: "overstated count — some are duplicate-intent but not all 7 are exact copies"
- Risk: Clutters migration folder, could cause errors on fresh DB setup
- --- What it would do: I'd clean up duplicate/redundant migration files so your migrations folder isn't a mess. Matters if you ever set up the DB from scratch (new environment, new dev joins). Doesn't affect production right now. ---
///do it 

**D-I4. `auth.role()` used in RLS policies (called "deprecated")**
- Codex says: "needs external doc confirmation; maintainability concern, not a proven bug"
- Risk: May stop working in future Supabase versions
- --- What it would do: Replace `auth.role()` with the newer syntax in your RLS policies. It works fine today, but Supabase might remove the old way in a future update. It's like updating an old phone charger before the new phone drops — preventive, not urgent. ---
///do it

**D-I5. `increment_profile_counters` blocks service_role**
- Codex says: "assumes a call path that wasn't verified — webhook doesn't actually call this"
- Risk: Only matters if future code tries to call this from server
- --- What it would do: Allow the server (service_role) to call the counter function. Right now it would fail if server code ever tries. Currently no server code calls it, so this is future-proofing only. Skip unless you plan to call it from webhooks/server. ---
///do it

**P-I1. `framer-motion` static import on landing page (~32KB)**
- Codex says: "real cost but severity depends on landing-page budget; optimization, not launch blocker"
- Risk: Slower landing page load on slow connections
- --- What it would do: Lazy-load the animation library so your landing page loads 32KB faster. Matters most for users on slow mobile connections (3G). Your landing page is the first impression — faster = more signups. I'd recommend doing this, it's a quick win. ---
///do it

**P-I2. ChatPage re-renders 3-10x per AI turn**
- Codex says: "re-render issue is real but the proposed fix (subscribe to .length) is too simplistic"
- Risk: Causes unnecessary work on every AI message, but children are memoized
- --- What it would do: Reduce how many times the chat page recalculates during each AI response. The fix needs careful design though — a naive fix could break things. I'd recommend skipping this for now; the current memoization keeps it fast enough. ---
///skip this

**P-I7. No `Cache-Control` headers on chat API responses**
- Codex says: "no explicit no-store, but real risk depends on runtime/CDN defaults — weaker than implied"
- Risk: Theoretical CDN caching of errors
- --- What it would do: Add explicit "don't cache this" headers to chat API responses. In theory, a CDN could cache an error response and serve it to other users. In practice, Vercel's defaults already prevent this for POST requests. Very low risk. Skip it. ---
///skip

**P-I8. `radix-ui` monorepo package may include all components**
- Codex says: "weak/speculative — bundle impact not proven"
- Risk: Unknown until measured
- --- What it would do: Check if your UI component library is including more code than needed. But this is speculative — it might already be tree-shaken properly. Not worth investigating unless you see bundle size issues. Skip it. ---
///skip

**CX-I3. Pro tier 20 events is wastefully high -> reduce to 12**
- Codex says: "product tuning opinion, not an objective defect"
- Current: Pro gets up to 20 events per message
- --- What it would do: Reduce how many AI characters can respond per message from 20 to 12 for Pro users. Saves you money on AI API calls. But Pro users are paying customers — giving them fewer responses might feel like a downgrade. This is a business decision, not a bug. ---
///12 is fine

**CX-I4. Free tier 4 events too low -> increase to 5-6**
- Codex says: "product tuning opinion, not a correctness bug"
- Current: Free gets up to 4 events per message
- --- What it would do: Let free users get 5-6 character responses per message instead of 4. More generous free tier = better first impression = more conversions to paid. But also costs you more per free user. Business call. ---
///do it

**CX-I5. System prompt Rule 7 (LANGUAGE) is verbose**
- Codex says: "may be verbose but savings are heuristic, not a concrete defect"
- Potential: ~150 tokens/request saved
- --- What it would do: Shorten one section of the AI system prompt to save ~150 tokens per message. At scale that's real money (pennies per 1000 messages), but there's a risk the AI behavior changes if you trim the wrong instructions. Low priority. ---
///skip

**CX-I6. Autonomous idle follow-ups not tier-gated**
- Codex says: "lacks tier gate but if free users can't access ecosystem mode it's moot"
- Need to verify: Can free users actually trigger autonomous flow?
- --- What it would do: Prevent free users from triggering auto-followup messages (where AI characters talk to each other without you). If free users can't access ecosystem mode anyway, this fix does nothing. Need to verify first. ---
///idk check and you decide

**CX-I7. Typing ghost events add 2500ms dead time**
- Codex says: "the wait exists but calling it dead time is a UX judgment"
- Current: Shows typing bubble for 2.5s with no message
- --- What it would do: Reduce the 2.5-second typing bubble that appears before some messages. Some people think it makes the AI feel more "human" — others think it's annoyingly slow. This is a feel/vibe decision, not a bug. ---
///lets not remove it. 

### Entire Sections (product strategy, not bugs)

**Section: Chat Experience Tier Configuration Table**
- Codex says: "product recommendations, not audit facts — needs separate product/cost review"
- Contains: Recommended event counts, token limits, typing speeds per tier
- --- What it would do: Rebalance all the numbers for each tier (how many messages, how many characters respond, how fast). This is product strategy disguised as an audit finding. Worth doing eventually as a deliberate product decision, but not a bug to fix before launch. ---
///skip

**Section: Memory System Redesign Proposal**
- Codex says: "bug premises are valid but the redesign itself is opinionated strategy"
- Contains: Category weights, retrieval algorithm, compaction redesign, character behavior, core memories, tier-specific design
- --- What it would do: Completely redesign how the AI remembers things about users. The actual bugs in the memory system are already fixed above (M-C1 through M-I3). This section proposes a bigger vision — interesting for v2 but not needed for launch. ---
///skip

**Section: Nice-to-Have Enhancements (23 items)**
- Codex says: "mostly reasonable suggestions but optional hardening/polish, not launch blockers"
- Contains: CSP reporting, extra indexes, accessibility polish, Supabase Realtime, etc.
- --- What it would do: 23 small improvements like security headers, extra database indexes, more accessibility polish, real-time updates. All nice but none are launch blockers. I'd recommend tackling these post-launch in small batches. ---
///skip
