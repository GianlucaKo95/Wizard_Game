-- "Niemand wird unbemerkt beobachtet": room members can see who is
-- spectating their own room. Spectators could previously only ever read
-- their own room_spectators row (room_spectators_select_own, unchanged) -
-- players had no way to know anyone was watching at all.
--
-- Adds a second, additive SELECT policy (Postgres OR's multiple permissive
-- policies together) scoped to actual members of that specific room only -
-- an outsider still can't enumerate who's spectating a room they have
-- nothing to do with, and a spectator's presence in room X is invisible to
-- someone merely playing in room Y.
create policy room_spectators_select_room_member on public.room_spectators for select
  using (exists (
    select 1 from room_players rp
    where rp.room_id = room_spectators.room_id and rp.user_id = (select auth.uid())
  ));
