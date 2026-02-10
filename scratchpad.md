# Scratchpad (Temporary)

## Admin Panel Plan (Working Notes)

### Access Model
- Env-based credentials only (no hardcoding).
- Login route: `/admin/login`
- Protected area starts at: `/admin/overview`

### Required Env Vars
- `ADMIN_PANEL_EMAIL`
- `ADMIN_PANEL_PASSWORD_HASH` (SHA-256 hex)

### Optional Hardening Env Vars
- `ADMIN_PANEL_SESSION_SECRET` (recommended custom signing secret)
- `ADMIN_PANEL_PASSWORD` (fallback only for local/dev; avoid in production)

### Powers You Can Exercise (Planned)
- Read live platform stats (users, chat volume, 24h activity, memory rows).
- Enable/disable low-cost behavior globally.
- Pause autonomous responses globally.
- Enable/disable provider fallback paths.
- Manage user-level moderation actions.
- View admin action audit log.

### Benefits
- Incident response without redeploy.
- Faster control over quota burn during spikes.
- Visibility into system behavior and usage.
- Clear auditability of admin actions.

### Build Phases
- Phase 1: Login + protected overview.
- Phase 2: Cost and provider controls.
- Phase 3: User actions + safety controls + audit logs.
