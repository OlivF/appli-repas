// Qui peut ouvrir quelle adresse :
// - « guest » : pour les visiteurs ; un compte connecté est renvoyé vers sa semaine ;
// - « open » : pour tout le monde (référence visuelle, pages légales, image de partage, page
//   d'invitation, qui s'adapte au visiteur comme au compte connecté) ;
// - « private » : il faut être connecté, sinon direction la page de connexion.
export type RouteAccess = "guest" | "open" | "private";

const GUEST_PATHS = ["/connexion"];
const OPEN_PATHS = ["/design", "/mentions-legales", "/confidentialite", "/opengraph-image", "/rejoindre"];

const under = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

export function routeAccess(pathname: string): RouteAccess {
  // La page d'accueil : l'adresse exacte seulement (toutes les adresses commencent par « / »).
  if (pathname === "/" || GUEST_PATHS.some((path) => under(pathname, path))) return "guest";
  if (OPEN_PATHS.some((path) => under(pathname, path))) return "open";
  return "private";
}

// Où va un compte connecté qui arrive sur une page pour visiteurs. /semaine renvoie elle-même
// vers le parcours /bienvenue si le foyer n'est pas encore prêt.
export const SIGNED_IN_HOME = "/semaine";
