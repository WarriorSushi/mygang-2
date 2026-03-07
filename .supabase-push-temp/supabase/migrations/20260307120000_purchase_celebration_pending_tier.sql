alter table public.profiles
add column purchase_celebration_pending_next text;

update public.profiles
set purchase_celebration_pending_next = case
  when purchase_celebration_pending is true and subscription_tier in ('basic', 'pro') then subscription_tier
  else null
end;

alter table public.profiles
drop column purchase_celebration_pending;

alter table public.profiles
rename column purchase_celebration_pending_next to purchase_celebration_pending;

alter table public.profiles
add constraint profiles_purchase_celebration_pending_check
check (
  purchase_celebration_pending is null
  or purchase_celebration_pending in ('basic', 'pro')
);
