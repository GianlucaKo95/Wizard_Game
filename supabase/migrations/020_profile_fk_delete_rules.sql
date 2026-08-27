-- Deleting a user account failed with a foreign key violation as soon as
-- that user was referenced anywhere - rooms.host_id, room_players.user_id,
-- game_stats.user_id, and manual_game_players.user_id all referenced
-- profiles(id) with no ON DELETE rule (the same pattern already fixed for
-- game_stats.room_id in 019_game_stats_room_fk_set_null.sql, and for
-- game_stats.manual_game_id in 017_game_stats_manual_game_link.sql).
--
-- Rule chosen per column, matching scripts/delete_user.sql's manual
-- workaround:
--   rooms.host_id               -> SET NULL (room survives for other players;
--                                  host_id is already nullable)
--   room_players.user_id        -> CASCADE  (same as leaving the room)
--   game_stats.user_id          -> CASCADE  (personal stats history, not
--                                  meaningful once the account is gone)
--   manual_game_players.user_id -> SET NULL (already nullable for exactly
--                                  this case - "null = guest", see
--                                  010_manual_games.sql)
alter table public.rooms drop constraint rooms_host_id_fkey;
alter table public.rooms
  add constraint rooms_host_id_fkey foreign key (host_id) references public.profiles(id) on delete set null;

alter table public.room_players drop constraint room_players_user_id_fkey;
alter table public.room_players
  add constraint room_players_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.game_stats drop constraint game_stats_user_id_fkey;
alter table public.game_stats
  add constraint game_stats_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.manual_game_players drop constraint manual_game_players_user_id_fkey;
alter table public.manual_game_players
  add constraint manual_game_players_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;
