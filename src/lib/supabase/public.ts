import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Cliente anonimo, sin cookies ni sesion. Se usa para leer la galeria publica:
 * al no tocar `cookies()`, la home puede seguir prerenderizandose y servirse
 * desde el CDN en vez de renderizarse en cada visita.
 */
export function createPublicClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
