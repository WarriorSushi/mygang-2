# MyGang.ai

AI-powered group chat where you hang out with fictional characters who have distinct personalities, memories, and relationships.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL 17 + pgvector)
- **AI:** Google Gemini (primary) + OpenRouter (fallback)
- **State:** Zustand with localStorage persistence
- **UI:** Tailwind CSS v4 + shadcn/ui + Framer Motion
- **Auth:** Supabase Auth (Google OAuth + email/password)

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- A Supabase project
- Google Generative AI API key
- (Optional) OpenRouter API key for fallback

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the required values:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key
DODO_PAYMENTS_API_KEY=your_dodo_api_key
DODO_PAYMENTS_WEBHOOK_KEY=your_dodo_webhook_key
DODO_PRODUCT_BASIC=your_basic_product_id
DODO_PRODUCT_PRO=your_pro_product_id
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_RETURN_URL=http://localhost:3000/checkout/success
CRON_SECRET=your_long_random_cron_secret
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_PANEL_EMAIL=admin@example.com
ADMIN_PANEL_PASSWORD_HASH=salt_hex:derived_key_hex
ADMIN_PANEL_SESSION_SECRET=random_secret_string
```

`ADMIN_PANEL_PASSWORD_HASH` must be a PBKDF2 hash in `salt_hex:derived_key_hex` format. The runtime does not accept SHA-256, bcrypt, or plaintext admin passwords.

### Setup

```bash
pnpm install
pnpm run guard:supabase-authority # Confirm types are current, known drift is acknowledged, and linked diff is empty
supabase db push                  # Apply database migrations only after authority is green
pnpm dev                          # Start development server
```

If `pnpm run guard:supabase-authority` fails, stop and read `supabase/migrations/REMOTE_DRIFT_2026-03-25.md`. Do not repair remote history or push local migrations to a shared environment until the failure is understood.

### Running Tests

```bash
pnpm run test:fast         # Fast unit/integration smoke tests
pnpm run test:seeded       # Seeded Playwright release coverage
pnpm run test:admin        # Admin login coverage
pnpm run guard:data-integrity
pnpm run guard:supabase-linked-diff
pnpm run guard:supabase-authority
pnpm lint
pnpm build
```

## Project Structure

```
src/
├── app/           # Next.js App Router pages & API routes
│   ├── api/       # Chat API, analytics API
│   ├── admin/     # Admin panel (protected)
│   ├── auth/      # Auth callbacks & actions
│   ├── chat/      # Main chat interface
│   ├── onboarding/# User onboarding flow
│   └── settings/  # User settings
├── components/    # React components
│   ├── chat/      # Chat UI (messages, input, header)
│   ├── landing/   # Landing page
│   ├── onboarding/# Onboarding steps
│   ├── orchestrator/ # Auth, error boundary, perf
│   └── ui/        # shadcn/ui primitives
├── constants/     # Characters, greetings, wallpapers
├── lib/           # Utilities (AI, Supabase, admin, analytics)
└── stores/        # Zustand state management
```

## Admin Panel

Navigate to `/admin` and log in with the configured admin email plus the plaintext password whose PBKDF2 hash you stored in `ADMIN_PANEL_PASSWORD_HASH`. The admin panel provides user management, analytics overview, and runtime controls.

## Status Page

Visit `/status` for a read-only runtime diagnostics view. It reports:

- App version and commit SHA when available
- Whether `NEXT_PUBLIC_SITE_URL` is configured
- Supabase database reachability
- Upstash Redis configuration and ping health
- Config readiness for AI providers, Dodo Payments, admin auth, and CRON auth

The status page never exposes raw secrets. It is intended for deployment verification, not for mutating system state.
