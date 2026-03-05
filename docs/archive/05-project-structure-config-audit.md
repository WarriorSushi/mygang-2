# Project Structure, Config & Documentation Audit Report

**Date:** 2026-02-16
**Auditor:** Claude Opus 4.6

---

## Files to DELETE (6 files, ~1,550 lines total)

| File | Rationale |
|------|-----------|
| `FULL_PROJECT_AUDIT_LOG.md` | 418-line historical log, all items marked done. No ongoing value. |
| `IMPROVEMENTS_REPORT.md` | 128-line status report, every item marked "Done". |
| `PRODUCTION_REVIEW.md` | 197-line review, every issue marked "Fixed". Duplicates `DEPLOY_CHECKLIST.md`. |
| `scratchpad.md` | 36-line temporary planning scratchpad. Self-described as "Temporary". |
| `scratchpad-decision-review.md` | 253-line decision review, all phases implemented. Contains raw pasted external content with broken formatting. |
| `tasks to do.md` | 525-line task log, every single task (21+) marked "Done". Filename has spaces. |

---

## HIGH Issues

### 1. README is a default `create-next-app` template

**File:** `README.md`

Contains zero project-specific information. Missing:
- Project description (what is MyGang.ai?)
- Required environment variables
- Supabase setup instructions
- Database migration instructions
- How to run tests
- Architecture overview
- Tech stack summary
- Admin panel setup

### 2. 6 of 8 test files hardcode wrong port

**Files:** `tests/api-contract.spec.ts`, `tests/api-validation.spec.ts`, `tests/auth-error.spec.ts`, `tests/chat-flow.spec.ts`, `tests/chat-scroll.spec.ts`, `tests/visual-check.spec.ts`

All hardcode `http://localhost:3000` instead of using `baseURL` from Playwright config (port 3201). Tests will fail when run via `npx playwright test`.

### 3. Design docs reference Next.js 15 when project uses 16

**Files:** `design_docs/01_PRD.md`, `design_docs/02_ARCHITECTURE.md`

### 4. Architecture doc database schema is severely outdated

**File:** `design_docs/02_ARCHITECTURE.md`

Does not reflect actual tables (`admin_runtime_settings`, `admin_audit_log`, `analytics_events`), additional columns on `profiles`, or folder structure changes.

### 5. `design_docs/05_PRODUCTION_CHECKLIST.md` shows all items unchecked

Every checkbox is unchecked despite most items being implemented. Gives false impression nothing is done.

---

## MEDIUM Issues

### 6. No CI/CD pipeline

Despite design docs listing "GitHub Actions to run build & lint before Vercel deploy", no `.github/workflows/` directory exists.

### 7. `DEPLOY_CHECKLIST.md` missing env vars

Does not mention `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ADMIN_PANEL_EMAIL`, `ADMIN_PANEL_PASSWORD_HASH`, or `ADMIN_PANEL_SESSION_SECRET`.

### 8. No unit tests -- 100% E2E

All tests are Playwright E2E. No tests for memory system, store logic, utility functions, or chat API orchestration.

### 9. Brittle CSS selector in chat-flow test

**File:** `tests/chat-flow.spec.ts` (line 63)

Uses `div[class*="flex flex-col"]` to find AI response. Any styling change breaks this. Should use `data-testid`.

### 10. Missing npm scripts

- No `test` script for full Playwright suite
- No `format`/`prettier` script
- No `typecheck` script (`tsc --noEmit`)

### 11. `/admin/` not disallowed in `robots.ts`

Admin panel should be hidden from crawlers.

### 12. Deprecated `interest-cohort=()` in Permissions-Policy

**File:** `next.config.ts` (line 10)

FLoC was replaced by Topics API. Modern browsers will warn.

---

## LOW Issues

### 13. `tsconfig.json` target ES2017 is conservative (non-issue in practice)
### 14. Inconsistent version pinning in `package.json`
### 15. No Prettier installed despite being referenced in design docs
### 16. `visual-check.spec.ts` is a utility, not a test
### 17. Excessive `console.log` in `chat-flow.spec.ts` (13 statements)
### 18. `src/proxy.ts` is non-standard naming
### 19. `design_docs/04_UI_COMPONENTS.md` references Aceternity UI (never used)
### 20. Unused default Next.js public assets (file.svg, globe.svg, next.svg, vercel.svg, window.svg)

---

## Files to UPDATE

| File | What to Change |
|------|---------------|
| `README.md` | Complete rewrite with project-specific documentation |
| `DEPLOY_CHECKLIST.md` | Add missing env vars (Upstash, admin panel) |
| `design_docs/02_ARCHITECTURE.md` | Update Next.js version, schema, folder structure |
| `design_docs/01_PRD.md` | Update Next.js version, auth wall behavior, memory model |
| `design_docs/05_PRODUCTION_CHECKLIST.md` | Update checkboxes or delete |
| `design_docs/04_UI_COMPONENTS.md` | Remove Aceternity UI references |
| `src/app/robots.ts` | Add `/admin/` to disallow list |

## Tests to FIX

Replace hardcoded `http://localhost:3000` with relative URLs or `baseURL` from Playwright config in all 6 affected test files.
