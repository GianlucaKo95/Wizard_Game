-- ════════════════════════════════════════════════════════════════
-- 010_manual_games.sql — Digitaler Rechenblock (Punkte für am Tisch
-- gespielte, nicht über die App gespielte Partien manuell erfassen)
--
-- Ersetzt den Papier-Rechenblock: eine Person (der Host) trägt pro Runde
-- Ansage/Stiche für alle Mitspieler ein. Mitspieler können entweder ein
-- registrierter App-Account sein (dann fließt das Ergebnis über
-- finishManualGame/game_stats in ihre normale Statistik ein) oder einfach
-- ein Name ohne Account ("Gast").
--
-- Schreibzugriff läuft komplett direkt vom Client (RLS: nur der Host
-- schreibt seine eigenen Spiele) - anders als bei rooms/game_stats, wo die
-- Edge Function die alleinige Instanz ist, gibt es hier keine
-- Cheating-Gefahr (das echte Spiel ist längst am Tisch gespielt, das hier
-- ist reine Nacherfassung). Der game_stats-Insert selbst läuft trotzdem
-- über die Edge Function (finishManualGame-Action), weil game_stats'
-- bestehende RLS-Policy Inserts auf service_role beschränkt.
--
-- Voraussetzung: 000_full_reset.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

create table public.manual_games (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references auth.users(id) on delete cascade,
  edition      text not null default 'classic',
  max_rounds   int not null,
  -- Bids for the round currently being played, announced (and locked in)
  -- before anyone knows the trick results - matches the real Wizard flow
  -- where Ansage happens before the round is played, not together with the
  -- result. {playerIndex: bid}, null once no round is "in progress".
  pending_bids jsonb,
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table public.manual_game_players (
  id             uuid primary key default gen_random_uuid(),
  manual_game_id uuid not null references public.manual_games(id) on delete cascade,
  player_index   int not null,
  user_id        uuid references public.profiles(id), -- null = guest, no account to link
  display_name   text not null, -- snapshotted at creation, same convention as room_players.ai_name
  unique (manual_game_id, player_index)
);

create table public.manual_game_rounds (
  id             uuid primary key default gen_random_uuid(),
  manual_game_id uuid not null references public.manual_games(id) on delete cascade,
  round          int not null,
  results        jsonb not null, -- [{playerIndex, name, bid, got, delta}]
  created_at     timestamptz not null default now(),
  unique (manual_game_id, round)
);

alter table public.manual_games enable row level security;
alter table public.manual_game_players enable row level security;
alter table public.manual_game_rounds enable row level security;

-- Host verwaltet seine eigenen Spiele vollständig.
create policy "manual_games_host" on public.manual_games
  for all using (auth.uid() = host_id) with check (auth.uid() = host_id);

-- Verknüpfte (nicht-Gast) Mitspieler dürfen das Spiel einsehen, aber nicht ändern.
create policy "manual_games_linked_select" on public.manual_games
  for select using (exists (
    select 1 from public.manual_game_players p
    where p.manual_game_id = manual_games.id and p.user_id = auth.uid()
  ));

create policy "manual_game_players_host" on public.manual_game_players
  for all using (exists (
    select 1 from public.manual_games g where g.id = manual_game_players.manual_game_id and g.host_id = auth.uid()
  )) with check (exists (
    select 1 from public.manual_games g where g.id = manual_game_players.manual_game_id and g.host_id = auth.uid()
  ));

create policy "manual_game_players_linked_select" on public.manual_game_players
  for select using (user_id = auth.uid());

create policy "manual_game_rounds_host" on public.manual_game_rounds
  for all using (exists (
    select 1 from public.manual_games g where g.id = manual_game_rounds.manual_game_id and g.host_id = auth.uid()
  )) with check (exists (
    select 1 from public.manual_games g where g.id = manual_game_rounds.manual_game_id and g.host_id = auth.uid()
  ));

create policy "manual_game_rounds_linked_select" on public.manual_game_rounds
  for select using (exists (
    select 1 from public.manual_game_players p
    where p.manual_game_id = manual_game_rounds.manual_game_id and p.user_id = auth.uid()
  ));

grant select, insert, update, delete on public.manual_games to authenticated;
grant select, insert, update, delete on public.manual_game_players to authenticated;
grant select, insert, update, delete on public.manual_game_rounds to authenticated;
