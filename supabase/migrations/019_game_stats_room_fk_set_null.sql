-- cleanup_stale_rooms() (007_room_cleanup_windows.sql) has been failing on
-- every single run for hours: game_stats.room_id had no ON DELETE rule
-- (default NO ACTION), so once any finished game's room became old enough
-- to delete, its game_stats rows blocked the DELETE - and because cleanup
-- issues one bulk DELETE across all stale rooms, that single blocked room
-- poisoned the whole statement, silently stalling cleanup for every other
-- room too. game_stats is meant to be a permanent historical record
-- independent of the room's lifecycle (the same reasoning already applied
-- to manual_game_id in 017), so the room reference should be nulled out
-- on room deletion, not block it.
alter table public.game_stats drop constraint game_stats_room_id_fkey;
alter table public.game_stats
  add constraint game_stats_room_id_fkey foreign key (room_id) references public.rooms(id) on delete set null;
