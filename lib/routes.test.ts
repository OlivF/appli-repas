import { describe, expect, it } from "vitest";
import { routeAccess } from "./routes";

describe("routeAccess", () => {
  it("réserve l'accueil et la connexion aux visiteurs", () => {
    expect(routeAccess("/")).toBe("guest");
    expect(routeAccess("/connexion")).toBe("guest");
    expect(routeAccess("/connexion/inscription")).toBe("guest");
  });

  it("ouvre à tous la référence visuelle, les pages légales et l'image de partage", () => {
    expect(routeAccess("/design")).toBe("open");
    expect(routeAccess("/mentions-legales")).toBe("open");
    expect(routeAccess("/confidentialite")).toBe("open");
    expect(routeAccess("/opengraph-image")).toBe("open");
  });

  it("garde le reste pour les comptes connectés", () => {
    expect(routeAccess("/semaine")).toBe("private");
    expect(routeAccess("/parametres")).toBe("private");
    expect(routeAccess("/bienvenue/membres")).toBe("private");
    // Un préfixe qui ressemble ne suffit pas.
    expect(routeAccess("/connexionx")).toBe("private");
    expect(routeAccess("/designer")).toBe("private");
  });
});
