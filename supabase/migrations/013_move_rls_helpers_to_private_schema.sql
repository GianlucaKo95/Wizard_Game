-- is_manual_game_host/is_manual_game_player are RLS-helper predicates, only
-- ever meant to be called from inside a policy expression - but Postgres
-- exposes any function in the "public" schema as a callable REST RPC
-- endpoint (PostgREST only routes schemas it's configured to expose, which
-- for a stock Supabase project is just "public"). Moving them out of
-- "public" removes the direct RPC route. ALTER ... SET SCHEMA relocates the
-- function in place (same OID) - existing RLS policies reference it by OID
-- internally (resolved at CREATE POLICY time, same as view definitions), so
-- they keep working without being touched. Explicit EXECUTE grants below
-- keep RLS evaluation itself working for real client queries against
-- manual_games/manual_game_players/manual_game_rounds.
--
-- Verified live (before writing this file) with simulated auth contexts:
-- host still sees their own manual_games row, a linked non-host player still
-- sees theirs via is_manual_game_player, and a genuinely unrelated user sees
-- neither - all unchanged after the move.
CREATE SCHEMA IF NOT EXISTS private;

ALTER FUNCTION public.is_manual_game_host(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_manual_game_player(uuid, uuid) SET SCHEMA private;

GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_manual_game_host(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_manual_game_player(uuid, uuid) TO anon, authenticated, service_role;
