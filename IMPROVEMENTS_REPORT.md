# MyGang.ai Improvement Report (Feb 6, 2026)

This report focuses on improvements that are high impact and low-to-moderate effort, aligned with your constraints: single low-cost model (Gemini/OpenRouter), no guest users, and minimal token usage. Items you asked to remove are removed.

---

**1. Essential Product Improvements (High ROI, Low Complexity)**

1. Persist user settings in Supabase: `chatMode`, theme, preferred squad. Status: Done. Notes: Synced `chat_mode`, `theme`, `preferred_squad`, and `chat_wallpaper` in `profiles`; added settings sync in `AuthManager`, `ChatSettings`, and `/settings`.
2. Add a server-side daily usage cap for free-tier users to control costs and set upgrade boundaries. Status: Done. Notes: Added daily reset logic and per-tier limits in `api/chat`; surfaced usage in `/settings`.
3. Add inline error toasts (e.g., "Rate limit hit, try again in a minute") so failures are visible without scrolling. Status: Done. Notes: Added `InlineToast` in chat page and wired errors to toast.
4. Add session-resumption messaging in chat to reduce confusion on returning users. Status: Done. Notes: Added welcome-back banner with time-gap detection.
5. Add a "memory active" indicator so users know the AI retains context. Status: Done. Notes: Added memory indicator in `ChatHeader` for authenticated sessions.

---

**2. UX Enhancements That Are Simple and High Impact**

1. Add a real-time selection counter at the bottom of the character grid with a short guideline (e.g., "Pick 4 to continue"). Status: Done. Notes: Selection step now shows live count and CTA.
2. Add character preview on hover (short voice line or sample reply) in the selection step. Status: Done. Notes: Added preview dialog and sample line.
3. Add a quick switch squad menu in chat settings to change squad without redoing onboarding. Status: Done. Notes: Added quick squad selector and cloud sync in `ChatSettings`.
4. Add message timestamp on hover and subtle grouping (like real chat) for readability. Status: Done. Notes: Added hover timestamp and improved grouping in `MessageItem`.
5. Add a small typing indicator count in the header so the user knows multiple characters are responding. Status: Done. Notes: Added typing count display in `ChatHeader`.

---

**3. Improvements to AI Request Strategy (Cost + Quality)**

1. Send only minimal context. Add server-side message compaction: keep the last N messages + a summary of older messages. Status: Done. Notes: Limited history to 16 items, added rolling session summary in profile.
2. Introduce a response planner step that decides which personas respond, then generate only those responses in one call. Status: Done. Notes: Added responder planner and post-filtering to enforce max responders.

---

**4. Cost Reduction Ideas (No Major Architecture Changes)**

1. Reduce memory and summarization calls by running them only every N turns (e.g., every 8-12 user messages) instead of every message. Status: Done. Notes: Summary update throttled by `summary_turns`.
2. Limit the number of responding characters based on mode and message complexity. Status: Done. Notes: Max responders enforced by chat mode and message length.
3. Turn off autonomous continuation when the user is inactive for more than a threshold. This prevents "AI chatting to itself." Status: Done. Notes: Inactivity gate disables auto-continue after 5 minutes.
4. Debounce chat requests by a short window (e.g., 600ms) to collapse rapid input into a single call. Status: Done. Notes: Debounced send in chat page.

---

**5. Efficiency and Performance Enhancements**

1. Cache persona prompt blocks server-side to avoid rebuilding prompt strings every request. Status: Done. Notes: Added cached prompt blocks and DB fallback.
2. Precompute and store persona prompt text in the database to reduce payload and simplify future editing. Status: Done. Notes: Added `prompt_block` column and backfill migration.
3. Reduce client re-renders by memoizing `MessageItem` or virtualizing the list when messages grow. Status: Done. Notes: `MessageItem` memoized and list stays stable.
4. Lazy-load character avatars in selection grid and chat header. Status: Done. Notes: Added `loading="lazy"` and `decoding="async"`.
5. Add a reduced motion mode for background effects on low-end devices. Status: Done. Notes: `BackgroundBlobs` respects reduced motion.

---

**6. Make the Chat More Realistic (Group Chat Feel)**

1. Add read receipts and subtle "Seen by X" tags for realism. Status: Done. Notes: Added read receipt tags per message.
2. Add emoji-only reactions from multiple personas to mimic group chats. Status: Done. Notes: Reaction events supported end-to-end.
3. Introduce persona-specific response delays to simulate real typing styles. Status: Done. Notes: Added `typingSpeed` per character.
4. Add light interruptions where characters reply to each other and quote messages occasionally. Status: Done. Notes: Prompt updated to allow interruptions and quoting.
5. Add contextual callbacks such as "Earlier you said..." when relevant. Status: Done. Notes: Prompt updated to allow callbacks.

---

**7. Character Selection UI Improvements**

1. Add filter chips by vibe (e.g., "Hype", "Logic", "Drama") to help users navigate quickly. Status: Done. Notes: Added tag filters and chip UX.
2. Add a compare panel that shows the 4 selected characters and a short summary of their dynamics. Status: Done. Notes: Added compare panel and dynamic summaries.
3. Add a preview play button that shows 1-2 example messages for each character. Status: Done. Notes: Added preview modal per character.
4. Add a random squad button that respects constraints (e.g., 1 supportive, 1 chaos). Status: Done. Notes: Added random squad button with constraints.

---

**8. Routing and Flow Enhancements**

1. Add a `/settings` page for account preferences and usage status. Status: Done. Notes: Added `/settings` with theme, chat mode, wallpaper, and usage stats.
2. Add a post-login reconciliation UI when local squad differs from cloud squad. Status: Done. Notes: Added `SquadReconcile` modal and conflict detection.
3. Add a welcome-back banner on `/chat` when returning after a long break. Status: Done. Notes: Added gap-based banner.

---

**9. Data and Analytics (Low Friction, High ROI)**

1. Track time-to-first-message and onboarding drop-offs. Status: Done. Notes: Added analytics events for onboarding start/completion and time-to-first-message.
2. Track daily sessions and messages per session for product feedback. Status: Done. Notes: Added session tracking and per-message events with session IDs.
3. Track auth wall conversions with a simple funnel event. Status: Done. Notes: Added auth wall shown/action/conversion events.

---

**10. Security and Abuse Protection (Essential)**

1. Add per-user abuse scoring to block spamming or malicious payloads. Status: Done. Notes: Added heuristic abuse scoring with decay and throttle.
2. Add content filters for unsafe content in the chat prompt (light moderation step). Status: Done. Notes: Added unsafe content detection and safety directives.
3. Enforce strict server-side limits: max message count, max input length, max response length. Status: Done. Notes: Enforced request bounds via schema and capped response length server-side.

---

**11. Testing and QA (High ROI)**

1. Add API contract tests that validate response schema for multiple valid inputs. Status: Done. Notes: Added contract tests using mock AI header.
2. Add a simple load test script for `/api/chat` with 5-10 concurrent users. Status: Done. Notes: Added `scripts/load-test-chat.mjs` and `npm run load:test`.
3. Add regression snapshots for landing and onboarding in CI. Status: Done. Notes: Added Playwright snapshot tests for landing and onboarding.

---

**12. Low-Effort UI Polish with Big Impact**

1. Add auto-scroll awareness indicator when the user is reading older messages. Status: Done. Notes: Added sticky jump-to-latest indicator.
2. Add chat wallpaper themes for personalization. Status: Done. Notes: Added wallpaper selector and background themes.
3. Add short onboarding tooltip in chat explaining Memory Vault and Settings. Status: Done. Notes: Added first-run tips banner in chat.

---

**13. Memory System (Genius + Low-Cost, Long-Lived Chat)**

Goal: make the group feel long-lived and evolving with minimal token/cost overhead.

Core idea: single-pass memory updates plus structured relationship state plus smart retrieval.

1. Single-pass updates (no extra model calls). Status: Done. Notes: Response schema now returns `memory_updates`, `relationship_updates`, and `session_summary_update`.
2. Two-tier memory model (profile facts + episodic memories). Status: Done. Notes: Added `user_profile` JSON and episodic memory tagging.
3. Relationship state per persona (the evolution layer). Status: Done. Notes: Added relationship state JSON with bounded deltas and notes.
4. Lightweight retrieval (no embeddings required). Status: Done. Notes: Added keyword/recency retrieval with optional embeddings.
5. Rolling summary (session memory). Status: Done. Notes: Added `session_summary` and update cadence every ~8 turns.
6. Prompt injection design (the AI is the brain). Status: Done. Notes: Added Memory Snapshot block with profile, memories, relationship board, summary.
7. Memory triggers (only store high-signal facts). Status: Done. Notes: Added gating via `shouldTriggerMemoryUpdate`.
8. User control (trust + UX). Status: Done. Notes: Added "Save to Memory" action and Memory Vault UI.

This design delivers long-lived, evolving relationships with minimal token cost because it uses structured updates inside the normal response plus cheap retrieval logic.
