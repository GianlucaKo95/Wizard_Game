-- ════════════════════════════════════════════════════════════════
-- 005_room_membership.sql — Reconnect über das Backend statt localStorage
--
-- room_players ist bereits die Quelle der Wahrheit dafür, wer in
-- welchem Raum ist - der Client muss sich das nicht mehr selbst
-- merken. planned_total wird zusätzlich auf rooms gespeichert, damit
-- der Host beim Wiedereinstieg in einen unbegonnenen Warteraum noch
-- weiß, wie viele Spieler insgesamt geplant waren (bisher nur im
-- Client gehalten und beim Neuladen verloren).
--
-- Voraussetzung: 000_full_reset.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

alter table public.rooms add column planned_total int;
grant select (planned_total) on public.rooms to authenticated;
