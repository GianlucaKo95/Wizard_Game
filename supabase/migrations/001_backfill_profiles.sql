-- ════════════════════════════════════════════════════════════════
-- 001_backfill_profiles.sql — Profile für bestehende Auth-User nachbauen
--
-- Grund: 000_full_reset.sql hat public.profiles geleert, aber
-- auth.users bewusst nicht angerührt. Ohne dieses Skript hat jeder
-- bereits registrierte User zwar noch sein Login, aber kein
-- profiles-Eintrag mehr → user_stats leer, Fremdschlüssel auf
-- profiles.id (z. B. rooms.host_id) würden bei diesen Usern ins Leere
-- laufen.
--
-- Idempotent: kann gefahrlos mehrfach ausgeführt werden.
-- ════════════════════════════════════════════════════════════════

insert into public.profiles (id, username, created_at)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'username',
    split_part(u.email, '@', 1),
    'Spieler-' || substr(u.id::text, 1, 8)
  ) as username,
  u.created_at
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Falls der rekonstruierte username mit einem bereits vergebenen
-- kollidiert (unique-Constraint), macht dieser Block ihn eindeutig
-- statt den Insert für alle fehlschlagen zu lassen.
do $$
declare
  r record;
  new_name text;
  suffix int;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data->>'username' as meta_name, u.created_at
    from auth.users u
    where not exists (select 1 from public.profiles p where p.id = u.id)
  loop
    new_name := coalesce(r.meta_name, split_part(r.email, '@', 1), 'Spieler-' || substr(r.id::text, 1, 8));
    suffix := 1;
    while exists (select 1 from public.profiles where username = new_name) loop
      suffix := suffix + 1;
      new_name := coalesce(r.meta_name, split_part(r.email, '@', 1), 'Spieler') || suffix;
    end loop;
    insert into public.profiles (id, username, created_at) values (r.id, new_name, r.created_at);
  end loop;
end $$;
