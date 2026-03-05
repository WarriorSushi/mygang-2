# MyGang.ai -- Master Audit Report

**Date:** 2026-02-16
**Audited by:** Claude Opus 4.6 (5 parallel audit agents)
**Project:** Next.js 16 + Supabase + Gemini/OpenRouter AI chat with fictional characters

---

## Executive Summary

MyGang.ai is an AI-powered group chat app where users interact with fictional characters. The concept is compelling and the core experience works, but the codebase has significant issues across security, reliability, and maintainability that prevent it from feeling like a premium product.

**Key findings across 5 audit domains:**

| Domain | Critical | High | Medium | Low | Total |
|--------|----------|------|--------|-----|-------|
| Backend/API/Security | 3 | 7 | 8 | 7 | 25 |
| AI/Chat Logic | 2 | 5 | 7 | 5 | 19 |
| Frontend/UI/UX | 1 | 5 | 8 | 5 | 19 |
| Database/Migrations | 2 | 8 | 11 | 10 | 31 |
| Project Structure | 0 | 5 | 6 | 8 | 19 |
| **TOTAL** | **8** | **30** | **40** | **35** | **113** |

---

## Top 10 Critical & High Priority Fixes

These should be addressed immediately before any feature work:

### 1. Rename `src/proxy.ts` to `src/middleware.ts` (CRITICAL)
The admin panel has NO edge-level route protection. The proxy file exists but Next.js never loads it because it's not named `middleware.ts`. Anyone can navigate to admin pages.

### 2. Fix `deleteAllMessages()` -- it's a silent no-op (HIGH)
There's no RLS DELETE policy on `chat_history`. Users click "delete all" and nothing happens. The function returns success but deletes zero rows.

### 3. Remove `x-mock-ai` header bypass in production (HIGH)
Any unauthenticated user can send `x-mock-ai: true` to bypass ALL security checks (auth, rate limiting, content safety). This runs BEFORE any auth check.

### 4. Fix guest chat history RLS data leak (HIGH)
The `is_guest = TRUE` clause in RLS policies means ANY user can read ALL guest messages from ALL other users. This is a data exposure vulnerability.

### 5. Add Zod validation to all server actions (HIGH)
`updateUserSettings`, `saveUsername`, `saveGang`, `saveMemoryManual` all accept arbitrary input that goes directly to Supabase. TypeScript types are compile-time only -- runtime input is unvalidated.

### 6. Fix race conditions in profile updates (HIGH)
The chat API reads the profile at request start, makes an LLM call (2-15 seconds), then writes back the full row. Concurrent requests lose each other's updates on `daily_msg_count`, `abuse_score`, `session_summary`, etc.

### 7. Add vector index on `memories.embedding` (HIGH)
The `match_memories` function does full table scans with cosine distance. As data grows, this becomes unusable. Add an HNSW or IVFFlat index.

### 8. Break up the 1,434-line `chat/page.tsx` (CRITICAL for maintainability)
This monolithic component contains 30+ state hooks, API logic, autonomous flow control, history sync, analytics, and all JSX. Extract into 5-6 custom hooks.

### 9. Gate unauthenticated chat access (HIGH)
Unauthenticated users get full LLM access with only IP-based rate limiting (easily bypassed). This can cause significant API cost exposure.

### 10. Require Upstash Redis for production rate limiting (HIGH)
In-memory rate limiting doesn't work in serverless (Vercel). Each function instance has its own Map, making rate limits trivially bypassable.

---

## Making It Feel Premium -- UI/UX Recommendations

### Quick Wins (1-2 hours each)
1. **Add loading skeletons** for chat messages instead of spinners
2. **Add message timestamps** -- users lose context in long sessions
3. **Add a character counter** to chat input with max-length enforcement
4. **Delete unused public assets** (file.svg, globe.svg, next.svg, vercel.svg, window.svg)
5. **Add progress steps** to onboarding flow

### Medium Effort (half day each)
6. **Design an empty state** for new chat -- conversation starters, character intros
7. **Polish the chat input** -- focus glow, send animation, haptic-style feedback
8. **Widen character typing speed variance** (0.5-2.0 instead of 0.85-1.15) for personality
9. **Add `prefers-reduced-motion`** support for all animations
10. **Audit all colors** for WCAG AA contrast compliance

### Larger Effort (1-2 days each)
11. **Add message editing/deletion** for user messages
12. **Add read receipts** with character-specific reaction animations
13. **Implement proper keyboard navigation** for chat interactions
14. **Add a proper CSP header** to prevent XSS
15. **Design mobile-optimized chat settings** that doesn't conflict with browser chrome

---

## Making the Chat Feel Intuitive & Bug-Free

### Current Pain Points
1. **Autonomous messages run up costs** without user awareness (up to 30 silent turns)
2. **No visual feedback** when messages are truncated at 2000 chars
3. **Typing simulation isn't cancellable** -- unmount doesn't stop timers
4. **History sync is fragile** -- complex deduplication can lose or merge messages
5. **Greeting system can trigger multiple times** under race conditions
6. **No prompt injection protection** -- users can manipulate AI behavior

### Recommended Fixes
1. Reduce autonomous silent turn limit from 30 to 10
2. Add character count in chat input
3. Clean up timers on component unmount
4. Simplify history deduplication to exact ID matching only
5. Guard greeting triggers with a proper lock
6. Wrap user messages with delimiters in the system prompt

---

## Project Cleanup Actions

### Files to DELETE immediately
```
FULL_PROJECT_AUDIT_LOG.md    (418 lines, all items done)
IMPROVEMENTS_REPORT.md       (128 lines, all items done)
PRODUCTION_REVIEW.md         (197 lines, all issues fixed)
scratchpad.md                (36 lines, self-described temporary)
scratchpad-decision-review.md (253 lines, contains raw AI paste)
tasks to do.md               (525 lines, all tasks done)
public/file.svg              (unused default asset)
public/globe.svg             (unused default asset)
public/next.svg              (unused default asset)
public/vercel.svg            (unused default asset)
public/window.svg            (unused default asset)
```

### Files to REWRITE
- `README.md` -- Replace default template with actual project docs

### Files to UPDATE
- `DEPLOY_CHECKLIST.md` -- Add missing env vars
- `design_docs/02_ARCHITECTURE.md` -- Update to reflect current state
- `design_docs/01_PRD.md` -- Fix inaccuracies
- `design_docs/05_PRODUCTION_CHECKLIST.md` -- Check completed items or delete
- `src/app/robots.ts` -- Disallow `/admin/`

### Tests to FIX
- 6 of 8 test files hardcode `localhost:3000` instead of using Playwright's configured port 3201

---

## Database Health Checklist

- [ ] Add DELETE policy on `chat_history`
- [ ] Fix guest RLS bypass (`is_guest = TRUE` in policies)
- [ ] Add HNSW index on `memories.embedding`
- [ ] Consolidate duplicate `match_memories` migrations
- [ ] Add `updated_at` trigger on `profiles`
- [ ] Enable RLS on `characters` table with SELECT-only policy
- [ ] Add data retention jobs for `analytics_events` and old `chat_history`
- [ ] Cap memories per user (~500 max)
- [ ] Make gang member replacement atomic (RPC)
- [ ] Use atomic increments for `daily_msg_count` and `abuse_score`

---

## Security Hardening Checklist

- [ ] Rename `src/proxy.ts` to `src/middleware.ts`
- [ ] Remove `x-mock-ai` bypass (or gate behind `NODE_ENV`)
- [ ] Fix pass-the-hash in `verifyAdminCredentials`
- [ ] Migrate admin password from SHA-256 to bcrypt/Argon2
- [ ] Add Zod validation to all server actions
- [ ] Add Content-Security-Policy header
- [ ] Add rate limiting to analytics route
- [ ] Require Upstash Redis in production for rate limiting
- [ ] Remove session secret fallback to password hash/plaintext
- [ ] Add prompt injection guardrails for user messages

---

## Detailed Reports

For full findings with file paths and line numbers, see:
1. [Backend/API/Security Audit](./01-backend-api-security-audit.md)
2. [AI/Chat Logic Audit](./02-ai-chat-logic-audit.md)
3. [Frontend/UI/UX Audit](./03-frontend-ui-ux-audit.md)
4. [Database/Migrations Audit](./04-database-migrations-audit.md)
5. [Project Structure/Config Audit](./05-project-structure-config-audit.md)

---

*Generated by Claude Opus 4.6 -- 5 parallel audit agents analyzing every file in the codebase.*
