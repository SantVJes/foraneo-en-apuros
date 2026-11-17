import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Cliente de Supabase en el navegador. Sin variables configuradas, la web usa el login propio de Django (modo local). */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true } }) : null;
