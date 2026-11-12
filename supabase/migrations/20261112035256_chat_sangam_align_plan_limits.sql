-- Align server-enforced limits with the Chat Sangam UI and original product plan.
-- Free: 20 requests/day. Active Pro: 500 requests/day.
create or replace function private.consume_chat_sangam_daily_credit()
returns table (allowed boolean, used integer, daily_limit integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := 20;
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
    v_limit := 500;
  end if;

  insert into private.usage_daily as u (user_id, usage_date, chat_count)
  values (v_user_id, v_day, 1)
  on conflict (user_id, usage_date)
  do update set chat_count = u.chat_count + 1
  where u.chat_count < v_limit
  returning chat_count into v_used;

  if v_used is null then
    select u.chat_count into v_used from private.usage_daily u
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
  v_limit integer := 20;
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
    v_limit := 500;
  end if;

  select u.chat_count into v_used from private.usage_daily u
  where u.user_id = v_user_id and u.usage_date = v_day;

  return query select coalesce(v_used, 0), v_limit,
    ((v_day + 1)::timestamp at time zone 'UTC');
end;
$$;
