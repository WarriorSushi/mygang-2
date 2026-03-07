CREATE OR REPLACE FUNCTION protect_sensitive_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.dodo_customer_id := OLD.dodo_customer_id;
    NEW.abuse_score := OLD.abuse_score;
    NEW.daily_msg_count := OLD.daily_msg_count;
    NEW.last_msg_reset := OLD.last_msg_reset;
    NEW.purchase_celebration_pending := OLD.purchase_celebration_pending;
    NEW.pending_squad_downgrade := OLD.pending_squad_downgrade;
    NEW.restored_members_pending := OLD.restored_members_pending;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER guard_sensitive_profile_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_sensitive_profile_columns();;
