create extension if not exists pgcrypto;

create table if not exists public.lap_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sport_id text not null check (sport_id in (
    'futebol', 'futebol-americano', 'tenis', 'ciclismo', 'formula1', 'basquete', 'beisebol', 'softball',
    'volei', 'rugby', 'criquete', 'mma', 'golfe', 'natacao', 'atletismo', 'surfe'
  )),
  title text not null check (char_length(title) >= 8),
  summary text not null check (char_length(summary) >= 20),
  content text not null check (char_length(content) >= 80),
  source_name text,
  source_url text,
  cover_image_url text,
  author_name text not null default 'LAP',
  author_role text not null default 'Redação LAP',
  tags text[] not null default '{}',
  seo_title text,
  seo_description text,
  status text not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lap_articles add column if not exists author_name text not null default 'LAP';
alter table public.lap_articles add column if not exists author_role text not null default 'Redação LAP';
alter table public.lap_articles add column if not exists tags text[] not null default '{}';
alter table public.lap_articles add column if not exists seo_title text;
alter table public.lap_articles add column if not exists seo_description text;
alter table public.lap_articles add column if not exists scheduled_at timestamptz;


alter table public.lap_articles drop constraint if exists lap_articles_sport_id_check;
alter table public.lap_articles add constraint lap_articles_sport_id_check check (sport_id in (
  'futebol', 'futebol-americano', 'tenis', 'ciclismo', 'formula1', 'basquete', 'beisebol', 'softball',
  'volei', 'rugby', 'criquete', 'mma', 'golfe', 'natacao', 'atletismo', 'surfe'
));

alter table public.lap_articles drop constraint if exists lap_articles_status_check;
alter table public.lap_articles add constraint lap_articles_status_check check (status in ('draft', 'in_review', 'scheduled', 'published', 'archived'));
alter table public.lap_articles drop constraint if exists lap_articles_scheduled_check;
alter table public.lap_articles add constraint lap_articles_scheduled_check check ((status = 'scheduled' and scheduled_at is not null) or status <> 'scheduled');

create index if not exists lap_articles_published_idx on public.lap_articles (status, published_at desc);
create index if not exists lap_articles_scheduled_idx on public.lap_articles (status, scheduled_at asc) where status = 'scheduled';
create index if not exists lap_articles_sport_idx on public.lap_articles (sport_id, published_at desc);
create index if not exists lap_articles_tags_idx on public.lap_articles using gin (tags);

create table if not exists public.lap_article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.lap_articles(id) on delete cascade,
  action text not null check (action in ('created', 'updated', 'published', 'archived')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists lap_article_versions_article_idx on public.lap_article_versions(article_id, created_at desc);

create table if not exists public.lap_media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  alt_text text,
  credit text,
  created_at timestamptz not null default now()
);
create index if not exists lap_media_created_idx on public.lap_media(created_at desc);

create or replace function public.set_lap_articles_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lap_articles_set_updated_at on public.lap_articles;
create trigger lap_articles_set_updated_at
before update on public.lap_articles
for each row execute function public.set_lap_articles_updated_at();

alter table public.lap_articles enable row level security;
alter table public.lap_article_versions enable row level security;
alter table public.lap_media enable row level security;

-- Projetos Supabase novos podem exigir GRANT explicito para tabelas criadas em public
-- aparecerem na Data API. O portal usa apenas service_role no servidor Next.js; nao
-- conceda acesso a anon/authenticated enquanto a redacao nao usar Supabase Auth.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.lap_articles to service_role;
grant select, insert, update, delete on table public.lap_article_versions to service_role;
grant select, insert, update, delete on table public.lap_media to service_role;

-- O portal utiliza a service role apenas dentro do servidor Next.js. Não crie políticas públicas
-- de escrita e nunca exponha SUPABASE_SERVICE_ROLE_KEY em variáveis NEXT_PUBLIC_.
-- Quando usar Supabase Auth para a redação, adicione políticas por usuário e papel antes de
-- permitir acesso direto do navegador às tabelas.

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

grant select, insert, update, delete on table public.lap_push_subscriptions to service_role;
grant select, insert, update, delete on table public.lap_live_event_snapshots to service_role;
grant select, insert, update, delete on table public.lap_push_deliveries to service_role;

-- Endpoints Push são credenciais do navegador. Mantenha RLS ativo e não conceda
-- acesso anon/authenticated sem um modelo autenticado de dispositivos.
