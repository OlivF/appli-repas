import type { MetadataRoute } from "next";

// Les moteurs de recherche voient l'accueil, la connexion et les pages légales ; le reste
// demande un compte.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/semaine", "/recettes", "/courses", "/foyer", "/parametres", "/bienvenue"],
    },
  };
}
