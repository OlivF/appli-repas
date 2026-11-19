import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// Liste de courses. Un compte neuf : Paul (40 ans), Léa (40 ans, cétogène) et Timothé (16 ans),
// petit-déj et dîner tous les jours.
async function newHousehold(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill("Famille Courses");
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

const DAY_NAMES = ["lundi", "mardi"];

// Un plat de plus au dîner, pour Timothé seul.
async function addDishForTimothe(page: Page, day: number, search: string, title: string) {
  const name = `Ajouter un plat au dîner de ${DAY_NAMES[day]}`;
  await page.locator(`section[data-day="${day}"]`).getByRole("button", { name }).click();
  const dialog = page.getByRole("dialog", { name });
  const lea = dialog.getByRole("button", { name: "Léa mange ce plat" });
  if ((await lea.getAttribute("aria-pressed")) === "true") await lea.click();
  await dialog.getByRole("button", { name: "Timothé mange ce plat" }).click();
  await dialog.getByRole("searchbox").fill(search);
  await dialog.getByRole("button", { name: new RegExp(title) }).click();
  await expect(dialog).toBeHidden();
}

const AISLE_ORDER = [
  "Fruits et légumes",
  "Boucherie",
  "Poissonnerie",
  "Crèmerie",
  "Boulangerie",
  "Épicerie",
  "Surgelés",
  "Boissons",
  "Autre",
];

const row = (page: Page, label: string) => page.getByRole("checkbox", { name: new RegExp(`^${label}`) });

test("la liste suit le menu, cumule, et garde ce qui est coché à la mise à jour", async ({ page }) => {
  await newHousehold(page);
  await page.getByRole("button", { name: "Proposer la semaine" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeVisible();

  // Deux recettes au bœuf haché : des lasagnes lundi soir, un chili mardi soir.
  await addDishForTimothe(page, 0, "lasagnes", "Lasagnes à la bolognaise");
  await addDishForTimothe(page, 1, "chili", "Chili con carne");

  // « Faire les courses » ouvre la liste de la même semaine, créée depuis le menu.
  await page.getByRole("link", { name: "Faire les courses" }).click();
  await expect(page).toHaveURL(/\/courses\?semaine=\d{4}-\d{2}-\d{2}$/);
  const coursesUrl = page.url();
  const week = new URL(coursesUrl).searchParams.get("semaine");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Courses");

  // Cumul : une seule ligne de bœuf haché, pour les deux plats.
  await expect(row(page, "Bœuf haché")).toHaveCount(1);
  await page.getByRole("button", { name: "Plus sur Bœuf haché" }).click();
  const panel = page.getByRole("dialog", { name: "Bœuf haché" });
  await expect(panel).toContainText("Lasagnes à la bolognaise · lun. soir · 1 pers.");
  await expect(panel).toContainText("Chili con carne · mar. soir · 1 pers.");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // Les rayons dans l'ordre du drive (une fois le panneau fermé, la page est de nouveau lisible).
  await expect(page.getByRole("heading", { level: 2, name: "Boucherie" })).toBeVisible();
  const headings = (await page.getByRole("heading", { level: 2 }).allInnerTexts()).map((text) => text.split("\n")[0].trim());
  const aisles = headings.filter((heading) => AISLE_ORDER.includes(heading));
  expect(aisles.length).toBeGreaterThan(2);
  expect(aisles).toEqual(AISLE_ORDER.filter((aisle) => aisles.includes(aisle)));

  // Cocher, et ajouter un article à la main.
  await row(page, "Bœuf haché").click();
  await expect(row(page, "Bœuf haché")).toHaveAttribute("aria-checked", "true");
  await page.getByRole("combobox", { name: "Article à ajouter" }).fill("Bougies");
  await page.getByLabel("Quantité (facultatif)").fill("2");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(row(page, "Bougies")).toContainText("2");

  // Le menu change : le chili de mardi est retiré.
  await page.goto(`/semaine?semaine=${week}`);
  await page.waitForLoadState("networkidle");
  const tuesday = page.locator('section[data-day="1"]');
  const change = page.getByRole("dialog", { name: "Changer le dîner de mardi" });
  // Un clic arrivé avant que la page soit prête ne fait rien : on recommence.
  await expect(async () => {
    await tuesday.getByRole("group").filter({ hasText: "Chili con carne" }).last().getByRole("button", { name: /Chili con carne/ }).click();
    await expect(change).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await change.getByRole("button", { name: "Retirer ce plat" }).click();
  await expect(tuesday.getByRole("group", { name: "Chili con carne" })).toHaveCount(0);

  // La liste ne bouge pas toute seule : un bandeau propose la mise à jour.
  await page.goto(coursesUrl);
  await expect(page.getByText("Le menu a changé")).toBeVisible();
  await expect(row(page, "Bœuf haché")).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Mettre à jour la liste" }).click();
  await expect(page.getByText("Le menu a changé")).toBeHidden();

  // La case cochée (moins de bœuf haché : elle reste cochée) et l'article manuel sont là.
  await expect(row(page, "Bœuf haché")).toHaveAttribute("aria-checked", "true");
  await expect(row(page, "Bougies")).toBeVisible();
  await page.getByRole("button", { name: "Plus sur Bœuf haché" }).click();
  await expect(page.getByRole("dialog", { name: "Bœuf haché" })).not.toContainText("Chili con carne");
  await page.keyboard.press("Escape");

  // Tout est enregistré.
  await page.reload();
  await expect(page.getByText("Le menu a changé")).toBeHidden();
  await expect(row(page, "Bœuf haché")).toHaveAttribute("aria-checked", "true");
  await expect(row(page, "Bougies")).toBeVisible();
});
