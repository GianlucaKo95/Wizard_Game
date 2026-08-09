-- ════════════════════════════════════════════════════════════════
-- 009_rainbow7_pass_lock.sql — Atomarer Kartentausch bei Jongleur (7½)
--
-- Behebt eine Race Condition: Wenn zwei Spieler (oder Spieler + serverseitige
-- KI-Weitergabe) nahezu gleichzeitig passCard aufriefen, wurden
-- pending_rainbow7 und pending_rainbow7_buffer bisher jeweils aus einem in
-- der Edge Function bereits veralteten Snapshot neu geschrieben - der zweite
-- Schreibvorgang konnte den schon committeten Pass des ersten Spielers
-- stillschweigend überschreiben, sodass eine Karte dauerhaft aus dem Spiel
-- verschwand. record_rainbow7_pass sperrt die Raumzeile für die Dauer der
-- Transaktion (SELECT ... FOR UPDATE) und macht Entnahme aus
-- pending_rainbow7 + Ablage im Buffer atomar - jeder Aufruf sieht garantiert
-- den zuletzt committeten Stand.
--
-- Voraussetzung: 000_full_reset.sql wurde bereits ausgeführt.
-- ════════════════════════════════════════════════════════════════

create or replace function public.record_rainbow7_pass(
  p_room_id uuid,
  p_player_idx int,
  p_card jsonb
) returns jsonb -- { pending: [...], buffer: {...} }, oder null wenn der Spieler
                -- nicht (mehr) in pending_rainbow7 stand (Race verloren / Duplikat)
language plpgsql security definer set search_path = public as $$
declare
  v_pending jsonb;
  v_buffer  jsonb;
begin
  select pending_rainbow7, pending_rainbow7_buffer into v_pending, v_buffer
  from public.rooms where id = p_room_id for update;

  if v_pending is null or not (v_pending @> to_jsonb(p_player_idx)) then
    return null;
  end if;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_pending
  from jsonb_array_elements(v_pending) x
  where x <> to_jsonb(p_player_idx);

  v_buffer := coalesce(v_buffer, '{}'::jsonb) || jsonb_build_object(p_player_idx::text, p_card);

  update public.rooms set pending_rainbow7 = v_pending, pending_rainbow7_buffer = v_buffer
  where id = p_room_id;

  return jsonb_build_object('pending', v_pending, 'buffer', v_buffer);
end $$;
revoke all on function public.record_rainbow7_pass from public, anon, authenticated;
