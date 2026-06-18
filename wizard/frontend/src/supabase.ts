import { createClient } from "@supabase/supabase-js";

const isPWA = () => {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
  } catch { return false; }
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: isPWA(),
      autoRefreshToken: isPWA(),
      detectSessionInUrl: false,
    }
  }
);

export async function callGameAction(roomId: string, action: string, extra: object = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/game-action`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ roomId, action, ...extra }),
    }
  );
  return res.json();
}
