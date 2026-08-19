-- Spectator mode: a friend can watch a live/lobby room without ever seeing
-- any hand cards, and can join the room's voice chat.

-- 1) room_spectators - deliberately a separate table from room_players
-- rather than overloading it: room_players carries UNIQUE(room_id,
-- player_index), the 6-seat cap, and a realtime subscription on the raw
-- table that clients merge straight into state (safe today only because
-- rp_select_own scopes each client to their own row) - none of that should
-- have to change to add spectators. Writes go through the edge function
-- (service role) only, same convention as room_players/room_decks.
create table public.room_spectators (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(room_id, user_id)
);
alter table public.room_spectators enable row level security;
create policy room_spectators_select_own on public.room_spectators for select
  using ((select auth.uid()) = user_id);
create index room_spectators_room_id_idx on public.room_spectators(room_id);

-- 2) room_players_view: admit spectators to the roster (names/scores/bids/
-- hand_count/connected - all already visible to every existing player
-- today), but force visible_hand to NULL for them unconditionally, even
-- during the round-1 "Indian poker" exception that reveals hands between
-- players. This is the single security-critical line in this migration -
-- verified with a simulated auth context before considering this done.
CREATE OR REPLACE VIEW public.room_players_view AS
 SELECT rp.id,
    rp.room_id,
    rp.user_id,
    rp.player_index,
    rp.is_ai,
    rp.ai_name,
    rp.bid,
    rp.tricks_won,
    rp.score,
    rp.connected,
    COALESCE(jsonb_array_length(rp.hand), 0) AS hand_count,
        CASE
            WHEN r.round = 1 AND (r.phase = ANY (ARRAY['bidding'::text, 'playing'::text, 'trickEnd'::text, 'choosingTrump'::text, 'choosingWerewolf'::text]))
             AND rp.user_id IS DISTINCT FROM (select auth.uid())
             AND NOT EXISTS (
               SELECT 1 FROM room_spectators sp WHERE sp.room_id = rp.room_id AND sp.user_id = (select auth.uid())
             )
            THEN rp.hand
            ELSE NULL::jsonb
        END AS visible_hand
   FROM room_players rp
     JOIN rooms r ON r.id = rp.room_id
   WHERE EXISTS (
     SELECT 1 FROM room_players me
     WHERE me.room_id = rp.room_id AND me.user_id = (select auth.uid())
   ) OR EXISTS (
     SELECT 1 FROM room_spectators sp
     WHERE sp.room_id = rp.room_id AND sp.user_id = (select auth.uid())
   );

-- 3) friends_active_rooms: discovery query for "which of my friends are
-- currently in a room". Security-definer-style like room_players_view -
-- needed to read other users' room_players rows - but the friendship
-- subquery is keyed off auth.uid() on both sides, so each caller only ever
-- sees rows for their OWN accepted friends, never an arbitrary room. No
-- phase filter (lobby through active play, as requested) - a room simply
-- stops appearing once the friend's room_players row is gone or the room
-- itself is deleted by the cleanup job.
create view public.friends_active_rooms as
select distinct r.id as room_id, r.code, r.phase, r.edition,
  rp.user_id as friend_user_id, rp.ai_name as friend_name
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
