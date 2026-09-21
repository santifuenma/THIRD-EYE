import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Cliente de Supabase para el navegador. Comparte la sesion por cookie con el
 * cliente de servidor, asi que el login hecho aqui lo ven las server actions.
 */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
