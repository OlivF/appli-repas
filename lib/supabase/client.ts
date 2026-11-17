import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_NAME, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import type { Database } from "./database.types";

// Client Supabase pour les composants exécutés dans le navigateur.
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
  });
}
