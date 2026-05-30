-- InnerMirror — Supabase schema
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

-- Profiles (plan per user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  premium_until timestamptz,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Journal entries
create table if not exists public.entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  ts bigint not null,
  note text,
  img_thumb text,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists entries_user_ts_idx on public.entries (user_id, ts desc);

alter table public.entries enable row level security;

create policy "entries_select_own"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "entries_insert_own"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "entries_delete_own"
  on public.entries for delete
  using (auth.uid() = user_id);

-- Daily photo quota (written only by API service role)
create table if not exists public.daily_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  usage_date date not null,
  photo_count int not null default 0 check (photo_count >= 0),
  primary key (user_id, usage_date)
);

alter table public.daily_usage enable row level security;

create policy "daily_usage_select_own"
  on public.daily_usage for select
  using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, plan, timezone)
  values (new.id, 'free', 'UTC')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RPC: increment photo usage atomically (service role from API)
create or replace function public.increment_daily_photo_usage(
  p_user_id uuid,
  p_usage_date date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.daily_usage (user_id, usage_date, photo_count)
  values (p_user_id, p_usage_date, 1)
  on conflict (user_id, usage_date)
  do update set photo_count = daily_usage.photo_count + 1
  returning photo_count into new_count;
  return new_count;
end;
$$;

revoke all on function public.increment_daily_photo_usage(uuid, date) from public;
grant execute on function public.increment_daily_photo_usage(uuid, date) to service_role;
