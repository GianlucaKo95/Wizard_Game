import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateRoomCode } from "../_shared/game.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...headers, "Access-Control-Allow-Headers": "authorization,content-type" } });

  // Verify JWT
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!jwt) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

  const { aiCount = 0 } = await req.json().catch(() => ({}));

  // Generate unique room code
  let code = generateRoomCode();
  while ((await supabase.from("rooms").select("id").eq("code", code)).data?.length) {
    code = generateRoomCode();
  }

  // Create room
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .insert({ code, host_id: user.id, ai_count: aiCount, log: [`Raum ${code} erstellt`] })
    .select()
    .single();

  if (roomErr) return new Response(JSON.stringify({ error: roomErr.message }), { status: 500, headers });

  // Add host as player 0
  await supabase.from("room_players").insert({
    room_id: room.id,
    user_id: user.id,
    player_index: 0,
    is_ai: false,
  });

  return new Response(JSON.stringify({ roomId: room.id, code }), { headers });
});
