-- Chat Sangam fresh application database foundation.
-- This migration intentionally deletes existing Chat Sangam user accounts and app data.
-- Supabase-managed auth/storage schemas, service metadata, and migration history are preserved.

drop trigger if exists on_auth_user_created_chat_sangam on auth.users;

-- Explicitly erase all application user accounts. Cascading FKs clear their profile,
-- conversation, message, usage, and billing ownership records.
delete from auth.users;

drop function if exists public.process_chat_sangam_razorpay_payment(text, text, integer, text, text) cascade;
drop function if exists public.consume_chat_sangam_daily_credit() cascade;
drop function if exists public.get_chat_sangam_daily_usage() cascade;
drop function if exists private.handle_new_chat_sangam_user() cascade;

drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
drop table if exists public.profiles cascade;
drop table if exists public.billing_orders cascade;
drop table if exists public.subscriptions cascade;
drop table if exists private.usage_daily cascade;
drop table if exists private.billing_webhook_events cascade;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- User profile: plan is controlled only by trusted server-side billing logic.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chat history.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null default gen_random_uuid()::text,
  title text not null default 'New chat' check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);
create index conversations_user_updated_idx
  on public.conversations(user_id, updated_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null default gen_random_uuid()::text,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 120000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);
create index messages_conversation_created_idx
  on public.messages(conversation_id, created_at asc);
create index messages_user_created_idx
  on public.messages(user_id, created_at desc);

-- Server-only usage ledger.
create table private.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now())::date),
  chat_count integer not null default 0 check (chat_count >= 0),
  primary key (user_id, usage_date)
);

-- Server-only billing ledger and webhook idempotency.
create table public.billing_orders (
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
create index billing_orders_user_created_idx
  on public.billing_orders(user_id, created_at desc);

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null default 'inactive' check (status in ('active', 'inactive', 'cancelled', 'expired')),
  current_period_end timestamptz,
  last_payment_id text,
  updated_at timestamptz not null default now()
);

create table private.billing_webhook_events (
  event_id text primary key,
  processed_at timestamptz not null default now()
);

-- Lock down the exposed application tables first; then grant only required access.
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.billing_orders enable row level security;
alter table public.subscriptions enable row level security;
alter table private.usage_daily enable row level security;
alter table private.billing_webhook_events enable row level security;

revoke all on schema public from anon;
grant usage on schema public to authenticated, service_role;

revoke all on public.profiles, public.conversations, public.messages,
  public.billing_orders, public.subscriptions from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.conversations, public.messages to authenticated;
grant all privileges on public.profiles, public.conversations, public.messages,
  public.billing_orders, public.subscriptions to service_role;

revoke all on private.usage_daily, private.billing_webhook_events from public, anon, authenticated;
grant all privileges on private.usage_daily, private.billing_webhook_events to service_role;

drop policy if exists profile_select_own on public.profiles;
create policy profile_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists conversations_select_own on public.conversations;
create policy conversations_select_own on public.conversations
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists conversations_insert_own on public.conversations;
create policy conversations_insert_own on public.conversations
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists conversations_update_own on public.conversations;
create policy conversations_update_own on public.conversations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists conversations_delete_own on public.conversations;
create policy conversations_delete_own on public.conversations
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists messages_select_own on public.messages;
create policy messages_select_own on public.messages
  for select to authenticated using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
drop policy if exists messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
drop policy if exists messages_update_own on public.messages;
create policy messages_update_own on public.messages
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
drop policy if exists messages_delete_own on public.messages;
create policy messages_delete_own on public.messages
  for delete to authenticated using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

-- Create a profile automatically for every newly registered Auth user.
create function private.handle_new_chat_sangam_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_chat_sangam_user() from public, anon, authenticated;
create trigger on_auth_user_created_chat_sangam
  after insert on auth.users
  for each row execute function private.handle_new_chat_sangam_user();

-- Free: 5 AI requests/day. Active Pro: 20 AI requests/day.
-- No hardcoded owner UUID or hidden unlimited account.
create function public.consume_chat_sangam_daily_credit()
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

create function public.get_chat_sangam_daily_usage()
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

  select u.chat_count into v_used from private.usage_daily u
  where u.user_id = v_user_id and u.usage_date = v_day;

  return query select coalesce(v_used, 0), v_limit,
    ((v_day + 1)::timestamp at time zone 'UTC');
end;
$$;
revoke all on function public.get_chat_sangam_daily_usage() from public, anon;
grant execute on function public.get_chat_sangam_daily_usage() to authenticated;

-- Call this only from a server-side Razorpay webhook after signature verification.
create function public.process_chat_sangam_razorpay_payment(
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
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_order_id is null or p_payment_id is null or p_event_id is null
     or p_amount is null or p_currency is distinct from 'INR' then
    return false;
  end if;

  select * into v_order
  from public.billing_orders
  where razorpay_order_id = p_order_id
  for update;

  if not found then return false; end if;
  if v_order.amount_paise <> p_amount or v_order.currency <> p_currency then
    return false;
  end if;

  insert into private.billing_webhook_events(event_id)
  values (p_event_id)
  on conflict do nothing;
  if not found then return true; end if;

  if v_order.status = 'paid' then return true; end if;

  update public.billing_orders
  set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now()
  where id = v_order.id;

  select case
    when s.status = 'active' and s.current_period_end > now()
      then s.current_period_end
    else now()
  end
  into v_start
  from public.subscriptions s
  where s.user_id = v_order.user_id;

  v_start := coalesce(v_start, now());
  v_end := v_start + interval '30 days';

  insert into public.subscriptions(user_id, plan, status, current_period_end, last_payment_id, updated_at)
  values (v_order.user_id, 'pro', 'active', v_end, p_payment_id, now())
  on conflict (user_id) do update
  set plan = 'pro', status = 'active', current_period_end = v_end,
      last_payment_id = p_payment_id, updated_at = now();

  update public.profiles
  set plan = 'pro', updated_at = now()
  where id = v_order.user_id;

  return true;
end;
$$;
revoke all on function public.process_chat_sangam_razorpay_payment(text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.process_chat_sangam_razorpay_payment(text, text, integer, text, text)
  to service_role;

-- New public-schema objects must not become Data API-accessible by default.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

comment on table public.profiles is 'Chat Sangam user profile; plan is server-managed.';
comment on table public.conversations is 'User-owned Chat Sangam conversations protected by RLS.';
comment on table public.messages is 'User-owned messages; access requires ownership of the parent conversation.';
comment on table public.billing_orders is 'Server-managed Razorpay order ledger; no client access.';
comment on table public.subscriptions is 'Server-managed Chat Sangam entitlements; no client access.';
comment on table private.usage_daily is 'Private server-managed daily AI usage counters.';
comment on table private.billing_webhook_events is 'Private Razorpay webhook idempotency ledger.';
