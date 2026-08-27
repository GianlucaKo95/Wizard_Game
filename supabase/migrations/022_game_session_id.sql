-- room_id is the only thing that currently ties a finished online game's
-- player rows together in game_stats, but cleanup_stale_rooms() (004/006/007)
-- deletes the room once it's stale, and 019 made that SET NULL room_id on
-- every one of that game's game_stats rows so the delete doesn't get
-- blocked. That permanently destroys the only join key between the players
-- of that game - the Statistik screen can no longer show "who else played"
-- for it (see the "0 Spieler" bug this was fixing).
--
-- Add a stable id, generated once per game end and stored on every player's
-- row for that game, independent of the rooms table entirely - so it
-- survives room cleanup indefinitely instead of being lost with it.
alter table public.game_stats add column game_session_id uuid;
create index game_stats_session_id_idx on public.game_stats(game_session_id);

-- Needed for the client-side best-effort reconstruction of games that were
-- already orphaned before this column existed (matches candidates by
-- played_at proximity, since that's all that's left for those rows).
create index game_stats_played_at_idx on public.game_stats(played_at);
