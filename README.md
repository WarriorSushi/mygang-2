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
- A Supabase project
- Google Generative AI API key
- (Optional) OpenRouter API key for fallback

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key (optional)
ADMIN_PANEL_EMAIL=admin@example.com
ADMIN_PANEL_PASSWORD_HASH=sha256_hash_of_password
ADMIN_PANEL_SESSION_SECRET=random_secret_string
```

### Setup

```bash
npm install
npx supabase db push    # Apply database migrations
npm run dev             # Start development server
```

### Running Tests

```bash
npx playwright test     # Run all E2E tests
npm run test:admin      # Run admin-specific tests
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

Navigate to `/admin` and log in with the configured admin credentials. The admin panel provides user management, analytics overview, and runtime controls.
