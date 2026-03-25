drop policy "Users can view their gang members" on "public"."gang_members";

drop policy "Users can view their own gang" on "public"."gangs";

drop policy "Users can update their chat history" on "public"."chat_history";

drop policy "Users can manage their gang members" on "public"."gang_members";

drop policy "Users can update own squad_tier_members" on "public"."squad_tier_members";

revoke delete on table "public"."admin_audit_log" from "anon";

revoke insert on table "public"."admin_audit_log" from "anon";

revoke references on table "public"."admin_audit_log" from "anon";

revoke select on table "public"."admin_audit_log" from "anon";

revoke trigger on table "public"."admin_audit_log" from "anon";

revoke truncate on table "public"."admin_audit_log" from "anon";

revoke update on table "public"."admin_audit_log" from "anon";

revoke delete on table "public"."admin_audit_log" from "authenticated";

revoke insert on table "public"."admin_audit_log" from "authenticated";

revoke references on table "public"."admin_audit_log" from "authenticated";

revoke select on table "public"."admin_audit_log" from "authenticated";

revoke trigger on table "public"."admin_audit_log" from "authenticated";

revoke truncate on table "public"."admin_audit_log" from "authenticated";

revoke update on table "public"."admin_audit_log" from "authenticated";

revoke delete on table "public"."admin_runtime_settings" from "anon";

revoke insert on table "public"."admin_runtime_settings" from "anon";

revoke references on table "public"."admin_runtime_settings" from "anon";

revoke select on table "public"."admin_runtime_settings" from "anon";

revoke trigger on table "public"."admin_runtime_settings" from "anon";

revoke truncate on table "public"."admin_runtime_settings" from "anon";

revoke update on table "public"."admin_runtime_settings" from "anon";

revoke delete on table "public"."admin_runtime_settings" from "authenticated";

revoke insert on table "public"."admin_runtime_settings" from "authenticated";

revoke references on table "public"."admin_runtime_settings" from "authenticated";

revoke select on table "public"."admin_runtime_settings" from "authenticated";

revoke trigger on table "public"."admin_runtime_settings" from "authenticated";

revoke truncate on table "public"."admin_runtime_settings" from "authenticated";

revoke update on table "public"."admin_runtime_settings" from "authenticated";

revoke delete on table "public"."analytics_events" from "anon";

revoke insert on table "public"."analytics_events" from "anon";

revoke references on table "public"."analytics_events" from "anon";

revoke select on table "public"."analytics_events" from "anon";

revoke trigger on table "public"."analytics_events" from "anon";

revoke truncate on table "public"."analytics_events" from "anon";

revoke update on table "public"."analytics_events" from "anon";

revoke truncate on table "public"."analytics_events" from "authenticated";

revoke delete on table "public"."billing_events" from "anon";

revoke insert on table "public"."billing_events" from "anon";

revoke references on table "public"."billing_events" from "anon";

revoke select on table "public"."billing_events" from "anon";

revoke trigger on table "public"."billing_events" from "anon";

revoke truncate on table "public"."billing_events" from "anon";

revoke update on table "public"."billing_events" from "anon";

revoke delete on table "public"."billing_events" from "authenticated";

revoke insert on table "public"."billing_events" from "authenticated";

revoke truncate on table "public"."billing_events" from "authenticated";

revoke update on table "public"."billing_events" from "authenticated";

revoke delete on table "public"."characters" from "anon";

revoke insert on table "public"."characters" from "anon";

revoke references on table "public"."characters" from "anon";

revoke trigger on table "public"."characters" from "anon";

revoke truncate on table "public"."characters" from "anon";

revoke update on table "public"."characters" from "anon";

revoke delete on table "public"."characters" from "authenticated";

revoke insert on table "public"."characters" from "authenticated";

revoke trigger on table "public"."characters" from "authenticated";

revoke truncate on table "public"."characters" from "authenticated";

revoke update on table "public"."characters" from "authenticated";

revoke delete on table "public"."chat_history" from "anon";

revoke insert on table "public"."chat_history" from "anon";

revoke references on table "public"."chat_history" from "anon";

revoke select on table "public"."chat_history" from "anon";

revoke trigger on table "public"."chat_history" from "anon";

revoke truncate on table "public"."chat_history" from "anon";

revoke update on table "public"."chat_history" from "anon";

revoke truncate on table "public"."chat_history" from "authenticated";

revoke delete on table "public"."gang_members" from "anon";

revoke insert on table "public"."gang_members" from "anon";

revoke references on table "public"."gang_members" from "anon";

revoke select on table "public"."gang_members" from "anon";

revoke trigger on table "public"."gang_members" from "anon";

revoke truncate on table "public"."gang_members" from "anon";

revoke update on table "public"."gang_members" from "anon";

revoke truncate on table "public"."gang_members" from "authenticated";

revoke delete on table "public"."gangs" from "anon";

revoke insert on table "public"."gangs" from "anon";

revoke references on table "public"."gangs" from "anon";

revoke select on table "public"."gangs" from "anon";

revoke trigger on table "public"."gangs" from "anon";

revoke truncate on table "public"."gangs" from "anon";

revoke update on table "public"."gangs" from "anon";

revoke truncate on table "public"."gangs" from "authenticated";

revoke delete on table "public"."memories" from "anon";

revoke insert on table "public"."memories" from "anon";

revoke references on table "public"."memories" from "anon";

revoke select on table "public"."memories" from "anon";

revoke trigger on table "public"."memories" from "anon";

revoke truncate on table "public"."memories" from "anon";

revoke update on table "public"."memories" from "anon";

revoke truncate on table "public"."memories" from "authenticated";

revoke delete on table "public"."profiles" from "anon";

revoke insert on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "anon";

revoke select on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke update on table "public"."profiles" from "anon";

revoke delete on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke update on table "public"."profiles" from "authenticated";

revoke delete on table "public"."push_subscriptions" from "anon";

revoke insert on table "public"."push_subscriptions" from "anon";

revoke references on table "public"."push_subscriptions" from "anon";

revoke select on table "public"."push_subscriptions" from "anon";

revoke trigger on table "public"."push_subscriptions" from "anon";

revoke truncate on table "public"."push_subscriptions" from "anon";

revoke update on table "public"."push_subscriptions" from "anon";

revoke delete on table "public"."squad_tier_members" from "anon";

revoke insert on table "public"."squad_tier_members" from "anon";

revoke references on table "public"."squad_tier_members" from "anon";

revoke select on table "public"."squad_tier_members" from "anon";

revoke trigger on table "public"."squad_tier_members" from "anon";

revoke truncate on table "public"."squad_tier_members" from "anon";

revoke update on table "public"."squad_tier_members" from "anon";

revoke delete on table "public"."subscriptions" from "anon";

revoke insert on table "public"."subscriptions" from "anon";

revoke references on table "public"."subscriptions" from "anon";

revoke select on table "public"."subscriptions" from "anon";

revoke trigger on table "public"."subscriptions" from "anon";

revoke truncate on table "public"."subscriptions" from "anon";

revoke update on table "public"."subscriptions" from "anon";

revoke delete on table "public"."subscriptions" from "authenticated";

revoke insert on table "public"."subscriptions" from "authenticated";

revoke truncate on table "public"."subscriptions" from "authenticated";

revoke update on table "public"."subscriptions" from "authenticated";

alter table "public"."subscriptions" drop constraint "subscriptions_status_check";

alter table "public"."subscriptions" add constraint "subscriptions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text, 'cancelled_pending'::text, 'refunded'::text, 'disputed'::text]))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_status_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(LEFT(NEW.raw_user_meta_data->>'username', 100), NULL)
  );
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  RETURN NEW;
WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_profile_counters(p_user_id uuid, p_daily_msg_increment integer DEFAULT 0, p_abuse_score_increment numeric DEFAULT 0, p_session_summary text DEFAULT NULL::text, p_summary_turns integer DEFAULT NULL::integer, p_user_profile jsonb DEFAULT NULL::jsonb, p_relationship_state jsonb DEFAULT NULL::jsonb, p_last_active_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(daily_msg_count integer, last_msg_reset timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_daily_msg_count INT;
  v_last_msg_reset TIMESTAMPTZ;
  _role text;
BEGIN
  _role := coalesce(current_setting('request.jwt.claim.role', true), '');
  IF _role NOT IN ('service_role', 'supabase_admin') THEN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Access denied: cannot update another user''s counters';
    END IF;
  END IF;

  SELECT p.daily_msg_count, p.last_msg_reset
    INTO v_daily_msg_count, v_last_msg_reset
    FROM profiles p
   WHERE p.id = p_user_id
     FOR UPDATE;

  IF v_last_msg_reset IS NULL OR (now() - v_last_msg_reset) > interval '24 hours' THEN
    v_daily_msg_count := 0;
    v_last_msg_reset := now();
  END IF;

  v_daily_msg_count := LEAST(10000, GREATEST(0, COALESCE(v_daily_msg_count, 0) + p_daily_msg_increment));

  UPDATE profiles SET
    daily_msg_count = v_daily_msg_count,
    last_msg_reset = v_last_msg_reset,
    abuse_score = LEAST(1000, GREATEST(0, COALESCE(abuse_score, 0) + p_abuse_score_increment)),
    session_summary = COALESCE(p_session_summary, session_summary),
    summary_turns = COALESCE(p_summary_turns, summary_turns),
    user_profile = COALESCE(p_user_profile, user_profile),
    -- M1 FIX: Merge relationship_state instead of full replace
    relationship_state = CASE
      WHEN p_relationship_state IS NOT NULL AND relationship_state IS NOT NULL
        THEN relationship_state || p_relationship_state
      ELSE COALESCE(p_relationship_state, relationship_state)
    END,
    last_active_at = COALESCE(p_last_active_at, last_active_at)
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_daily_msg_count, v_last_msg_reset;
END;
$function$
;


  create policy "Users can insert own gangs"
  on "public"."gangs"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can insert own memories"
  on "public"."memories"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can update their chat history"
  on "public"."chat_history"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "Users can manage their gang members"
  on "public"."gang_members"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.gangs
  WHERE ((gangs.id = gang_members.gang_id) AND (gangs.user_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM public.gangs
  WHERE ((gangs.id = gang_members.gang_id) AND (gangs.user_id = auth.uid())))));



  create policy "Users can update own squad_tier_members"
  on "public"."squad_tier_members"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



