# Codex Remediation Plan

## Phase status

### Phase 1: Billing integrity
- Completed: centralize plan metadata across pricing, settings, paywall, and banners
- Completed: activation contract + success-page polling
- Completed: celebration flag migration to tier strings
- Completed: reconciliation tooling (`scripts/reconcile-billing.mjs`, dry-run by default)

### Phase 2: Chat reliability
- Completed: render acknowledgement endpoint
- Completed: server/client turn persistence split
- Completed: farewell and style normalization

### Phase 3: UX
- Completed: onboarding intro/rename step
- Completed: mobile pricing mobile comparison remains side by side and scrollable
- Completed: paywall action wiring
- Completed: hydration mismatch fix for the shared pricing/landing background path

### Phase 4: Validation
- In progress: auth-first Playwright rewrite
- Completed: focused regression coverage for mobile pricing + hydration console checks
- Pending: production test-account validation
