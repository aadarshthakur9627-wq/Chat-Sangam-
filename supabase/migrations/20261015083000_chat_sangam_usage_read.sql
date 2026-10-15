create or replace function public.get_chat_sangam_daily_usage()
returns table (used integer, daily_limit integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_limit integer := 20;
  v_used integer := 0;
  v_day date := timezone('utc', now())::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select p.plan into v_plan from public.profiles p where p.id = v_user_id;
  if v_plan = 'pro' then v_limit := 500; end if;

  select u.chat_count into v_used from private.usage_daily u
  where u.user_id = v_user_id and u.usage_date = v_day;

  return query select coalesce(v_used, 0), v_limit,
    ((v_day + 1)::timestamp at time zone 'UTC');
end;
$$;

revoke all on function public.get_chat_sangam_daily_usage() from public, anon;
grant execute on function public.get_chat_sangam_daily_usage() to authenticated;
comment on function public.get_chat_sangam_daily_usage() is 'Returns the authenticated user own daily Chat Sangam usage without exposing the private counter table.';
