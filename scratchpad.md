# Scratchpad (Temporary)

- Purpose: short-lived notes only.
- Canonical execution plan: `scratchpad-decision-review.md`.
- Historical deep discussion was removed to keep this file lightweight.

## Admin Panel Draft (For Later Build)

### Access Model (Env-based, no hardcoding)
- `ADMIN_PANEL_EMAIL` in environment.
- `ADMIN_PANEL_PASSWORD` in environment.
- Optional stronger variant for production:
- `ADMIN_PANEL_PASSWORD_HASH` (bcrypt/argon2 hash) instead of plain text password.

### Core Powers You Can Exercise
- Real-time health:
- See 5xx/429/402 rates, provider cooldown state, and latest `chat_route_metrics`.
- See requests by source (`user`, `autonomous`, `autonomous_idle`) and current pressure.
- Cost and quota control:
- Force temporary global low-cost profile.
- Set output token caps and context window caps by mode.
- Pause autonomous turns globally during incidents.
- Provider controls:
- Enable/disable Gemini or OpenRouter quickly.
- Set provider priority and fallback policy.
- Manual cooldown override (clear/extend cooldown).
- User operations:
- Search user by email or id.
- View recent chat history summary and usage counters.
- Clear a user timeline safely (with audit log entry).
- Temporarily throttle a specific abusive account.
- Content/safety operations:
- View recent blocked prompts and soft/hard safety triggers.
- Add temporary moderation keyword rules (fast incident response).
- Turn memory updates off globally during abuse spikes.
- Analytics and experiments:
- Compare normal mode vs low-cost mode success rates.
- Track response latency, retries, and failure clusters.
- Enable/disable feature flags (auto low-cost, idle autonomy, continuation depth).
- Audit and compliance:
- Every admin action is written to `admin_audit_log` with actor, timestamp, action, payload diff.
- Read-only dashboards for metrics; write actions require re-auth.

### Practical Uses
- When 429 spikes:
- Force low-cost mode globally for 15-30 min.
- Reduce autonomous calls and max responders.
- Verify recovery in dashboard, then rollback.
- When OpenRouter credits run low:
- Disable OpenRouter fallback temporarily.
- Lower output caps and preserve user-first turns.
- When one user is abusing:
- Apply temporary per-user throttle.
- Keep service quality for everyone else.
- During launches:
- Watch live request source mix and latency.
- Tune thresholds without redeploying code.

### Benefits
- Faster incident response without code deploy.
- Lower token burn during stress windows.
- Better uptime and smoother user experience.
- Clear observability on "why failures happened".
- Safer operations through audit trails.

### Suggested Admin Pages
- `/admin/login`: Env-based admin auth.
- `/admin/overview`: Health, rates, provider states.
- `/admin/traffic`: User vs autonomous load charts.
- `/admin/cost`: Token/call budget controls and low-cost switches.
- `/admin/users`: User lookup + actions.
- `/admin/safety`: Moderation events + controls.
- `/admin/audit`: Admin action history.

### Security Notes (Important)
- Do not ship plain credentials in repo or code.
- Keep env values only in deployment secrets + local `.env.local`.
- Add rate limit + lockout on admin login.
- Use secure session cookie + CSRF protection for write actions.
- Restrict admin routes at middleware/server level (not client-only).

### Build Sequence (When We Start)
- Phase 1: Login + middleware protection + read-only overview.
- Phase 2: Cost controls + provider switches + feature flags.
- Phase 3: User operations + safety controls + audit log.
- Phase 4: polish dashboards + alerting + role-based admin users.
