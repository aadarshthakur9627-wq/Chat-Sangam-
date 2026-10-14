create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null default gen_random_uuid()::text,
  title text not null default 'New chat' check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversations add column if not exists external_id text not null default gen_random_uuid()::text;
create unique index if not exists conversations_user_external_id_key on public.conversations(user_id, external_id);
create index if not exists conversations_user_updated_idx on public.conversations(user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null default gen_random_uuid()::text,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 120000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.messages
  add column if not exists external_id text not null default gen_random_uuid()::text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;
create unique index if not exists messages_user_external_id_key on public.messages(user_id, external_id);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at asc);
create index if not exists messages_user_created_idx on public.messages(user_id, created_at desc);

create table if not exists private.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('utc', now())::date),
  chat_count integer not null default 0 check (chat_count >= 0),
  primary key (user_id, usage_date)
);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;


revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profile_insert_own" on public.profiles;
drop policy if exists "profile_update_own" on public.profiles;

revoke all on public.conversations from anon, authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
drop policy if exists "conversations_select_own" on public.conversations;
create policy "conversations_select_own" on public.conversations for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "conversations_insert_own" on public.conversations;
create policy "conversations_insert_own" on public.conversations for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "conversations_update_own" on public.conversations;
create policy "conversations_update_own" on public.conversations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "conversations_delete_own" on public.conversations;
create policy "conversations_delete_own" on public.conversations for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.messages from anon, authenticated;
grant select, insert, update, delete on public.messages to authenticated;
drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own" on public.messages for select to authenticated using (
  (select auth.uid()) = user_id and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
  )
);
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
  )
);
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own" on public.messages for update to authenticated using (
  (select auth.uid()) = user_id and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
  )
) with check (
  (select auth.uid()) = user_id and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
  )
);
drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own" on public.messages for delete to authenticated using (
  (select auth.uid()) = user_id and exists (
    select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
  )
);

alter table private.usage_daily enable row level security;
revoke all on private.usage_daily from public, anon, authenticated;

create or replace function private.handle_new_chat_sangam_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_chat_sangam_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_chat_sangam on auth.users;
create trigger on_auth_user_created_chat_sangam after insert on auth.users
for each row execute function private.handle_new_chat_sangam_user();

create or replace function public.consume_chat_sangam_daily_credit()
returns table (allowed boolean, used integer, daily_limit integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan text := 'free';
  v_limit integer := 20;
  v_used integer;
  v_day date := timezone('utc', now())::date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  select p.plan into v_plan from public.profiles p where p.id = v_user_id;
  if v_plan = 'pro' then v_limit := 500; end if;

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

comment on table public.profiles is 'Chat Sangam user profiles; plan is server-controlled and not editable by clients.';
comment on table public.conversations is 'Private Chat Sangam conversations, isolated by user_id RLS.';
comment on table public.messages is 'Private Chat Sangam messages, isolated by owner and conversation RLS.';
comment on table private.usage_daily is 'Private server-managed daily Chat Sangam usage counters; inaccessible through the public Data API.';
