CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_role text;
  can_manage_billing boolean;
  can_clear_purchase_celebration boolean;
BEGIN
  requester_role := COALESCE(
    (SELECT auth.role()),
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'role',
    current_setting('request.jwt.claim.role', true),
    session_user
  );

  can_manage_billing := requester_role IN ('service_role', 'supabase_admin', 'postgres');
  can_clear_purchase_celebration := COALESCE((SELECT auth.uid()) = NEW.id, false)
    AND OLD.purchase_celebration_pending IS NOT NULL
    AND NEW.purchase_celebration_pending IS NULL;

  IF NOT can_manage_billing THEN
    NEW.subscription_tier := OLD.subscription_tier;
    NEW.dodo_customer_id := OLD.dodo_customer_id;
    NEW.abuse_score := OLD.abuse_score;
    NEW.daily_msg_count := OLD.daily_msg_count;
    NEW.last_msg_reset := OLD.last_msg_reset;
    IF NOT can_clear_purchase_celebration THEN
      NEW.purchase_celebration_pending := OLD.purchase_celebration_pending;
    END IF;
    NEW.pending_squad_downgrade := OLD.pending_squad_downgrade;
    NEW.restored_members_pending := OLD.restored_members_pending;
  END IF;

  RETURN NEW;
END;
$$;
