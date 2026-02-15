# Deploy Checklist (MyGang.ai)

## Pre-Deploy
1. Run tests: `npx playwright test`
2. Apply Supabase migrations: `supabase db push`
3. Confirm `.env.local` keys exist locally and set same values in Vercel.

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
   - `ADMIN_PANEL_PASSWORD_HASH` - bcrypt hash of admin password (preferred) or `ADMIN_PANEL_PASSWORD` (plaintext, dev only)
   - `ADMIN_PANEL_SESSION_SECRET` - secret for signing admin session cookies
4. Production rate limiting (Upstash Redis):
   - `UPSTASH_REDIS_REST_URL` - Upstash Redis REST endpoint
   - `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token
   - Without these, rate limiting falls back to in-memory (not recommended for production/multi-instance)
5. Optional:
   - `USE_DB_CHARACTERS=true` (use DB prompt blocks instead of constants)
   - `NEXT_PUBLIC_MOCK_AI=false`
   - `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` - Google Search Console verification tag

## Supabase Configuration
1. Enable Email provider (Email + Password).
2. Configure redirect URLs:
   - `https://mygang.ai/auth/callback`
   - `http://localhost:3000/auth/callback`
3. Optional: Enable Google provider and add OAuth credentials.
4. **RLS Policies**: Ensure Row Level Security is enabled on all user-facing tables (chat history, user journeys, analytics, etc.). Verify policies are configured to restrict access to the authenticated user's own data. Run `supabase db push` to apply migration-defined policies.

## Next.js Proxy Convention
- This project uses Next.js API routes (`src/app/api/`) for backend endpoints. If upgrading to Next.js 16+, review the proxy/rewrite convention changes and ensure API routes and CSP `connect-src` directives are updated accordingly.
- The `next.config.ts` includes security headers and CSP. Update `connect-src` if adding new external API endpoints.

## Post-Deploy
1. Hit `/status` to verify health, version, and commit.
2. Test login (email/password + Google if enabled).
3. Test chat flow, Memory Vault, Settings, and delete account.
4. Confirm analytics inserts (`/api/analytics` returns `{ ok: true }`).
5. Check admin panel access at `/admin` with configured credentials.
