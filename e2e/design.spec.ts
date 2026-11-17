import { expect, test } from "@playwright/test";

// L'utilitaire `press` fait rebondir les boutons au toucher (courbe qui dépasse sa cible).
// Appliquée aux couleurs, cette courbe fait dépasser puis revenir le fond au survol :
// l'élément clignote. Seule la taille (transform) doit rebondir.
test("au survol, les couleurs changent sans rebondir", async ({ page }) => {
  await page.goto("/design");
  const curves = await page.getByRole("button", { name: "Continuer" }).evaluate((element) => {
    const style = getComputedStyle(element);
    const properties = style.transitionProperty.split(",").map((property) => property.trim());
    const functions = style.transitionTimingFunction.split(/,(?![^(]*\))/).map((curve) => curve.trim());
    return Object.fromEntries(properties.map((property, index) => [property, functions[index % functions.length]]));
  });

  // Une courbe de Bézier dont une ordonnée sort de [0, 1] dépasse sa valeur d'arrivée.
  const overshoots = (curve: string) => {
    const match = /cubic-bezier\(([^)]*)\)/.exec(curve);
    if (!match) return false;
    const [, y1, , y2] = match[1].split(",").map(Number);
    return y1 < 0 || y1 > 1 || y2 < 0 || y2 > 1;
  };

  for (const property of ["background-color", "border-color", "color", "box-shadow"]) {
    expect(overshoots(curves[property]), `${property} : ${curves[property]}`).toBe(false);
  }
  expect(overshoots(curves.transform), "le rebond reste sur la taille").toBe(true);
});
