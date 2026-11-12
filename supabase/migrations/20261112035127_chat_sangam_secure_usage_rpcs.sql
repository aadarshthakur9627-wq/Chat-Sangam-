-- Harden usage RPCs: keep privileged quota logic in the non-exposed private schema.
create or replace function private.consume_chat_sangam_daily_credit()
returns table (allowed boolean, used integer, daily_limit integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := 5;
  v_used integer;
  v_day date := timezone('utc', now())::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.subscriptions s
    where s.user_id = v_user_id
      and s.plan = 'pro'
      and s.status = 'active'
      and s.current_period_end > now()
  ) then
    v_limit := 20;
  end if;

  insert into private.usage_daily as u (user_id, usage_date, chat_count)
  values (v_user_id, v_day, 1)
  on conflict (user_id, usage_date)
  do update set chat_count = u.chat_count + 1
  where u.chat_count < v_limit
  returning chat_count into v_used;

  if v_used is null then
    select u.chat_count into v_used
    from private.usage_daily u
    where u.user_id = v_user_id and u.usage_date = v_day;
    return query select false, coalesce(v_used, 0), v_limit;
  else
    return query select true, v_used, v_limit;
  end if;
end;
$$;

create or replace function private.get_chat_sangam_daily_usage()
returns table (used integer, daily_limit integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := 5;
  v_used integer := 0;
  v_day date := timezone('utc', now())::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.subscriptions s
    where s.user_id = v_user_id
      and s.plan = 'pro'
      and s.status = 'active'
      and s.current_period_end > now()
  ) then
    v_limit := 20;
  end if;

  select u.chat_count into v_used
  from private.usage_daily u
  where u.user_id = v_user_id and u.usage_date = v_day;

  return query select coalesce(v_used, 0), v_limit,
    ((v_day + 1)::timestamp at time zone 'UTC');
end;
$$;

revoke all on function private.consume_chat_sangam_daily_credit() from public, anon;
revoke all on function private.get_chat_sangam_daily_usage() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.consume_chat_sangam_daily_credit() to authenticated;
grant execute on function private.get_chat_sangam_daily_usage() to authenticated;

-- Public RPC endpoints are invoker wrappers; privileged logic stays in private.
create or replace function public.consume_chat_sangam_daily_credit()
returns table (allowed boolean, used integer, daily_limit integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.consume_chat_sangam_daily_credit();
$$;

create or replace function public.get_chat_sangam_daily_usage()
returns table (used integer, daily_limit integer, resets_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_chat_sangam_daily_usage();
$$;

revoke all on function public.consume_chat_sangam_daily_credit() from public, anon;
revoke all on function public.get_chat_sangam_daily_usage() from public, anon;
grant execute on function public.consume_chat_sangam_daily_credit() to authenticated;
grant execute on function public.get_chat_sangam_daily_usage() to authenticated;

-- Explicit server-only policies document the intended service-role access model.
drop policy if exists billing_orders_service_all on public.billing_orders;
create policy billing_orders_service_all on public.billing_orders
  for all to service_role using (true) with check (true);
drop policy if exists subscriptions_service_all on public.subscriptions;
create policy subscriptions_service_all on public.subscriptions
  for all to service_role using (true) with check (true);
drop policy if exists usage_daily_service_all on private.usage_daily;
create policy usage_daily_service_all on private.usage_daily
  for all to service_role using (true) with check (true);
drop policy if exists billing_webhook_events_service_all on private.billing_webhook_events;
create policy billing_webhook_events_service_all on private.billing_webhook_events
  for all to service_role using (true) with check (true);
