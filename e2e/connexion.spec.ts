import { expect, test } from "@playwright/test";

test("sans session, on est envoyé vers la page de connexion", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole("heading", { name: "Popote" })).toBeVisible();
});

test("un mauvais mot de passe affiche une erreur", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Mot de passe").fill("pas-le-bon");
  await page.getByRole("button", { name: "Se connecter" }).click();

  // Next.js ajoute son propre role="alert" (annonce des changements de page) : on cible le formulaire.
  await expect(page.locator("form").getByRole("alert")).toHaveText("Email ou mot de passe incorrect.");
  await expect(page).toHaveURL(/\/connexion$/);
});

test("le compte de test retrouve le foyer de CLAUDE.md", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Se connecter" }).click();

  // L'accueil, c'est la semaine ; le foyer a son onglet.
  await expect(page).toHaveURL(/\/semaine$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("La semaine");
  await page.getByRole("link", { name: "Foyer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Foyer de test");

  const household = page.getByRole("region", { name: "Le foyer" });
  await expect(household.getByRole("listitem")).toHaveText([
    /Olivier\s*40 ans/,
    /Marie-Laure\s*40 ans, cétogène/,
    /Timothé\s*16 ans, grand appétit/,
    /Anna-Lucia\s*9 ans/,
    /Otis\s*6 ans/,
  ]);

  const meals = page.getByRole("region", { name: "Les repas de la semaine" });
  await expect(meals.getByRole("listitem")).toHaveText([
    /Tout le monde\s*tous les jours/, // petit-déj
    /Marie-Laure\s*lundi, mardi, jeudi et vendredi/, // midi
    /Anna-Lucia et Otis\s*mercredi/, // pique-nique
    /Tout le monde\s*tous les jours/, // dîner
  ]);
});
