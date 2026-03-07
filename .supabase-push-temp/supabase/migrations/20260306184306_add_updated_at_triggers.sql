CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_admin_runtime_settings_updated_at
  BEFORE UPDATE ON admin_runtime_settings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();;
