import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, SUPABASE_ANON_KEY, serverSupabaseUrl } from "./config";

// Pages accessibles sans être connecté.
const PUBLIC_PATHS = ["/connexion"];

// Rafraîchit la session Supabase à chaque requête et protège les pages privées.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(serverSupabaseUrl(), SUPABASE_ANON_KEY, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Rien entre createServerClient et getClaims : c'est cet appel qui rafraîchit la session.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!isLoggedIn && !isPublic) return redirectKeepingCookies(request, "/connexion", response);
  if (isLoggedIn && isPublic) return redirectKeepingCookies(request, "/", response);

  return response;
}

function redirectKeepingCookies(request: NextRequest, pathname: string, from: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
