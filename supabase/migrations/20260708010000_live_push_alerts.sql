create extension if not exists pgcrypto;

create table if not exists public.lap_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique check (char_length(device_id) between 12 and 128),
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) >= 20),
  auth text not null check (char_length(auth) >= 10),
  user_agent text,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  favorite_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(favorite_ids) = 'array'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists lap_push_subscriptions_enabled_idx
  on public.lap_push_subscriptions(enabled, updated_at desc)
  where enabled = true;
create index if not exists lap_push_subscriptions_favorites_idx
  on public.lap_push_subscriptions using gin (favorite_ids);

create table if not exists public.lap_live_event_snapshots (
  event_key text primary key,
  sport_id text not null,
  event_id text not null,
  state text not null,
  integrity text not null check (integrity in ('verified', 'reconciling')),
  status text,
  home_score text,
  away_score text,
  timeline_hash text,
  lineup_hash text,
  updated_at timestamptz not null default now()
);

create index if not exists lap_live_event_snapshots_updated_idx
  on public.lap_live_event_snapshots(updated_at desc);

create table if not exists public.lap_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.lap_push_subscriptions(id) on delete cascade,
  device_id text not null,
  event_key text not null,
  event_type text not null check (event_type in ('reminder_45', 'start', 'score', 'lineup', 'halftime', 'resume', 'final', 'test')),
  event_hash text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'expired')),
  error_message text,
  sent_at timestamptz not null default now(),
  unique (subscription_id, event_key, event_type, event_hash)
);

create index if not exists lap_push_deliveries_device_idx
  on public.lap_push_deliveries(device_id, sent_at desc);
create index if not exists lap_push_deliveries_event_idx
  on public.lap_push_deliveries(event_key, event_type, sent_at desc);

create or replace function public.set_lap_push_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lap_push_subscriptions_set_updated_at on public.lap_push_subscriptions;
create trigger lap_push_subscriptions_set_updated_at
before update on public.lap_push_subscriptions
for each row execute function public.set_lap_push_updated_at();

alter table public.lap_push_subscriptions enable row level security;
alter table public.lap_live_event_snapshots enable row level security;
alter table public.lap_push_deliveries enable row level security;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.lap_push_subscriptions to service_role;
grant select, insert, update, delete on table public.lap_live_event_snapshots to service_role;
grant select, insert, update, delete on table public.lap_push_deliveries to service_role;

-- Push endpoints are browser credentials. Keep RLS enabled and do not grant anon/authenticated
-- access unless a future authenticated device model is designed explicitly.
