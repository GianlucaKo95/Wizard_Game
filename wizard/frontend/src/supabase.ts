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
      // Always keep the JWT refreshed in the background, even in a plain
      // browser tab - a game can easily run past the ~1h default token
      // expiry, and without this every action after that starts failing.
      autoRefreshToken: true,
      detectSessionInUrl: false,
    }
  }
);

export async function callGameAction(roomId: string, action: string, extra: object = {}) {
  try {
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
    return await res.json();
  } catch {
    // Network hiccup, expired session, non-JSON error page, etc. - never
    // throw here, or the caller's loading/actInFlight state is left stuck
    // forever (cards greyed out with no way to retry).
    return { error: "Verbindung unterbrochen – bitte erneut versuchen" };
  }
}
