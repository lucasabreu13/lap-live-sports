create table if not exists public.lap_live_source_cache (
  cache_key text primary key,
  payload jsonb not null,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source_status text not null default 'live',
  updated_at timestamptz not null default now()
);

create index if not exists lap_live_source_cache_expires_at_idx
  on public.lap_live_source_cache (expires_at);

create or replace function public.set_lap_live_source_cache_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lap_live_source_cache_updated_at on public.lap_live_source_cache;
create trigger trg_lap_live_source_cache_updated_at
before update on public.lap_live_source_cache
for each row execute function public.set_lap_live_source_cache_updated_at();

alter table public.lap_live_source_cache enable row level security;

grant select, insert, update, delete on public.lap_live_source_cache to service_role;
