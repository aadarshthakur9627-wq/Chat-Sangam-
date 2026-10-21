-- Chat Sangam billing, plan entitlements, and secure daily limits.
create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_order_id text not null unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  razorpay_payment_id text unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'cancelled', 'expired')),
  current_period_end timestamptz,
  last_payment_id text,
  updated_at timestamptz not null default now()
);

create table if not exists private.billing_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.billing_orders enable row level security;
alter table public.subscriptions enable row level security;
alter table private.billing_webhook_events enable row level security;
revoke all on public.billing_orders, public.subscriptions from public, anon, authenticated;
revoke all on private.billing_webhook_events from public, anon, authenticated;
grant all on public.billing_orders, public.subscriptions to service_role;
grant all on private.billing_webhook_events to service_role;

-- A signed Razorpay webhook calls this RPC through the server-only service role.
-- Duplicate webhook deliveries are idempotent and never extend the same payment twice.
create or replace function public.process_chat_sangam_razorpay_payment(
  p_order_id text,
  p_payment_id text,
  p_amount integer,
  p_currency text,
  p_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.billing_orders%rowtype;
  v_existing_event text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_order_id is null or p_payment_id is null or p_event_id is null
     or p_amount is null or p_currency <> 'INR' then
    return false;
  end if;

  select * into v_order from public.billing_orders
    where razorpay_order_id = p_order_id for update;
  if not found then return false; end if;
  if v_order.amount_paise <> p_amount or v_order.currency <> p_currency then
    return false;
  end if;

  insert into private.billing_webhook_events(event_id)
    values (p_event_id) on conflict do nothing;
  if not found then return true; end if;

  if v_order.status = 'paid' then return true; end if;

  update public.billing_orders
    set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now()
    where id = v_order.id;

  select case when s.status = 'active' and s.current_period_end > now()
              then s.current_period_end else now() end
    into v_start
    from public.subscriptions s where s.user_id = v_order.user_id;
  v_start := coalesce(v_start, now());
  v_end := v_start + interval '30 days';

  insert into public.subscriptions(user_id, plan, status, current_period_end, last_payment_id, updated_at)
    values (v_order.user_id, 'pro', 'active', v_end, p_payment_id, now())
    on conflict (user_id) do update
      set plan = 'pro', status = 'active', current_period_end = v_end,
          last_payment_id = p_payment_id, updated_at = now();

  update public.profiles set plan = 'pro', updated_at = now()
    where id = v_order.user_id;
  return true;
end;
$$;

revoke all on function public.process_chat_sangam_razorpay_payment(text, text, integer, text, text) from public, anon, authenticated;
grant execute on function public.process_chat_sangam_razorpay_payment(text, text, integer, text, text) to service_role;

create or replace function public.consume_chat_sangam_daily_credit()
returns table (allowed boolean, used integer, daily_limit integer)
language plpgsql security definer set search_path = ''
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
    where s.user_id = v_user_id and s.plan = 'pro'
      and s.status = 'active' and s.current_period_end > now()
  ) then v_limit := 20; end if;

  insert into private.usage_daily as u (user_id, usage_date, chat_count)
    values (v_user_id, v_day, 1)
    on conflict (user_id, usage_date) do update
      set chat_count = u.chat_count + 1
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
revoke all on function public.consume_chat_sangam_daily_credit() from public, anon;
grant execute on function public.consume_chat_sangam_daily_credit() to authenticated;

create or replace function public.get_chat_sangam_daily_usage()
returns table (used integer, daily_limit integer, resets_at timestamptz)
language plpgsql security definer set search_path = ''
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
    where s.user_id = v_user_id and s.plan = 'pro'
      and s.status = 'active' and s.current_period_end > now()
  ) then v_limit := 20; end if;

  select u.chat_count into v_used from private.usage_daily u
    where u.user_id = v_user_id and u.usage_date = v_day;

  return query select coalesce(v_used, 0), v_limit,
    ((v_day + 1)::timestamp at time zone 'UTC');
end;
$$;
revoke all on function public.get_chat_sangam_daily_usage() from public, anon;
grant execute on function public.get_chat_sangam_daily_usage() to authenticated;

comment on table public.billing_orders is 'Server-managed Razorpay order ledger; no direct client access.';
comment on table public.subscriptions is 'Server-managed Chat Sangam entitlements; Pro expires unless renewed by a verified payment.';
