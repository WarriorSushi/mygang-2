# Deploy Checklist (MyGang.ai)

## Pre-Deploy
1. Sync runtime truth into `.env.local` from `.env.example`, then mirror the same values into Vercel preview/production.
2. Verify migration parity before pushing anything:
   - `supabase migration list`
   - compare the result against `supabase/migrations/MIGRATION_AUTHORITY.md`
   - run `pnpm run guard:supabase-authority`
   - if authority fails, stop: do not run `supabase db push` and do not use `supabase migration repair` on the shared project until the failure is understood
3. Run the required green gates:
   - `pnpm run test:fast`
   - `pnpm lint`
   - `pnpm build`
   - `pnpm run guard:data-integrity`
4. When seeded test credentials and services are available, run `pnpm run test`.
5. Only after the checks above are green and `pnpm run guard:supabase-authority` is green, apply Supabase migrations with `supabase db push`.

## Vercel Setup
1. Import repo into Vercel.
2. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public key
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
   - `NEXT_PUBLIC_SITE_URL` (e.g., `https://mygang.ai`) - canonical site URL used for auth redirects, metadata, sitemap
   - `OPENROUTER_API_KEY` - fallback model provider
   - `GOOGLE_GENERATIVE_AI_API_KEY` - Gemini API key used by `@ai-sdk/google`
3. Admin panel variables:
   - `ADMIN_PANEL_EMAIL` - email address for admin login
   - `ADMIN_PANEL_PASSWORD_HASH` - PBKDF2 hash in `salt_hex:derived_key_hex` format
   - `ADMIN_PANEL_SESSION_SECRET` - secret for signing admin session cookies
4. Production rate limiting (Upstash Redis):
   - `UPSTASH_REDIS_REST_URL` - Upstash Redis REST endpoint
   - `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token
   - Without these, the app intentionally fails closed in production
5. Optional:
   - `USE_DB_CHARACTERS=true` (use DB prompt blocks instead of constants)
   - `NEXT_PUBLIC_MOCK_AI=false`
   - `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` - Google Search Console verification tag
   - `ADMIN_TEST_PASSWORD` - optional only for Playwright admin login coverage

## Supabase Configuration
1. Enable Email provider (Email + Password).
2. Configure redirect URLs:
   - `https://mygang.ai/auth/callback`
   - `http://localhost:3000/auth/callback`
3. Optional: Enable Google provider and add OAuth credentials.
4. **RLS Policies**: Ensure Row Level Security is enabled on all user-facing tables (chat history, user journeys, analytics, etc.). Verify policies are configured to restrict access to the authenticated user's own data. Run `supabase db push` to apply migration-defined policies.
5. If the linked project ever shows remote-only migration history beyond the acknowledged March 16-17, 2026 set, follow `supabase/migrations/REMOTE_DRIFT_2026-03-25.md` and reconcile with a new forward-only migration instead of rewriting history.

## Next.js Proxy Convention
- This project uses Next.js API routes (`src/app/api/`) for backend endpoints. If upgrading to Next.js 16+, review the proxy/rewrite convention changes and ensure API routes and CSP `connect-src` directives are updated accordingly.
- The `next.config.ts` includes security headers and CSP. Update `connect-src` if adding new external API endpoints.

## Post-Deploy
1. Open `/status` and verify:
   - version is correct
   - commit SHA is present when the platform provides it
   - Site URL, Supabase DB, Redis, admin auth, and CRON auth checks are all healthy
   - AI and billing config checks match the intended environment
2. Test login (email/password + Google if enabled).
3. Test chat flow, Memory Vault, Settings, and delete account.
4. Confirm analytics inserts (`/api/analytics` returns `{ ok: true }`).
5. Check admin panel access at `/admin` using the real admin password whose PBKDF2 hash is stored in `ADMIN_PANEL_PASSWORD_HASH`.
6. Exercise at least one Redis-backed rate-limited path in preview/production to confirm Upstash wiring.
7. Verify checkout, customer portal, webhook delivery, and the `/api/internal/wywa` cron path in the target environment.
