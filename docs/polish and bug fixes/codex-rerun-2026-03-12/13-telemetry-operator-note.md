# Telemetry Operator Note

## Scope

This note defines the remediation telemetry added during the fix implementation pass.

## Event Payloads

### `history_bootstrap_resolved`
- `user_id`: authenticated user id when available
- `source_path`: `use-chat-history.bootstrap`
- `outcome`: `has_history`, `empty`, or `error`
- `remote_message_count`: count returned from the initial cloud history fetch
- `reconciled_message_count`: count after reconciling cloud history with any local tail
- `error_code`: included on failures
- `error_message`: included on failures

### `preferred_squad_fallback_used`
- `user_id`: authenticated user id
- `source_path`: `auth-manager` or `post-auth`
- `outcome`: `detected`
- `gang_size`: number of preferred-squad members used as the fallback source

### `squad_write_failed`
- `user_id`: authenticated user id when available
- `source_path`: one of `onboarding.finish`, `post-auth.local-squad`, `post-auth.fallback-repair`, `auth-manager.local-repair`, `auth-manager.fallback-repair`, `squad-reconcile.local`, `squad-reconcile.cloud`, `chat.downgrade.confirm`, `chat.downgrade.auto-remove`, or `upgrade-picker-modal`
- `outcome`: `error`
- `squad_size`: included when the failing operation was saving a full squad
- `removed_count`: included for downgrade flows
- `selected_count`: included for upgrade picker flows
- `new_tier`: included for upgrade picker flows
- `error_code`: structured error code when available
- `error_message`: surfaced error message

### `squad_tier_write_failed`
- `user_id`: authenticated user id when available
- `source_path`: `chat.downgrade.confirm`, `chat.downgrade.auto-remove`, or `upgrade-picker-modal`
- `outcome`: `error`
- `removed_count`: included for downgrade flows
- `selected_count`: included for upgrade picker flows
- `new_tier`: included for upgrade picker flows
- `error_code`: structured error code when available
- `error_message`: surfaced error message

### `post_auth_timeout_fallback`
- `user_id`: authenticated user id when available
- `source_path`: `post-auth`
- `outcome`: `retry_state`
- `error_code`: `timeout`
- `error_message`: `Post-auth resolution timed out.`

## Notes

- `history_bootstrap_resolved` is expected on successful authenticated chat restoration and on bootstrap failures.
- `preferred_squad_fallback_used` should be rare after the catalog parity repair; if it appears repeatedly, relational squad drift has likely returned.
- `squad_write_failed` and `squad_tier_write_failed` are client-side surfacing events. They should be paired with the user-visible error state shown in the same flow.
