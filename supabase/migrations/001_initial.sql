-- ─── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  created_at  timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Rooms ───────────────────────────────────────────────────────────────────
create table public.rooms (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  host_id         uuid references public.profiles(id),
  phase           text not null default 'lobby',
  round           int not null default 0,
  max_rounds      int not null default 0,
  dealer          int not null default 0,
  current_player  int not null default 0,
  trump_card      jsonb,
  trump_suit      text,
  current_trick   jsonb not null default '[]',
  last_trick_winner int,
  last_trick_cards  jsonb,
  log             jsonb not null default '[]',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── Room Players ─────────────────────────────────────────────────────────────
create table public.room_players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid references public.rooms(id) on delete cascade,
  user_id       uuid references public.profiles(id),
  player_index  int not null,
  is_ai         boolean not null default false,
  ai_name       text,
  hand          jsonb not null default '[]',
  bid           int,
  tricks_won    int not null default 0,
  score         int not null default 0,
  connected     boolean not null default true,
  unique(room_id, player_index)
);

-- ─── Round History ────────────────────────────────────────────────────────────
create table public.round_history (
  id        uuid primary key default gen_random_uuid(),
  room_id   uuid references public.rooms(id) on delete cascade,
  round     int not null,
  results   jsonb not null,
  created_at timestamptz default now()
);

-- ─── Game Stats ───────────────────────────────────────────────────────────────
create table public.game_stats (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid references public.rooms(id),
  user_id       uuid references public.profiles(id),
  placement     int not null,
  final_score   int not null,
  total_rounds  int not null,
  tricks_bid    int not null default 0,
  tricks_won    int not null default 0,
  played_at     timestamptz default now()
);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.round_history;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.rooms         enable row level security;
alter table public.room_players  enable row level security;
alter table public.round_history enable row level security;
alter table public.game_stats    enable row level security;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

create policy "rooms_select" on public.rooms for select using (auth.role() = 'authenticated');
create policy "rooms_insert" on public.rooms for insert with check (auth.role() = 'authenticated');
create policy "rooms_update" on public.rooms for update using (auth.role() = 'service_role');

create policy "rp_select" on public.room_players for select using (auth.role() = 'authenticated');
create policy "rp_insert" on public.room_players for insert with check (auth.role() = 'authenticated');
create policy "rp_update" on public.room_players for update using (auth.role() = 'service_role');

create policy "rh_select" on public.round_history for select using (auth.role() = 'authenticated');
create policy "gs_select" on public.game_stats for select using (auth.role() = 'authenticated');
create policy "gs_insert" on public.game_stats for insert with check (auth.role() = 'service_role');

-- ─── Stats View ───────────────────────────────────────────────────────────────
create view public.user_stats as
select
  p.id,
  p.username,
  count(gs.id)                                         as games_played,
  count(gs.id) filter (where gs.placement = 1)         as games_won,
  round(avg(gs.final_score))                           as avg_score,
  round(avg(gs.placement), 1)                          as avg_placement,
  coalesce(sum(gs.tricks_bid), 0)                      as total_bid,
  coalesce(sum(gs.tricks_won), 0)                      as total_won,
  round(100.0 * sum(gs.tricks_won) / nullif(sum(gs.tricks_bid),0), 1) as bid_accuracy_pct
from public.profiles p
left join public.game_stats gs on gs.user_id = p.id
group by p.id, p.username;

-- Add edition column (run this if table already exists)
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS edition text NOT NULL DEFAULT 'classic';
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS pending_rainbow7 jsonb;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS pending_rainbow7_buffer jsonb;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS pending_rainbow9 int;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS werewolf_suit text;

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS remaining_deck jsonb;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS vampire_revealed jsonb;
