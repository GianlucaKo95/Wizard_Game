import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...headers, "Access-Control-Allow-Headers": "authorization,content-type" } });

  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

  const { code } = await req.json();
  if (!code) return new Response(JSON.stringify({ error: "Kein Raumcode" }), { status: 400, headers });

  // Find room
  const { data: room } = await supabase.from("rooms").select("*").eq("code", code.toUpperCase()).single();
  if (!room) return new Response(JSON.stringify({ error: "Raum nicht gefunden" }), { status: 404, headers });
  if (room.phase !== "lobby") return new Response(JSON.stringify({ error: "Spiel bereits gestartet" }), { status: 400, headers });

  // Check if already in room
  const { data: existing } = await supabase.from("room_players")
    .select("player_index").eq("room_id", room.id).eq("user_id", user.id).single();
  if (existing) return new Response(JSON.stringify({ roomId: room.id, playerIndex: existing.player_index }), { headers });

  // Count current players
  const { data: players } = await supabase.from("room_players").select("player_index").eq("room_id", room.id);
  if ((players?.length ?? 0) >= 6) return new Response(JSON.stringify({ error: "Raum voll" }), { status: 400, headers });

  const playerIndex = players?.length ?? 0;

  await supabase.from("room_players").insert({
    room_id: room.id, user_id: user.id, player_index: playerIndex, is_ai: false,
  });

  // Update log
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  await supabase.from("rooms").update({
    log: [{ msg: `${profile?.username} ist beigetreten`, ts: Date.now() }, ...(room.log ?? [])].slice(0, 30)
  }).eq("id", room.id);

  return new Response(JSON.stringify({ roomId: room.id, playerIndex }), { headers });
});
