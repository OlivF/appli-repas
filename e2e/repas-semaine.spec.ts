import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

// Les repas d'une semaine : le réglage du foyer reste le modèle, une semaine se change depuis
// /semaine (« Qui est là ? », « Un repas en plus », « Tout remettre comme d'habitude »).
// Un compte neuf : Paul (40 ans) et Léa (40 ans, cétogène), petit-déj et dîner tous les jours.
async function newHousehold(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill("Famille Repas");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/membres$/);
  for (const [name, keto] of [
    ["Paul", false],
    ["Léa", true],
  ] as const) {
    await page.getByLabel("Prénom", { exact: true }).fill(name);
    await page.getByLabel("Âge", { exact: true }).fill("40");
    if (keto) await page.getByLabel("Cétogène").check();
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
  await page.getByRole("link", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/repas$/);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/semaine$/);
}

const day = (page: Page, index: number) => page.locator(`section[data-day="${index}"]`);
const meal = (page: Page, index: number, type: string) => day(page, index).locator(`[data-meal="${type}"]`);
const panel = (page: Page) => page.getByRole("dialog");

// Ouvre un panneau (un clic avant que la page soit prête ne fait rien).
async function open(page: Page, button: ReturnType<Page["getByRole"]>) {
  await expect(async () => {
    await button.click();
    await expect(panel(page)).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

test("changer les repas d'une semaine, puis tout remettre comme d'habitude", async ({ page }) => {
  test.slow();
  await newHousehold(page);

  // La semaine prochaine, proposée.
  await page.getByRole("link", { name: "Semaine suivante" }).click();
  await expect(page).toHaveURL(/semaine=\d{4}-\d{2}-\d{2}/);
  const week = new URL(page.url()).searchParams.get("semaine")!;
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Proposer la semaine" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeVisible();
  await expect(meal(page, 0, "soir").getByRole("group").first()).toBeVisible();

  // Lundi soir sans Léa : son plat disparaît, Paul garde le sien.
  await open(page, meal(page, 0, "soir").getByRole("button", { name: "Qui est là au dîner de lundi ?" }));
  await expect(panel(page).getByRole("heading", { name: "Le dîner de lundi" })).toBeVisible();
  await expect(panel(page).getByText("Pour cette semaine seulement.")).toBeVisible();
  await panel(page).getByRole("button", { name: "Léa est là" }).click();
  await expect(panel(page).getByText(/Léa (quittera son plat|sera retiré)|plat de Léa sera retiré/)).toBeVisible();
  await panel(page).getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Dîner de lundi : sans Léa cette semaine")).toBeVisible();
  await expect(meal(page, 0, "soir").getByText("cette semaine", { exact: true })).toBeVisible();
  // Il reste un plat, pour tous sauf elle.
  await expect(meal(page, 0, "soir").getByRole("group")).toHaveCount(1);
  await expect(meal(page, 0, "soir").getByRole("group")).toContainText("Sauf Léa");
  await expect(meal(page, 0, "soir").getByText(/^Rien de prévu pour /)).toBeHidden();

  // « Relancer » ne lui remet rien.
  await page.getByRole("button", { name: "Relancer" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeEnabled();
  await page.reload();
  await expect(meal(page, 0, "soir").getByRole("group")).toHaveCount(1);
  await expect(meal(page, 0, "soir").getByRole("group")).toContainText("Sauf Léa");
  await expect(meal(page, 0, "soir").getByText("cette semaine", { exact: true })).toBeVisible();

  // Samedi : un midi en plus, pour tous.
  await open(page, day(page, 5).getByRole("button", { name: "Un repas en plus samedi" }));
  await expect(panel(page).getByRole("radio", { name: "Midi" })).toBeChecked();
  await expect(panel(page).getByRole("button", { name: "Paul est là" })).toHaveAttribute("aria-pressed", "true");
  await expect(panel(page).getByRole("button", { name: "Léa est là" })).toHaveAttribute("aria-pressed", "true");
  await panel(page).getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Midi de samedi ajouté")).toBeVisible();
  await expect(meal(page, 5, "midi").getByRole("button", { name: "Choisir le midi de samedi" })).toBeVisible();

  // Dimanche : pas de dîner.
  await open(page, meal(page, 6, "soir").getByRole("button", { name: "Qui est là au dîner de dimanche ?" }));
  await panel(page).getByRole("button", { name: "Pas de dîner ce jour-là" }).click();
  await expect(page.getByText("Pas de dîner dimanche cette semaine")).toBeVisible();
  await expect(meal(page, 6, "soir")).toHaveCount(0);

  // La semaine d'après n'a pas bougé.
  const after = new Date(`${week}T12:00:00Z`);
  after.setUTCDate(after.getUTCDate() + 7);
  await page.goto(`/semaine?semaine=${after.toISOString().slice(0, 10)}`);
  await expect(page.getByRole("button", { name: "Proposer la semaine" }).first()).toBeVisible();
  await expect(page.getByText("Cette semaine ne suit pas tout à fait le foyer")).toBeHidden();
  await expect(meal(page, 6, "soir")).toHaveCount(1);
  await expect(meal(page, 5, "midi")).toHaveCount(0);

  // Le foyer n'a pas bougé : le dîner, tous les jours, pour tout le monde.
  await page.goto("/foyer");
  await expect(page.getByText("C’est le modèle de toutes les semaines.", { exact: false })).toBeVisible();
  await expect(page.getByText("tous les jours").first()).toBeVisible();
  await expect(page.getByText("Midi", { exact: true })).toHaveCount(0);

  // Tout remettre comme d'habitude.
  await page.goto(`/semaine?semaine=${week}`);
  await expect(page.getByText("Cette semaine ne suit pas tout à fait le foyer")).toBeVisible();
  await open(page, page.getByRole("button", { name: "Tout remettre comme d’habitude" }));
  await expect(panel(page).getByText("Dîner de lundi : sans Léa")).toBeVisible();
  await expect(panel(page).getByText("Midi de samedi : ajouté")).toBeVisible();
  await expect(panel(page).getByText("Pas de dîner dimanche")).toBeVisible();
  await panel(page).getByRole("button", { name: "Tout remettre", exact: true }).click();
  await expect(page.getByText("Les repas suivent à nouveau le foyer")).toBeVisible();
  await expect(meal(page, 0, "soir").getByText("Rien de prévu pour Léa.")).toBeVisible();
  await expect(meal(page, 5, "midi")).toHaveCount(0);
  await expect(meal(page, 6, "soir").getByRole("button", { name: "Choisir le dîner de dimanche" })).toBeVisible();
  await expect(page.getByText("cette semaine", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(meal(page, 0, "soir").getByText("Rien de prévu pour Léa.")).toBeVisible();
  await expect(page.getByText("Cette semaine ne suit pas tout à fait le foyer")).toBeHidden();
});
