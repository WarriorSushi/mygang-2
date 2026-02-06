# Deploy Checklist (MyGang.ai)

## Pre-Deploy
1. Run tests: `npx playwright test`
2. Apply Supabase migrations: `supabase db push`
3. Confirm `.env.local` keys exist locally and set same values in Vercel.

## Vercel Setup
1. Import repo into Vercel.
2. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g., `https://mygang.ai`)
   - `OPENROUTER_API_KEY` (fallback model)
   - Gemini API key used by `@ai-sdk/google` (same key name you use locally)
3. Optional:
   - `USE_DB_CHARACTERS=true` (use DB prompt blocks)
   - `NEXT_PUBLIC_MOCK_AI=false`

## Supabase Auth
1. Enable Email provider (Magic Link).
2. Configure redirect URLs:
   - `https://your-domain.com/auth/callback`
   - `http://localhost:3000/auth/callback`
3. Optional: Enable Google provider and add OAuth credentials.

## Post-Deploy
1. Hit `/status` to verify health, version, and commit.
2. Test login (email magic link + Google if enabled).
3. Test chat flow, Memory Vault, Settings, and delete account.
4. Confirm analytics inserts (`/api/analytics` returns `{ ok: true }`).
