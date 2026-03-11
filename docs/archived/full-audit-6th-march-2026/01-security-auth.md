# Security & Authentication Audit

## Authentication Flow

**Status: SOLID**

- Supabase Auth with OAuth (Google) and magic link
- Auth guard in `src/app/chat/page.tsx:172-176` — redirects unauthenticated users to `/`
- Squad guard in `src/app/chat/page.tsx:179-183` — redirects users without squads to `/post-auth`
- `AuthManager` component (`src/components/orchestrator/auth-manager.tsx`) handles session hydration
- Session state stored in Zustand with localStorage persistence

### Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | HIGH | **Admin panel uses custom auth** instead of Supabase Auth. Password hashing with bcrypt is correct, but session management uses localStorage `admin_auth_token` which could be stolen via XSS. Consider httpOnly cookies. | `src/app/admin/login/page.tsx` |
| 2 | HIGH | **Subscription tier stored in client-side Zustand store.** While the API route (`src/app/api/chat/route.ts`) re-verifies from DB, the paywall popup timing is controlled client-side and could theoretically be bypassed by modifying localStorage. | `src/stores/chat-store.ts` |
| 3 | MEDIUM | **No rate limiting middleware on API routes.** The chat API has internal cooldown logic, but no IP-based rate limiting to prevent abuse. Next.js doesn't provide built-in rate limiting. | `src/app/api/chat/route.ts` |
| 4 | MEDIUM | **Admin API routes** should verify the admin token server-side on every request, not just on the login page. | `src/app/admin/` |
| 5 | MEDIUM | **CORS not explicitly configured.** Next.js API routes default to same-origin, but explicit headers would be better. | `src/app/api/` |
| 6 | LOW | **No Content-Security-Policy header** configured. Would prevent XSS injection of external scripts. | `next.config.ts` |
| 7 | LOW | **OAuth redirect URL** should be pinned to production domain in Supabase dashboard, not just in env vars. | Configuration |

## XSS & Injection

**Status: GOOD**

- No `dangerouslySetInnerHTML` usage found anywhere
- React's JSX auto-escapes all user content
- Message content is rendered as plain text via `{message.content}` — no HTML parsing
- Prompt injection: The AI chat route includes system prompts that instruct the AI to stay in character; however, clever prompt injection via user messages could potentially break character

## Secrets Management

**Status: GOOD**

- `NEXT_PUBLIC_` prefixed vars are only Supabase URL and anon key (intended to be public)
- OpenAI API key, Supabase service role key, and admin credentials are server-only env vars
- `.env` is in `.gitignore`
- No hardcoded secrets found in codebase

## Supabase RLS

**Status: SOLID**

- Row Level Security policies found in migration files
- `profiles` table has RLS for user-only access to own data
- `chat_history` table has RLS policies for user-scoped read/write
- `ai_memories` table has RLS for user-only access
