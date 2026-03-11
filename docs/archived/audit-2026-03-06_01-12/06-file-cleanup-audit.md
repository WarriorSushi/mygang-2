# File Cleanup Audit

**Date:** 2026-03-06
**Project:** MyGang.ai (C:\coding\mygangbyantig)

---

## Summary

| Category | Safe to Delete | Archive | Keep |
|----------|---------------|---------|------|
| Documentation | 0 | 19 | 5 |
| Source Files (unused) | 6 | 0 | 0 |
| Assets | 1 | 7 | all others |
| Config | 0 | 0 | all |
| Tests | 0 | 0 | all |
| **Total** | **7** | **26** | -- |

---

## 1. Documentation Files

### Root-level .md files

| File | Verdict | Reason |
|------|---------|--------|
| `README.md` | **KEEP** | Active project README. Minor issue: references `.env.local.example` but actual file is `.env.example`. |
| `DEPLOY_CHECKLIST.md` | **KEEP** | Current and accurate deployment guide. Still references relevant env vars and post-deploy steps. |
| `MONETIZATION_PROPOSAL.md` | **ARCHIVE** | Historical competitor research from 2026-02-17. Billing is now implemented via Dodo Payments (see `docs/introducing-billing/`). The proposal itself is superseded but has reference value. |

### docs/introducing-billing/

| File | Verdict | Reason |
|------|---------|--------|
| `01-BILLING-DESIGN.md` | **KEEP** | Active billing design doc. Status marked "Approved for implementation" and reflects current architecture. |
| `02-IMPLEMENTATION-PLAN.md` | **KEEP** | Active implementation task list for billing system. |

### docs/archive/ (top-level audit from 2026-02-16)

These are the original 5-agent audit from Feb 16. They were superseded by the deep-review on Feb 18, then superseded again by the AUDIT-PLAN.md on Mar 5.

| File | Verdict | Reason |
|------|---------|--------|
| `00-MASTER-AUDIT.md` | **ARCHIVE** | Superseded by deep-review-2026-02-18 and then by AUDIT-PLAN.md (2026-03-05). |
| `01-backend-api-security-audit.md` | **ARCHIVE** | Superseded. Findings largely addressed or re-audited. |
| `02-ai-chat-logic-audit.md` | **ARCHIVE** | Superseded. |
| `03-frontend-ui-ux-audit.md` | **ARCHIVE** | Superseded. |
| `04-database-migrations-audit.md` | **ARCHIVE** | Superseded. |
| `05-project-structure-config-audit.md` | **ARCHIVE** | Superseded. |
| `06-production-hardening-audit.md` | **ARCHIVE** | Superseded. |

### docs/archive/deep-review-2026-02-18_2359/

This is the 10-agent deep review from Feb 18. Also superseded by the latest AUDIT-PLAN.md (Mar 5).

| File | Verdict | Reason |
|------|---------|--------|
| `00-EXECUTIVE-SUMMARY.md` | **ARCHIVE** | Superseded by AUDIT-PLAN.md. |
| `01-chat-ui-ux-review.md` | **ARCHIVE** | Superseded. |
| `02-landing-onboarding-review.md` | **ARCHIVE** | Superseded. |
| `03-backend-security-review.md` | **ARCHIVE** | Superseded. |
| `04-state-hooks-dataflow-review.md` | **ARCHIVE** | Superseded. |
| `05-production-readiness-review.md` | **ARCHIVE** | Superseded. |
| `06-design-system-review.md` | **ARCHIVE** | Superseded. |
| `07-settings-admin-review.md` | **ARCHIVE** | Superseded. |
| `08-ai-integration-review.md` | **ARCHIVE** | Superseded. |
| `09-database-supabase-review.md` | **ARCHIVE** | Superseded. |
| `10-mobile-accessibility-review.md` | **ARCHIVE** | Superseded. |

### docs/archive/AUDIT-PLAN.md

| File | Verdict | Reason |
|------|---------|--------|
| `AUDIT-PLAN.md` | **KEEP** | Most recent audit (2026-03-05) with 47 actionable issues. Actively being worked through. |

**Recommendation:** The entire `docs/archive/` folder (18 files across two audit rounds) is already correctly in an archive folder. These files are historical. If you want to reduce clutter, the `deep-review-2026-02-18_2359/` and the `0X-*-audit.md` files could be deleted since their findings were rolled into the latest AUDIT-PLAN.md. But they are harmless where they are.

### design_docs/

| File | Verdict | Reason |
|------|---------|--------|
| `01_PRD.md` | **ARCHIVE** | Original product spec. Mentions "8 archetypes, pick 4" but app now has 14 characters and pick 2-4. Outdated but has historical value. |
| `02_ARCHITECTURE.md` | **ARCHIVE** | References "Next.js 15" (now 16), "Server Actions" (now API routes). Outdated but useful as design history. |
| `03_CHARACTERS.md` | **ARCHIVE** | Only describes 8 characters. App now has 14. Outdated. |
| `04_UI_COMPONENTS.md` | **ARCHIVE** | References "Aceternity UI" and patterns not used in final build. Outdated. |
| `05_PRODUCTION_CHECKLIST.md` | **ARCHIVE** | Mentions "Guest users" rate limiting which was removed. Superseded by DEPLOY_CHECKLIST.md. |

**Recommendation:** Move `design_docs/` into `docs/archive/design_docs/`. These are original design specs that are now outdated but useful as project history.

---

## 2. Unused Source Files

### Components not imported anywhere

| File | Verdict | Evidence |
|------|---------|----------|
| `src/components/ui/scroll-area.tsx` | **SAFE TO DELETE** | Only self-references. No imports from any other file. |
| `src/components/ui/badge.tsx` | **SAFE TO DELETE** | No `from.*ui/badge` imports found anywhere. |
| `src/components/ui/tabs.tsx` | **SAFE TO DELETE** | No `from.*ui/tabs` imports found anywhere. |
| `src/components/ui/label.tsx` | **SAFE TO DELETE** | No `from.*ui/label` imports found anywhere. |
| `src/components/ui/textarea.tsx` | **SAFE TO DELETE** | No `from.*ui/textarea` imports found anywhere. |
| `src/components/ui/card.tsx` | **SAFE TO DELETE** | No `from.*ui/card` imports found. Other files use "Card" in variable names but never import this shadcn component. |

These are all shadcn/ui primitives that were installed but never used in the actual application. Safe to remove -- they can be re-added with `pnpx shadcn@latest add <component>` if needed later.

### Source files that ARE used (verified)

The following were checked and confirmed to be imported/referenced:

- `src/proxy.ts` -- KEEP. This is the Next.js 16 middleware file (uses `proxy` export convention). Handles admin auth + Supabase session refresh.
- `src/components/holographic/glass-card.tsx` -- KEEP. Imported by `memory-vault.tsx`.
- `src/components/orchestrator/perf-monitor.tsx` -- KEEP. Imported by `layout.tsx`.
- `src/components/chat/inline-toast.tsx` -- KEEP. Imported by `chat/page.tsx`.
- `src/components/orchestrator/error-boundary.tsx` -- KEEP. Imported by `chat/page.tsx`.
- `src/components/orchestrator/auth-wall.tsx` -- KEEP. Imported by `landing-page.tsx`.
- `src/components/chat/memory-vault.tsx` -- KEEP. Imported by `chat/page.tsx`.
- `src/components/orchestrator/squad-reconcile.tsx` -- KEEP. Imported by `chat/page.tsx`.
- `src/components/orchestrator/auth-manager.tsx` -- KEEP. Imported by `layout.tsx`.
- `src/lib/analytics.ts` -- KEEP. Imported by 11 files.
- `src/lib/chat-utils.ts` -- KEEP. Imported by `route.ts` and `auth/actions.ts`.
- All hooks (`use-autonomous-flow`, `use-capacity-manager`, `use-typing-simulation`, `use-chat-history`, `use-chat-api`) -- KEEP. All imported by `chat/page.tsx`.

---

## 3. Assets

### public/ folder

| File | Verdict | Reason |
|------|---------|--------|
| `public/logo.webp` | **SAFE TO DELETE** | Not referenced anywhere in source code. `logo.png` is used instead. |
| `public/logo.png` | **KEEP** | Referenced by 6 source files (landing, page, about, terms, privacy, auth-wall). |
| `public/icon.png` | **KEEP** | Referenced in `layout.tsx`. |
| `public/icon-512.png` | **KEEP** | Referenced in `manifest.json`. |
| `public/favicon.ico` | **KEEP** | Standard browser favicon. |
| `public/manifest.json` | **KEEP** | PWA manifest, references icons. |
| `public/llms.txt` | **KEEP** | SEO/LLM metadata file describing the app. |
| `public/avatars/*.png` (14 files) | **KEEP** | All 14 avatars are referenced in `src/constants/characters.ts`. |

### screenshots/ folder

| File | Verdict | Reason |
|------|---------|--------|
| `screenshots/1_landing.png` | **ARCHIVE** | Not referenced in code or README. Generated by `visual-check.spec.ts` test. |
| `screenshots/2_onboarding_start.png` | **ARCHIVE** | Same -- test output. |
| `screenshots/3_onboarding_name.png` | **ARCHIVE** | Same. |
| `screenshots/4_onboarding_selection.png` | **ARCHIVE** | Same. |
| `screenshots/5_chat_initial.png` | **ARCHIVE** | Same. |
| `screenshots/6_chat_typing.png` | **ARCHIVE** | Same. |
| `screenshots/7_chat_complete.png` | **ARCHIVE** | Same. |

**Recommendation:** Add `screenshots/` to `.gitignore`. These are test artifacts generated by `tests/visual-check.spec.ts` and should not be tracked in git. They change with every UI update and inflate the repo.

---

## 4. Config Files

| File | Verdict | Reason |
|------|---------|--------|
| `next.config.ts` | **KEEP** | Active Next.js config with security headers. |
| `tsconfig.json` | **KEEP** | TypeScript config. |
| `eslint.config.mjs` | **KEEP** | ESLint config. |
| `postcss.config.mjs` | **KEEP** | PostCSS config for Tailwind. |
| `components.json` | **KEEP** | shadcn/ui config. |
| `supabase/config.toml` | **KEEP** | Supabase local dev config. |
| `.env.example` | **KEEP** | Environment template. |

### Supabase Migrations

All 15 migration files in `supabase/migrations/` are **KEEP**. Migrations are append-only by design and must not be deleted.

---

## 5. Test Files

| File | Verdict | Reason |
|------|---------|--------|
| `tests/admin-flow.spec.ts` | **KEEP** | Tests admin panel. |
| `tests/api-validation.spec.ts` | **KEEP** | Tests API input validation. |
| `tests/auth-error.spec.ts` | **KEEP** | Tests auth error page. |
| `tests/chat-flow.spec.ts` | **KEEP** | Tests chat flow. |
| `tests/visual-regression.spec.ts` | **KEEP** | Visual regression tests with snapshots. |
| `tests/api-contract.spec.ts` | **KEEP** | Tests API contracts. |
| `tests/landing-page.spec.ts` | **KEEP** | Tests landing page. |
| `tests/user-journey.spec.ts` | **KEEP** | Tests full user journey. |
| `tests/chat-scroll.spec.ts` | **KEEP** | Tests chat scroll behavior. |
| `tests/visual-check.spec.ts` | **KEEP** | Captures screenshots for manual review. Generates files into `screenshots/`. |
| `tests/visual-regression.spec.ts-snapshots/*.png` | **KEEP** | Baseline snapshots for visual regression tests. |

---

## Action Items (Quick Wins)

### Delete (7 files, ~0 risk)

```
src/components/ui/scroll-area.tsx
src/components/ui/badge.tsx
src/components/ui/tabs.tsx
src/components/ui/label.tsx
src/components/ui/textarea.tsx
src/components/ui/card.tsx
public/logo.webp
```

### Add to .gitignore

```
screenshots/
```

### Move to docs/archive/

```
design_docs/          -> docs/archive/design_docs/
MONETIZATION_PROPOSAL.md -> docs/archive/MONETIZATION_PROPOSAL.md
```

### Minor fix in README.md

Line 25 says `.env.local.example` but the actual file is `.env.example`.
