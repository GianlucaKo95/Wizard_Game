-- ════════════════════════════════════════════════════════════════
-- 011_manual_games_rls_recursion_fix.sql — Behebt "infinite recursion
-- detected in policy for relation manual_games"
--
-- 010_manual_games.sql's "linked player" policies checked the OTHER
-- manual_* table directly via a subquery (manual_games' select policy
-- queries manual_game_players, whose own host policy queries manual_games
-- right back) - evaluating either table's RLS then required evaluating the
-- other's, which requires the first's again, forever. Postgres detects this
-- and errors instead of looping, which is why every manual_games insert
-- failed (an insert with .select() still needs to evaluate the table's
-- SELECT policies to return the new row).
--
-- Fix: SECURITY DEFINER helper functions run with the function owner's
-- privileges, which bypasses RLS entirely for the table they query inside
-- the function body - the standard Postgres/Supabase pattern for breaking
-- exactly this kind of circular RLS reference. Policies call the function
-- instead of subquerying the other table directly, so evaluating one
-- table's policy no longer triggers evaluation of the other's.
--
-- Voraussetzung: 010_manual_games.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

create or replace function public.is_manual_game_player(p_game_id uuid, p_user_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.manual_game_players
    where manual_game_id = p_game_id and user_id = p_user_id
  );
$$;

create or replace function public.is_manual_game_host(p_game_id uuid, p_user_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.manual_games
    where id = p_game_id and host_id = p_user_id
  );
$$;

drop policy if exists "manual_games_linked_select" on public.manual_games;
create policy "manual_games_linked_select" on public.manual_games
  for select using (public.is_manual_game_player(id, auth.uid()));

drop policy if exists "manual_game_players_host" on public.manual_game_players;
create policy "manual_game_players_host" on public.manual_game_players
  for all using (public.is_manual_game_host(manual_game_id, auth.uid()))
  with check (public.is_manual_game_host(manual_game_id, auth.uid()));

drop policy if exists "manual_game_rounds_host" on public.manual_game_rounds;
create policy "manual_game_rounds_host" on public.manual_game_rounds
  for all using (public.is_manual_game_host(manual_game_id, auth.uid()))
  with check (public.is_manual_game_host(manual_game_id, auth.uid()));

drop policy if exists "manual_game_rounds_linked_select" on public.manual_game_rounds;
create policy "manual_game_rounds_linked_select" on public.manual_game_rounds
  for select using (public.is_manual_game_player(manual_game_id, auth.uid()));
