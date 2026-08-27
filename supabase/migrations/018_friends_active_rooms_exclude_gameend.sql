-- friends_active_rooms (016_friends_active_rooms_detail.sql) listed a
-- friend's room regardless of phase, on the assumption that the row simply
-- disappears once the room is cleaned up. But cleanup_stale_rooms()
-- (007_room_cleanup_windows.sql) deliberately leaves finished games
-- (phase = 'gameEnd') around for up to two hours so the players can still
-- review the final scoreboard - so for that whole window, "Freunde spielen
-- gerade" kept advertising an already-finished game as in progress. The
-- game being over is knowable immediately from its phase, so exclude
-- gameEnd rooms here instead of waiting on cleanup timing.
create or replace view public.friends_active_rooms as
select distinct r.id as room_id, r.code, r.phase, r.edition,
  rp.user_id as friend_user_id, rp.ai_name as friend_name,
  r.round,
  (select count(*) from room_players rp2 where rp2.room_id = r.id) as player_count
from room_players rp
join rooms r on r.id = rp.room_id
where rp.is_ai = false
  and r.phase <> 'gameEnd'
  and rp.user_id in (
    select case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
    from friends f
    where f.status = 'accepted'
      and (f.requester_id = (select auth.uid()) or f.addressee_id = (select auth.uid()))
  );

grant select on public.friends_active_rooms to authenticated;
