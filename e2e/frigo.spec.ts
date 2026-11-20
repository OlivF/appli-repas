import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// Le frigo. Un compte neuf : Paul (40 ans), Léa (40 ans, cétogène) et Timothé (16 ans), petit-déj
// et dîner tous les jours. Le bilan de fin de semaine se teste en Vitest et pgTAP (pas besoin de
// faire passer le temps ici).
async function newHousehold(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill("Famille Frigo");
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

// Ranger un ingrédient du référentiel : la suggestion, la quantité, une puce de date, « Ranger ».
async function addToFridge(page: Page, typed: string, name: string, quantity: string, date: string) {
  const field = page.getByRole("combobox", { name: "Ce que tu ranges" });
  await expect(async () => {
    await field.fill(typed);
    await expect(page.getByRole("option", { name: new RegExp(`^${name}`) })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  const sheet = page.getByRole("dialog", { name });
  await sheet.getByRole("textbox", { name: /Quantité/ }).fill(quantity);
  await sheet.getByText(date, { exact: true }).click();
  await sheet.getByRole("button", { name: "Ranger" }).click();
  await expect(sheet).toBeHidden();
}

const DAY_NAMES = ["lundi", "mardi", "mercredi"];

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

const row = (page: Page, label: string) => page.getByRole("checkbox", { name: new RegExp(`^${label}`) });

test("le frigo : à finir vite, déduit de la liste, rangé après les courses", async ({ page }) => {
  test.setTimeout(120_000);
  await newHousehold(page);

  // 200 g de crème à finir demain : « À finir vite », et la pastille de l'onglet.
  await page.goto("/frigo");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Rien au frigo pour l’instant")).toBeVisible();
  await addToFridge(page, "crème fr", "Crème fraîche épaisse", "200", "Demain");
  const urgent = page.getByRole("region", { name: "À finir vite" });
  await expect(urgent.getByRole("button", { name: "Fini : Crème fraîche épaisse" })).toBeVisible();
  await expect(urgent).toContainText("200 g");
  await expect(page.getByRole("link", { name: "Frigo, 1 article à finir vite" })).toBeVisible();

  // La semaine en cours (une crème qui périme demain ne compte pas pour la semaine prochaine),
  // avec un plat à la crème trois soirs pour Timothé (au moins 225 g).
  await page.goto("/semaine");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByRole("link", { name: "Semaine précédente" }).click();
    await expect(page.getByText("Cette semaine", { exact: true })).toBeVisible({ timeout: 2_000 });
  }).toPass();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Proposer la semaine" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeVisible();
  for (const day of [0, 1, 2]) await addDishForTimothe(page, day, "poulet à la crème", "Poulet à la crème et aux champignons");

  // La liste compte sur le frigo : la crème à acheter, plus 200 g au frigo.
  await page.getByRole("link", { name: "Faire les courses" }).first().click();
  await expect(page).toHaveURL(/\/courses\?semaine=\d{4}-\d{2}-\d{2}$/);
  const coursesUrl = page.url();
  await expect(row(page, "Crème fraîche épaisse")).toContainText("+ 200 g au frigo");

  // 1 kg de plus au frigo : la liste propose de se mettre à jour, la crème est déjà à la maison.
  await page.goto("/frigo");
  await page.waitForLoadState("networkidle");
  await addToFridge(page, "crème fr", "Crème fraîche épaisse", "1000", "Dans 1 semaine");
  await page.goto(coursesUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Le frigo a changé")).toBeVisible();
  await page.getByRole("button", { name: "Mettre à jour la liste" }).click();
  await expect(page.getByText("Le frigo a changé")).toBeHidden();
  await expect(row(page, "Crème fraîche épaisse")).toHaveCount(0);
  await page.getByRole("button", { name: /Déjà à la maison/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Crème fraîche épaisse" })).toContainText("au frigo");

  // Tout cocher : « Courses faites ? Range-les au frigo ».
  const unchecked = page.getByRole("checkbox", { checked: false });
  while ((await unchecked.count()) > 0) await unchecked.first().click();
  const card = page.getByRole("region", { name: "Ranger les courses" });
  await expect(card).toContainText("Courses faites ? Range-les au frigo");
  await card.getByRole("button", { name: "Ranger" }).click();
  const sheet = page.getByRole("dialog", { name: "Ranger au frigo" });
  await expect(sheet.getByRole("checkbox", { name: /^Échalotes/ })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", { name: /^Ranger \d+ articles?$/ }).click();
  await expect(sheet).toBeHidden();
  await expect(card).toBeHidden();

  // Au frigo, rangés pour le menu de la semaine.
  await page.goto("/frigo");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Pour le menu de la semaine/ }).click();
  await expect(page.getByRole("button", { name: "Fini : Échalotes" })).toBeVisible();

  // « Fini », puis « Annuler » : la crème revient.
  await urgent.getByRole("button", { name: "Fini : Crème fraîche épaisse" }).click();
  await expect(urgent.getByRole("button", { name: "Fini : Crème fraîche épaisse" })).toHaveCount(0);
  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(urgent.getByRole("button", { name: "Fini : Crème fraîche épaisse" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "À finir vite" }).getByRole("button", { name: "Fini : Crème fraîche épaisse" })).toBeVisible();
});
