import { createClient } from "@supabase/supabase-js";

// Detect if running as installed PWA
const isPWA = window.matchMedia("(display-mode: standalone)").matches
  || (window.navigator as any).standalone === true;

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: isPWA,        // only persist in PWA
      autoRefreshToken: isPWA,
      storage: isPWA ? localStorage : {
        // In browser: use memory only (no storage)
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
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
