# 1Milli Improvement Master Plan

**Generated:** 2026-03-17
**Source:** 6 parallel audits (Security, Frontend, Performance, Chat System, Code Quality, Feature Gaps)
**Branch:** `worktree-1milli-improve`

---

## 🔴 CRITICAL FIXES (Must Do Immediately)

| # | Item | Source | Files | Complexity | Description |
|---|------|--------|-------|------------|-------------|
| C1 | Revoke anon role privileges | SEC-C1 | Supabase DB | S | `anon` has ALL privileges (incl TRUNCATE) on all 13 tables. Revoke everything except SELECT on `characters`. |
| C2 | Block self-upgrade via profiles UPDATE | SEC-H2 | Supabase DB | S | Users can `UPDATE profiles SET subscription_tier='pro'` directly. Restrict UPDATE columns to safe fields only. |
| C3 | Revoke billing table writes from authenticated | SEC-H3 | Supabase DB | S | `authenticated` has INSERT/UPDATE/DELETE on `billing_events` and `subscriptions` — should be service-role only. |
| C4 | Self-harm detection must surface crisis resources | C4 | `src/app/api/chat/route.ts` | S | Soft-block patterns detect self-harm but unclear if crisis hotline numbers are shown to user. Liability risk. |

---

## 🟠 HIGH-IMPACT IMPROVEMENTS (Should Do)

### Security
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| H1 | Remove `unsafe-eval` from CSP | SEC-H1 | `next.config.ts:26` | M | Replace lottie-web with lottie-light build to eliminate need for `unsafe-eval`. |
| H2 | Add WITH CHECK to UPDATE policies | SEC-M3/M5 | Supabase DB | S | `chat_history` and `squad_tier_members` UPDATE policies allow row ownership transfer. |
| H3 | Mask email in webhook logs | SEC-M4 | `src/app/api/webhook/dodo-payments/route.ts:179` | S |
| H4 | Restrict CSP connect-src to specific Supabase project | SEC-L1 | `next.config.ts:26` | S |

### Chat System
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| H5 | Fix autonomous turns eating rate limit | CS-1 | `src/app/api/chat/route.ts:~859` | S | Use separate rate key for autonomous/idle sources. |
| H6 | Fix system prompt including filtered characters | CS-2 | `src/app/api/chat/route.ts:~1007` | S | Build system prompt from `tierFilteredIds` not `filteredIds`. |
| H7 | Fix route timeout not canceling persistence | CS-4 | `src/app/api/chat/route.ts:~1704` | M | Pass AbortSignal into handlePost, check before persistence. |
| H8 | Fix concurrent memory compaction race | CS-9 | `src/lib/ai/memory.ts:~618` | M | Use advisory lock or compaction-in-progress flag. |

### Frontend
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| H9 | Add focus trap to onboarding character modal | FE-1.1 | `src/components/onboarding/selection-step.tsx:27-121` | S |
| H10 | Fix hardcoded dark-mode colors in selection step | FE-1.2 | `src/components/onboarding/selection-step.tsx:268-273` | S |
| H11 | Add overflow-y-auto to paywall popup | FE-2.1 | `src/components/billing/paywall-popup.tsx:108` | S |
| H12 | Standardize modal border-radius | FE-5.1 | Multiple modal components | S |

### Features (Ship Blockers)
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| H13 | Fix squad limit hardcoded to 4 in onboarding | O3 | `src/components/onboarding/selection-step.tsx` | S | Should use tier's squad limit (4/5/6). |
| H14 | Remove/gate hardcoded "80% off launch week" badge | S3 | `src/components/settings/settings-panel.tsx` | S | Add expiry date or feature flag. |
| H15 | Verify & enforce paid feature gates (wallpapers, nicknames, vault) | T1/B2 | `src/components/chat/chat-settings.tsx` | M | Pricing page says free=no, but UI may not enforce. |
| H16 | Add conversion/checkout analytics events | A3 | `src/lib/analytics.ts`, checkout routes | M | Track pricing view, checkout start/complete, subscription change. |

---

## 🟡 MEDIUM IMPROVEMENTS (Could Do)

### Code Quality
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| M1 | Split monolithic chat store into domain slices | CQ-5.1 | `src/stores/chat-store.ts` | L | 30+ fields, 25+ setters. Split: chat, user, UI, billing stores. |
| M2 | Break up ChatPage (650 lines) | CQ-5.2 | `src/app/chat/page.tsx` | M | Extract screenshot, cooldown, celebration, resume banner. |
| M3 | Type `any` casts in memory.ts | CQ-2.1 | `src/lib/ai/memory.ts:125,296,655,700,778` | S | 5 instances with eslint-disable. Use proper DB types. |
| M4 | Create `src/types/shared.ts` | CQ-2.6 | New file | S | Centralize `TokenUsage`, `ChatEvent`, etc. |
| M5 | Extract duplicated utilities | CQ-3.1-3.3 | Multiple hooks | S | `pickRandom`, `normalizeSource`, `truncateText` → shared utils. |
| M6 | Extract shared AvatarLightbox component | CQ-3.4 | `message-item.tsx`, `chat-header.tsx` | S | Near-identical lightbox in 2 files. |
| M7 | Wrap MemoryVault & ChatSettings in ErrorBoundary | CQ-5.4 | `src/app/chat/page.tsx:565` | S |
| M8 | Remove window global mutation for cooldown timer | CQ-5.5 | `src/hooks/use-chat-api.ts:379` | S |
| M9 | Clean up lowCostMode vestigial state | CQ-5.6 | `src/stores/chat-store.ts` | S |

### Frontend
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| M10 | Cookie consent: add screen reader announcement | FE-1.3 | `src/components/ui/cookie-consent.tsx` | S |
| M11 | Chat header lightbox: add Tab focus trap | FE-1.5 | `src/components/chat/chat-header.tsx:525` | S |
| M12 | Memory vault: add loading indicator for edit/delete | FE-3.1 | `src/components/chat/memory-vault.tsx:165` | S |
| M13 | Landing carousel: prevent default on arrow keys | FE-1.4 | `src/components/landing/landing-page.tsx:772` | S |

### Chat System
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| M14 | Use stopwords filter in memory conflict resolution | CS-6 | `src/lib/ai/memory.ts:~99` | S |
| M15 | Clean up idle autonomous timer on unmount | CS-5 | `src/hooks/use-autonomous-flow.ts:~226` | S |
| M16 | Remove dead `isFirstMessage` from client payload | CS-14 | `src/hooks/use-chat-api.ts:~303` | S |

### Performance
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| M17 | Add `radix-ui` to optimizePackageImports | P-4 | `next.config.ts:8` | S |
| M18 | Audit if Geist Mono font is used; remove if not | P-3 | `src/app/layout.tsx:16` | S |
| M19 | Group zustand selectors with useShallow | P-6 | `chat-header.tsx`, `message-list.tsx` | S |
| M20 | Remove unused --sidebar-* CSS variables | P-14 | `src/app/globals.css` | S |

### Features
| # | Item | Source | Files | Complexity |
|---|------|--------|-------|------------|
| M21 | Resume onboarding after browser close | O2 | Onboarding components | M |
| M22 | Inline retry button for history sync failure | E2 | `src/components/chat/message-list.tsx` | S |
| M23 | Add message report/flag button | C3 | `src/components/chat/message-item.tsx` | S |
| M24 | Reword "priority response speed" or implement it | T2 | Pricing page | S |
| M25 | Change email/password in-app | S5 | Settings panel | M |

---

## 🟢 NICE-TO-HAVES (Future)

| # | Item | Source | Complexity |
|---|------|--------|------------|
| N1 | PWA install prompt UI | N4/P4 | S |
| N2 | In-app notification center | N2 | L |
| N3 | Social sharing cards | SO1 | M |
| N4 | Referral system | SO3 | M |
| N5 | Analytics dashboard in admin | A2 | L |
| N6 | Retention/engagement metrics | A4 | M |
| N7 | App shell caching for PWA offline | P3 | M |
| N8 | Offline message queue | B4 | M |
| N9 | FAQ aria-expanded fix | FE-1.6 | S |
| N10 | Render or remove AiDisclaimer component | FE-1.7 | S |
| N11 | Subtle dark mode border on AI bubbles | FE-5.3 | S |
| N12 | Dev preview pages gated behind NODE_ENV | CQ-1.8 | S |
| N13 | Remove unused exports (7 instances) | CQ-1.1-1.6 | S |
| N14 | Fix admin page `any` types | CQ-2.2 | M |
| N15 | Prompt injection mitigation (structured history) | CS-10 | L |
| N16 | Admin session fail-closed when Redis unavailable | SEC-M2 | S |

---

## Execution Order Recommendation

### Phase 1: Security Hotfixes (1-2 hours)
C1, C2, C3, H2, H3, H4 — All Supabase DB migrations + config changes

### Phase 2: Chat System Fixes (2-3 hours)
C4, H5, H6, H7, H8 — Rate limit fix, prompt fix, race conditions

### Phase 3: Frontend Quick Wins (1-2 hours)
H9, H10, H11, H12, M10, M11, M12, M13 — Focus traps, overflow, consistency

### Phase 4: Feature Gaps (2-3 hours)
H13, H14, H15, H16 — Squad limit, launch badge, tier gates, analytics

### Phase 5: Code Quality (3-4 hours)
M3-M9, M14-M20 — Type safety, dedup, dead code, performance tweaks

### Phase 6: Architecture (4-6 hours)
M1, M2 — Store split, ChatPage decomposition

### Phase 7: Product Features (ongoing)
N1-N16 — PWA, notifications, social, analytics dashboard

---

## Stats

| Category | Critical | High | Medium | Nice-to-have | Total |
|----------|----------|------|--------|--------------|-------|
| Security | 3 | 4 | 1 | 0 | 8 |
| Chat System | 1 | 4 | 3 | 1 | 9 |
| Frontend | 0 | 4 | 4 | 3 | 11 |
| Code Quality | 0 | 0 | 9 | 3 | 12 |
| Performance | 0 | 0 | 4 | 0 | 4 |
| Features | 0 | 4 | 5 | 9 | 18 |
| **Total** | **4** | **16** | **26** | **16** | **62** |
