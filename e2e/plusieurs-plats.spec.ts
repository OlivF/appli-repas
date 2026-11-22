import { expect, test, type Page } from "@playwright/test";

// Plusieurs plats sur un même repas. Un compte neuf : Paul (40 ans), Léa (40 ans, cétogène)
// et Timothé (16 ans), petit-déj et dîner tous les jours.
async function newHousehold(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill("Famille Plats");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/membres$/);
  for (const [name, age, keto] of [
    ["Paul", "40", false],
    ["Léa", "40", true],
    ["Timothé", "16", false],
  ] as const) {
    await page.getByLabel("Prénom", { exact: true }).fill(name);
    await page.getByLabel("Âge", { exact: true }).fill(age);
    if (keto) await page.getByLabel("Cétogène").check();
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
  await page.getByRole("link", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/repas$/);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/semaine$/);
}

const monday = (page: Page) => page.locator('section[data-day="0"]');
// Les plats du dîner viennent après ceux du petit-déj : le dernier qui correspond.
const dish = (page: Page, text: string) => monday(page).getByRole("group").filter({ hasText: text }).last();

test("un duo le lundi soir, un plat pour Timothé, qui mange quoi, retirer un plat", async ({ page }) => {
  await newHousehold(page);
  await page.getByRole("button", { name: "Proposer la semaine" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeVisible();

  // Lundi soir : un plat pour Paul et Timothé, le plat céto de même base pour Léa (le petit-déj
  // peut avoir son propre duo, d'œufs coque par exemple).
  await expect(monday(page).locator('[data-meal="soir"]').getByText(/^Même base : /)).toBeVisible();
  await expect(dish(page, "Sauf Léa")).toBeVisible();
  await expect(dish(page, "Pour Léa")).not.toContainText("Ne convient pas");

  // + Ajouter un plat : Léa est pré-cochée (elle a un régime) ; on coche Timothé à sa place.
  await monday(page).getByRole("button", { name: "Ajouter un plat au dîner de lundi" }).click();
  const add = page.getByRole("dialog", { name: "Ajouter un plat au dîner de lundi" });
  await expect(add.getByRole("button", { name: "Léa mange ce plat" })).toHaveAttribute("aria-pressed", "true");
  await add.getByRole("button", { name: "Léa mange ce plat" }).click();
  await add.getByRole("button", { name: "Timothé mange ce plat" }).click();
  await add.getByRole("searchbox").fill("lasagnes");
  await add.getByRole("button", { name: /Lasagnes à la bolognaise/ }).click();
  await expect(add).toBeHidden();

  // Timothé a son plat, et quitte celui de Paul.
  await expect(dish(page, "Pour Timothé")).toHaveAttribute("aria-label", "Lasagnes à la bolognaise");
  await expect(dish(page, "Pour Paul")).toBeVisible();

  // Qui mange ce plat ? Paul rejoint Léa : son plat, vide, disparaît.
  await dish(page, "Pour Léa").getByRole("button", { name: /^Qui mange ce plat/ }).click();
  const eaters = page.getByRole("dialog", { name: "Qui mange ce plat ?" });
  await expect(eaters.getByRole("button", { name: "Léa mange ce plat" })).toHaveAttribute("aria-pressed", "true");
  await eaters.getByRole("button", { name: "Paul mange ce plat" }).click();
  await eaters.getByRole("button", { name: "Valider" }).click();
  await expect(eaters).toBeHidden();
  await expect(dish(page, "Sauf Timothé")).toBeVisible();
  await expect(monday(page).getByRole("group").filter({ hasText: "Pour Paul" })).toHaveCount(0);

  // Retirer ce plat : Timothé n'a plus rien de prévu.
  await dish(page, "Pour Timothé").getByRole("button", { name: /Lasagnes à la bolognaise/ }).click();
  await page.getByRole("dialog", { name: "Changer le dîner de lundi" }).getByRole("button", { name: "Retirer ce plat" }).click();
  await expect(monday(page).getByRole("group", { name: "Lasagnes à la bolognaise" })).toHaveCount(0);
  await expect(monday(page).getByText("Rien de prévu pour Timothé.")).toBeVisible();

  // Tout est enregistré.
  await page.reload();
  await expect(dish(page, "Sauf Timothé")).toBeVisible();
  await expect(monday(page).getByText("Rien de prévu pour Timothé.")).toBeVisible();
});
