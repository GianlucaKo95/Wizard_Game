-- 1) room_players_view: close cross-room leak (any authenticated user could
--    previously query this view for ANY room_id, since it had no membership
--    check of its own - it relies on the view's implicit definer-style
--    execution to bypass room_players' "own row only" RLS). Adds an explicit
--    "am I actually a player in this room" check. Must stay definer-style
--    (not security_invoker) since it still needs to read other players' rows.
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
            WHEN r.round = 1 AND (r.phase = ANY (ARRAY['bidding'::text, 'playing'::text, 'trickEnd'::text, 'choosingTrump'::text, 'choosingWerewolf'::text])) AND rp.user_id IS DISTINCT FROM (select auth.uid()) THEN rp.hand
            ELSE NULL::jsonb
        END AS visible_hand
   FROM room_players rp
     JOIN rooms r ON r.id = rp.room_id
   WHERE EXISTS (
     SELECT 1 FROM room_players me
     WHERE me.room_id = rp.room_id AND me.user_id = (select auth.uid())
   );

-- 2) user_stats: underlying tables (profiles, game_stats) are already
--    broadly readable, so flipping to security_invoker is zero-risk and
--    clears the lint.
CREATE OR REPLACE VIEW public.user_stats
WITH (security_invoker = true) AS
 SELECT p.id,
    p.username,
    count(gs.id) AS games_played,
    count(gs.id) FILTER (WHERE gs.placement = 1) AS games_won,
    round(avg(gs.final_score)) AS avg_score,
    round(avg(gs.placement), 1) AS avg_placement,
    COALESCE(sum(gs.tricks_bid), (0)::bigint) AS total_bid,
    COALESCE(sum(gs.tricks_won), (0)::bigint) AS total_won,
    round(((100.0 * (sum(gs.tricks_won))::numeric) / (NULLIF(sum(gs.tricks_bid), 0))::numeric), 1) AS bid_accuracy_pct
   FROM profiles p
     LEFT JOIN game_stats gs ON gs.user_id = p.id
  GROUP BY p.id, p.username;

-- 3) Fixed search_path on the two functions missing it, and revoke public
--    EXECUTE on handle_new_user (only the auth.users insert trigger should
--    ever invoke it - trigger firing is unaffected by this revoke).
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.touch_room_updated_at() SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4) Wrap auth.uid()/auth.role() in (select ...) everywhere so Postgres can
--    cache it once per query (InitPlan) instead of re-evaluating per row.
--    Same logic throughout, just wrapped.
DROP POLICY IF EXISTS friends_delete ON public.friends;
CREATE POLICY friends_delete ON public.friends FOR DELETE
  USING (((select auth.uid()) = requester_id) OR ((select auth.uid()) = addressee_id));

DROP POLICY IF EXISTS friends_insert ON public.friends;
CREATE POLICY friends_insert ON public.friends FOR INSERT
  WITH CHECK ((select auth.uid()) = requester_id);

DROP POLICY IF EXISTS friends_select ON public.friends;
CREATE POLICY friends_select ON public.friends FOR SELECT
  USING (((select auth.uid()) = requester_id) OR ((select auth.uid()) = addressee_id));

DROP POLICY IF EXISTS friends_update ON public.friends;
CREATE POLICY friends_update ON public.friends FOR UPDATE
  USING ((select auth.uid()) = addressee_id)
  WITH CHECK ((select auth.uid()) = addressee_id);

DROP POLICY IF EXISTS gs_insert ON public.game_stats;
CREATE POLICY gs_insert ON public.game_stats FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS gs_select ON public.game_stats;
CREATE POLICY gs_select ON public.game_stats FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles FOR UPDATE
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS invites_select ON public.room_invites;
CREATE POLICY invites_select ON public.room_invites FOR SELECT
  USING (((select auth.uid()) = from_user_id) OR ((select auth.uid()) = to_user_id));

DROP POLICY IF EXISTS invites_insert ON public.room_invites;
CREATE POLICY invites_insert ON public.room_invites FOR INSERT
  WITH CHECK (
    ((select auth.uid()) = from_user_id) AND EXISTS (
      SELECT 1 FROM friends f
      WHERE f.status = 'accepted' AND (
        (f.requester_id = (select auth.uid()) AND f.addressee_id = room_invites.to_user_id)
        OR (f.requester_id = room_invites.to_user_id AND f.addressee_id = (select auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS invites_delete ON public.room_invites;
CREATE POLICY invites_delete ON public.room_invites FOR DELETE
  USING (((select auth.uid()) = from_user_id) OR ((select auth.uid()) = to_user_id));

DROP POLICY IF EXISTS chat_select ON public.room_messages;
CREATE POLICY chat_select ON public.room_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM room_players rp WHERE rp.room_id = room_messages.room_id AND rp.user_id = (select auth.uid())));

DROP POLICY IF EXISTS chat_insert ON public.room_messages;
CREATE POLICY chat_insert ON public.room_messages FOR INSERT
  WITH CHECK (
    ((select auth.uid()) = user_id) AND EXISTS (
      SELECT 1 FROM room_players rp WHERE rp.room_id = room_messages.room_id AND rp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS rp_select_own ON public.room_players;
CREATE POLICY rp_select_own ON public.room_players FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS rp_update ON public.room_players;
CREATE POLICY rp_update ON public.room_players FOR UPDATE
  USING ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS rooms_select ON public.rooms;
CREATE POLICY rooms_select ON public.rooms FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS rooms_update ON public.rooms;
CREATE POLICY rooms_update ON public.rooms FOR UPDATE
  USING ((select auth.role()) = 'service_role');

DROP POLICY IF EXISTS rh_select ON public.round_history;
CREATE POLICY rh_select ON public.round_history FOR SELECT
  USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 5) manual_games / manual_game_players / manual_game_rounds: each had an
--    "ALL" host policy plus a separate SELECT-only policy, so SELECT queries
--    ran through two permissive policies. Split the host ALL policy into
--    per-action policies and merge SELECT visibility into one policy per
--    table (host OR linked-player), wrapping auth.<fn>() calls at the same
--    time. Same combined access as before, one policy per role+action.
DROP POLICY IF EXISTS manual_games_host ON public.manual_games;
DROP POLICY IF EXISTS manual_games_linked_select ON public.manual_games;
CREATE POLICY manual_games_select ON public.manual_games FOR SELECT
  USING (((select auth.uid()) = host_id) OR is_manual_game_player(id, (select auth.uid())));
CREATE POLICY manual_games_insert ON public.manual_games FOR INSERT
  WITH CHECK ((select auth.uid()) = host_id);
CREATE POLICY manual_games_update ON public.manual_games FOR UPDATE
  USING ((select auth.uid()) = host_id) WITH CHECK ((select auth.uid()) = host_id);
CREATE POLICY manual_games_delete ON public.manual_games FOR DELETE
  USING ((select auth.uid()) = host_id);

DROP POLICY IF EXISTS manual_game_players_host ON public.manual_game_players;
DROP POLICY IF EXISTS manual_game_players_linked_select ON public.manual_game_players;
CREATE POLICY manual_game_players_select ON public.manual_game_players FOR SELECT
  USING (is_manual_game_host(manual_game_id, (select auth.uid())) OR user_id = (select auth.uid()));
CREATE POLICY manual_game_players_insert ON public.manual_game_players FOR INSERT
  WITH CHECK (is_manual_game_host(manual_game_id, (select auth.uid())));
CREATE POLICY manual_game_players_update ON public.manual_game_players FOR UPDATE
  USING (is_manual_game_host(manual_game_id, (select auth.uid()))) WITH CHECK (is_manual_game_host(manual_game_id, (select auth.uid())));
CREATE POLICY manual_game_players_delete ON public.manual_game_players FOR DELETE
  USING (is_manual_game_host(manual_game_id, (select auth.uid())));

DROP POLICY IF EXISTS manual_game_rounds_host ON public.manual_game_rounds;
DROP POLICY IF EXISTS manual_game_rounds_linked_select ON public.manual_game_rounds;
CREATE POLICY manual_game_rounds_select ON public.manual_game_rounds FOR SELECT
  USING (is_manual_game_host(manual_game_id, (select auth.uid())) OR is_manual_game_player(manual_game_id, (select auth.uid())));
CREATE POLICY manual_game_rounds_insert ON public.manual_game_rounds FOR INSERT
  WITH CHECK (is_manual_game_host(manual_game_id, (select auth.uid())));
CREATE POLICY manual_game_rounds_update ON public.manual_game_rounds FOR UPDATE
  USING (is_manual_game_host(manual_game_id, (select auth.uid()))) WITH CHECK (is_manual_game_host(manual_game_id, (select auth.uid())));
CREATE POLICY manual_game_rounds_delete ON public.manual_game_rounds FOR DELETE
  USING (is_manual_game_host(manual_game_id, (select auth.uid())));

-- 6) Missing covering indexes on foreign keys (all currently tiny tables,
--    but cheap and correct to add now).
CREATE INDEX IF NOT EXISTS friends_addressee_id_idx ON public.friends(addressee_id);
CREATE INDEX IF NOT EXISTS friends_requester_id_idx ON public.friends(requester_id);
CREATE INDEX IF NOT EXISTS game_stats_room_id_idx ON public.game_stats(room_id);
CREATE INDEX IF NOT EXISTS game_stats_user_id_idx ON public.game_stats(user_id);
CREATE INDEX IF NOT EXISTS manual_game_players_user_id_idx ON public.manual_game_players(user_id);
CREATE INDEX IF NOT EXISTS manual_games_host_id_idx ON public.manual_games(host_id);
CREATE INDEX IF NOT EXISTS room_invites_from_user_id_idx ON public.room_invites(from_user_id);
CREATE INDEX IF NOT EXISTS room_players_user_id_idx ON public.room_players(user_id);
CREATE INDEX IF NOT EXISTS rooms_host_id_idx ON public.rooms(host_id);
CREATE INDEX IF NOT EXISTS round_history_room_id_idx ON public.round_history(room_id);
