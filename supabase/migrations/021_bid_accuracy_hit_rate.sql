-- bid_accuracy_pct was defined as sum(tricks_won) / sum(tricks_bid), a raw
-- ratio of totals - not actually a "hit rate" at all. That's unbounded
-- above 100%: a player who bids conservatively but wins more tricks than
-- announced (over-performing their own bid) pushes the ratio past 100,
-- which is nonsensical for something labeled "Trefferquote der Ansagen".
--
-- A real hit rate has to be round-by-round: did this bid match what was
-- actually taken, yes or no, per round - not summed first across the whole
-- game. That granularity isn't in game_stats today (only aggregate
-- tricks_bid/tricks_won per game), so add columns to hold it, exactly
-- mirroring how tricks_bid/tricks_won are already computed once at game
-- end and stored permanently (round_history/manual_game_rounds don't
-- survive room cleanup - see 019/020's commit messages - so this has to be
-- captured at finish time, not derived later).
alter table public.game_stats add column rounds_hit int not null default 0;
alter table public.game_stats add column rounds_played int not null default 0;

create or replace view public.user_stats
with (security_invoker = true) as
 select p.id,
    p.username,
    count(gs.id) as games_played,
    count(gs.id) filter (where gs.placement = 1) as games_won,
    round(avg(gs.final_score)) as avg_score,
    round(avg(gs.placement), 1) as avg_placement,
    coalesce(sum(gs.tricks_bid), (0)::bigint) as total_bid,
    coalesce(sum(gs.tricks_won), (0)::bigint) as total_won,
    round((100.0 * (sum(gs.rounds_hit))::numeric) / (nullif(sum(gs.rounds_played), 0))::numeric, 1) as bid_accuracy_pct
   from profiles p
     left join game_stats gs on gs.user_id = p.id
  group by p.id, p.username;
