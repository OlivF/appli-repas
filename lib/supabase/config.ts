// Même nom de cookie côté navigateur et côté serveur : en dev, les deux joignent
// Supabase par des URL différentes, et le nom par défaut dépend de l'URL.
export const AUTH_COOKIE_NAME = "sb-nos-repas-auth-token";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// En dev, le serveur Next.js tourne dans Docker et joint Supabase via
// SUPABASE_INTERNAL_URL (docker-compose.yml). En prod, elle n'existe pas.
export function serverSupabaseUrl() {
  return process.env.SUPABASE_INTERNAL_URL || SUPABASE_URL;
}
