import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, SUPABASE_ANON_KEY, serverSupabaseUrl } from "./config";
import type { Database } from "./database.types";

// Client Supabase pour les Server Components et les Server Actions.
// À créer à chaque requête : il lit les cookies de la requête en cours.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(serverSupabaseUrl(), SUPABASE_ANON_KEY, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component, qui ne peut pas écrire de cookie :
          // sans conséquence, le proxy rafraîchit déjà la session.
        }
      },
    },
  });
}
