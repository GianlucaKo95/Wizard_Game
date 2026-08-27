-- Manual (Rechenblock) games insert their game_stats rows with room_id
-- null (there's no rooms row for a paper-replacement game), which made it
-- impossible to look up "how many people played this game" afterwards -
-- game_stats.room_id is the only thing the Statistik screen currently
-- joins on to group a finished game's rows back together. Add a matching
-- link to manual_games so that grouping can work for manual games too.
alter table public.game_stats
  add column manual_game_id uuid references public.manual_games(id) on delete set null;

create index if not exists game_stats_manual_game_id_idx on public.game_stats(manual_game_id);
