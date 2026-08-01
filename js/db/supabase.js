import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kqbnpootgklsxgkqslsr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UbUdoNRBwKypnfcI1stQTQ_UtWnvA0K";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}
