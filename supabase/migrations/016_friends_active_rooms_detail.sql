-- Extends friends_active_rooms (014_spectator_mode.sql) with the two fields
-- the redesigned home screen's "Freunde spielen gerade" row needs: which
-- round the game is on, and how many seats are filled in total (not just
-- how many of my friends are in it). Neither the friendship subquery nor
-- the security posture changes - same rows, same auth.uid()-scoped access,
-- just two more columns pulled in via the existing joins.
-- Postgres requires CREATE OR REPLACE VIEW to keep existing columns in their
-- original position (append-only) - the new round/player_count columns go
-- at the end, not inserted after edition, or it errors trying to "rename"
-- friend_user_id to round.
create or replace view public.friends_active_rooms as
select distinct r.id as room_id, r.code, r.phase, r.edition,
  rp.user_id as friend_user_id, rp.ai_name as friend_name,
  r.round,
  (select count(*) from room_players rp2 where rp2.room_id = r.id) as player_count
from room_players rp
join rooms r on r.id = rp.room_id
where rp.is_ai = false
  and rp.user_id in (
    select case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
    from friends f
    where f.status = 'accepted'
      and (f.requester_id = (select auth.uid()) or f.addressee_id = (select auth.uid()))
  );

grant select on public.friends_active_rooms to authenticated;
