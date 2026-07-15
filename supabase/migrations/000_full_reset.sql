-- ════════════════════════════════════════════════════════════════
-- 000_full_reset.sql — Wizard Game: kompletter Neuaufbau
--
-- ACHTUNG: Dieses Skript LÖSCHT alle bestehenden Spieldaten
-- (Räume, Spieler, Chat, Statistiken). Im Supabase SQL Editor
-- als Ganzes ausführen. Ersetzt 001/002/003 vollständig — bei
-- einem Neuaufbau NUR diese eine Datei ausführen.
-- ════════════════════════════════════════════════════════════════

-- ─── 0) Alles Bestehende entfernen ─────────────────────────────────
drop view if exists public.user_stats cascade;
drop view if exists public.room_players_view cascade;
drop function if exists public.apply_round_scores cascade;
drop function if exists public.deal_hands cascade;
drop function if exists public.handle_new_user cascade;
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.room_messages cascade;
drop table if exists public.game_stats cascade;
drop table if exists public.round_history cascade;
drop table if exists public.room_decks cascade;
drop table if exists public.room_players cascade;
drop table if exists public.rooms cascade;
drop table if exists public.profiles cascade;

-- ─── 1) Profiles ────────────────────────────────────────────────────
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

-- ─── 2) Rooms ───────────────────────────────────────────────────────
create table public.rooms (
  id                        uuid primary key default gen_random_uuid(),
  code                      text unique not null,
  host_id                   uuid references public.profiles(id),
  edition                   text not null default 'classic',
  phase                     text not null default 'lobby',
  round                     int not null default 0,
  max_rounds                int not null default 0,
  dealer                    int not null default 0,
  current_player            int not null default 0,
  trump_card                jsonb,
  trump_suit                text,
  werewolf_suit             text,
  original_trump_card       jsonb,
  current_trick             jsonb not null default '[]',
  last_trick_winner         int,
  last_trick_cards          jsonb,
  pending_rainbow7          jsonb,
  pending_rainbow7_buffer   jsonb,
  pending_rainbow9          int,
  pending_rainbow9_deferred int,
  pending_witch             int,
  pending_vampire_reveal    boolean,
  witch_swap                jsonb,
  ai_lock                   text,
  log                       jsonb not null default '[]',
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ─── 3) Room Players ──────────────────────────────────────────────
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

-- ─── 4) Privates Deck (nie an Clients exponiert) ─────────────────
create table public.room_decks (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  deck    jsonb not null default '[]'::jsonb
);

-- ─── 5) Round History ─────────────────────────────────────────────
create table public.round_history (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references public.rooms(id) on delete cascade,
  round      int not null,
  results    jsonb not null,
  created_at timestamptz default now()
);

-- ─── 6) Game Stats ────────────────────────────────────────────────
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

-- ─── 7) Chat ──────────────────────────────────────────────────────
create table public.room_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid not null,
  username   text not null,
  text       text not null check (char_length(text) <= 500),
  created_at timestamptz not null default now()
);
create index room_messages_room_idx on public.room_messages (room_id, created_at);

-- ─── 8) Realtime ──────────────────────────────────────────────────
-- room_decks bewusst NICHT hier — Deck-Reihenfolge darf nie an Clients gehen.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.round_history;
alter publication supabase_realtime add table public.room_messages;

-- ─── 9) RLS aktivieren ────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.rooms         enable row level security;
alter table public.room_players  enable row level security;
alter table public.round_history enable row level security;
alter table public.game_stats    enable row level security;
alter table public.room_messages enable row level security;
alter table public.room_decks    enable row level security;
-- room_decks: bewusst KEINE Policies → nur service_role (Edge Function) kommt ran

-- ─── 10) Policies ─────────────────────────────────────────────────
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- rooms: kein Client-Insert (läuft über die createRoom-Action der Edge Function);
-- Lesen ist spaltenbeschränkt (siehe Grant unten), Schreiben nur service_role.
create policy "rooms_select" on public.rooms for select using (auth.role() = 'authenticated');
create policy "rooms_update" on public.rooms for update using (auth.role() = 'service_role');

-- room_players: jeder liest nur die EIGENE Zeile (Handkarten anderer nicht lesbar).
-- Mitspieler-Infos ohne Hand kommen aus room_players_view.
create policy "rp_select_own" on public.room_players
  for select using (auth.uid() = user_id);
create policy "rp_update" on public.room_players for update using (auth.role() = 'service_role');

create policy "rh_select" on public.round_history for select using (auth.role() = 'authenticated');
create policy "gs_select" on public.game_stats for select using (auth.role() = 'authenticated');
create policy "gs_insert" on public.game_stats for insert with check (auth.role() = 'service_role');

create policy "chat_select" on public.room_messages
  for select using (
    exists (select 1 from public.room_players rp where rp.room_id = room_messages.room_id and rp.user_id = auth.uid())
  );
create policy "chat_insert" on public.room_messages
  for insert with check (
    auth.uid() = user_id and
    exists (select 1 from public.room_players rp where rp.room_id = room_messages.room_id and rp.user_id = auth.uid())
  );

-- ─── 11) Spaltenbeschränkter Lesezugriff auf rooms ────────────────
-- (RLS kann keine Spalten filtern — remaining_deck existiert als Konzept
-- gar nicht mehr, das Deck liegt komplett in room_decks statt in rooms.)
revoke select on public.rooms from authenticated;
grant select (
  id, code, phase, round, max_rounds, dealer, current_player,
  trump_card, trump_suit, werewolf_suit, original_trump_card,
  current_trick, last_trick_winner, last_trick_cards,
  pending_rainbow7, pending_rainbow7_buffer, pending_rainbow9,
  pending_rainbow9_deferred, pending_witch, pending_vampire_reveal,
  witch_swap, edition, log, created_at
) on public.rooms to authenticated;

-- ─── 12) Öffentliche View für Mitspieler (ohne Handkarten) ────────
-- Ausnahme Indianer-Poker (Runde 1): dort sind fremde Karten regulär
-- sichtbar → visible_hand liefert die Hand nur in Runde 1 für fremde
-- Spieler; die eigene bleibt null (kommt separat aus der eigenen Zeile).
create or replace view public.room_players_view
with (security_invoker = off) as
select
  rp.id, rp.room_id, rp.user_id, rp.player_index, rp.is_ai, rp.ai_name,
  rp.bid, rp.tricks_won, rp.score, rp.connected,
  coalesce(jsonb_array_length(rp.hand), 0) as hand_count,
  case
    when r.round = 1
     and r.phase in ('bidding','playing','trickEnd','choosingTrump','choosingWerewolf')
     and rp.user_id is distinct from auth.uid()
    then rp.hand
    else null
  end as visible_hand
from public.room_players rp
join public.rooms r on r.id = rp.room_id;

grant select on public.room_players_view to authenticated;

-- ─── 13) Stats View ────────────────────────────────────────────────
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

-- ─── 14) Atomare Rundentransaktionen (RPC, nur service_role) ──────
create or replace function public.apply_round_scores(
  p_room_id uuid,
  p_round int,
  p_results jsonb  -- [{playerIndex, delta, totalScore, ...}]
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.room_players rp
  set score = (r->>'totalScore')::int
  from jsonb_array_elements(p_results) r
  where rp.room_id = p_room_id
    and rp.player_index = (r->>'playerIndex')::int;

  insert into public.round_history (room_id, round, results)
  values (p_room_id, p_round, p_results);
end $$;
revoke all on function public.apply_round_scores from public, anon, authenticated;

create or replace function public.deal_hands(
  p_room_id uuid,
  p_hands jsonb  -- [{playerIndex, hand}]
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.room_players rp
  set hand = (h->'hand'), bid = null, tricks_won = 0
  from jsonb_array_elements(p_hands) h
  where rp.room_id = p_room_id
    and rp.player_index = (h->>'playerIndex')::int;
end $$;
revoke all on function public.deal_hands from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- Fertig. Danach: Edge Function "game-action" deployen und
-- Frontend neu bauen/pushen.
-- ════════════════════════════════════════════════════════════════
