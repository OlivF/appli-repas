import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

// Desserts, fruits, fromages. Un compte neuf, le foyer de test : Olivier, Marie-Laure (céto),
// Timothé, Anna-Lucia et Otis ; le dîner tous les jours (pas de petit-déj : aucun plat proposé
// n'apporte alors de yaourts ni de pommes, les totaux des courses sont exacts) et le pique-nique
// du mercredi pour Anna-Lucia et Otis.
const FAMILY = [
  ["Olivier", "40", false],
  ["Marie-Laure", "40", true],
  ["Timothé", "16", false],
  ["Anna-Lucia", "9", false],
  ["Otis", "6", false],
] as const;
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

async function newHousehold(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill("Famille Desserts");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/membres$/);
  for (const [name, age, keto] of FAMILY) {
    await page.getByLabel("Prénom", { exact: true }).fill(name);
    await page.getByLabel("Âge", { exact: true }).fill(age);
    if (keto) await page.getByLabel("Cétogène").check();
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
  await page.getByRole("link", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/repas$/);
  for (const day of DAYS) {
    for (const [name] of FAMILY) await page.getByRole("checkbox", { name: `Petit-déj ${day} : ${name}` }).uncheck();
  }
  for (const name of ["Anna-Lucia", "Otis"]) {
    await page.getByRole("checkbox", { name: `Pique-nique mercredi : ${name}` }).check();
  }
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/semaine$/);
}

// Ouvre le panneau « Dessert, fruit… » d'un repas (un clic avant que la page soit prête ne fait rien).
async function openExtras(page: Page, day: number, meal: string): Promise<Locator> {
  const button = page
    .locator(`section[data-day="${day}"]`)
    .getByRole("button", { name: `Ajouter un dessert, un fruit… ${meal} de ${DAYS[day]}` });
  const panel = page.getByRole("dialog", { name: new RegExp(`^Pour finir`) });
  await expect(async () => {
    await button.click();
    await expect(panel).toBeVisible({ timeout: 1_000 });
  }).toPass();
  return panel;
}

test("desserts et fruits à tous les dîners, une ligne pour Marie-Laure, et les courses", async ({ page }) => {
  // Un parcours complet : semaine, panneau, courses, frigo.
  test.slow();
  await newHousehold(page);

  // La semaine prochaine, proposée.
  await page.getByRole("link", { name: "Semaine suivante" }).click();
  await expect(page).toHaveURL(/semaine=\d{4}-\d{2}-\d{2}/);
  const week = new URL(page.url()).searchParams.get("semaine");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Proposer la semaine" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeVisible();

  // « Yaourt nature » et « Pomme » à tous les dîners, pour toute la famille.
  let panel = await openExtras(page, 0, "au dîner");
  await expect(panel.getByRole("heading", { name: "Pour finir le dîner de lundi" })).toBeVisible();
  await panel.getByText("Yaourt nature", { exact: true }).click();
  await panel.getByText("Fruit", { exact: true }).click();
  await panel.getByText("Pomme", { exact: true }).click();
  await panel.getByText("Tous les dîners de la semaine").click();
  await panel.getByRole("button", { name: "Ajouter à 7 dîners" }).click();

  // Ni l'un ni l'autre ne va à Marie-Laure (céto) : on lui propose ce qui lui va.
  const line = panel.getByRole("group", { name: "Et pour Marie-Laure ?" });
  await expect(line).toBeVisible();
  await line.getByRole("button", { name: /Comté/ }).click();
  await expect(panel).toBeHidden();

  const monday = page.locator('section[data-day="0"]');
  await expect(monday.getByRole("button", { name: /^Laitage : Yaourt nature/ })).toBeVisible();
  await expect(monday.getByRole("button", { name: /^Fruit : Pomme/ })).toBeVisible();
  await expect(monday.getByRole("button", { name: "Fromage : Comté, pour Marie-Laure" })).toBeVisible();
  await expect(page.locator('section[data-day="6"]').getByRole("button", { name: /^Fromage : Comté/ })).toBeVisible();

  // Des clémentines au pique-nique du mercredi. La puce s'affiche tout de suite, puis reste la même
  // quand le serveur répond : jamais deux puces à la fois (on compte à chaque changement de la page).
  panel = await openExtras(page, 2, "au pique-nique");
  await panel.getByText("Fruit", { exact: true }).click();
  await panel.getByText("Clémentines", { exact: true }).click();
  await page.evaluate(() => {
    const chips = () =>
      [...document.querySelectorAll('section[data-day="2"] button[aria-label^="Fruit : Clémentines"]')].filter(
        (chip) => chip.getClientRects().length > 0,
      ).length;
    const counter = window as typeof window & { mostChips?: number };
    counter.mostChips = 0;
    new MutationObserver(() => {
      counter.mostChips = Math.max(counter.mostChips ?? 0, chips());
    }).observe(document.body, { childList: true, subtree: true });
  });
  await panel.getByRole("button", { name: "Ajouter 1" }).click();
  await expect(panel).toBeHidden();
  await expect(page.locator('section[data-day="2"]').getByRole("button", { name: /^Fruit : Clémentines/ })).toBeVisible();
  // Le message arrive avec la réponse du serveur.
  await expect(page.getByText("Ajouté au pique-nique de mercredi")).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { mostChips?: number }).mostChips)).toBe(1);

  // « Relancer » change les plats, pas les desserts.
  await page.getByRole("button", { name: "Relancer" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeEnabled();
  await page.reload();
  await expect(monday.getByRole("button", { name: /^Laitage : Yaourt nature/ })).toBeVisible();
  await expect(page.locator('section[data-day="2"]').getByRole("button", { name: /^Fruit : Clémentines/ })).toBeVisible();

  // Les courses : un yaourt et une pomme par mangeur, sans coefficient (7 dîners × 4 : Marie-Laure
  // n'en a pas) ; deux clémentines pour chacun des deux enfants.
  await page.goto(`/courses?semaine=${week}`);
  await expect(page.getByRole("checkbox", { name: "Yaourts nature 28" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Clémentines 4" })).toBeVisible();
  await page.getByRole("button", { name: "Plus sur Yaourts nature" }).click();
  let details = page.getByRole("dialog", { name: "Yaourts nature" });
  await expect(details).toContainText("Yaourt nature · lun. soir · 4 pers.");
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  // Un plat du pique-nique peut aussi demander des pommes : on compte les sept dîners.
  await page.getByRole("button", { name: "Plus sur Pommes", exact: true }).click();
  details = page.getByRole("dialog", { name: "Pommes" });
  await expect(details.getByText(/^Pomme · \S+ soir · 4 pers\.$/)).toHaveCount(7);
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  // 30 g de comté pour Marie-Laure à 7 dîners : 210 g, un morceau.
  await expect(page.getByRole("checkbox", { name: "Comté 1" })).toBeVisible();

  // Courses faites : yaourts, clémentines et comté se rangent au frigo comme le reste.
  const unchecked = page.getByRole("checkbox", { checked: false });
  while ((await unchecked.count()) > 0) await unchecked.first().click();
  const card = page.getByRole("region", { name: "Ranger les courses" });
  await card.getByRole("button", { name: "Ranger" }).click();
  const store = page.getByRole("dialog", { name: "Ranger au frigo" });
  await store.getByRole("button", { name: /^Ranger \d+ articles?$/ }).click();
  await expect(store).toBeHidden();
  await page.goto("/frigo");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Pour le menu de la semaine/ }).click();
  for (const name of ["Yaourts nature", "Clémentines", "Comté"]) {
    await expect(page.getByRole("button", { name: `Fini : ${name}` })).toBeVisible();
  }

  // Retirer une puce.
  await page.goto(`/semaine?semaine=${week}`);
  await page.waitForLoadState("networkidle");
  const chip = monday.getByRole("button", { name: /^Fruit : Pomme/ });
  const sheet = page.getByRole("dialog", { name: "Pomme" });
  await expect(async () => {
    await chip.click();
    await expect(sheet).toBeVisible({ timeout: 1_000 });
  }).toPass();
  // La puce part tout de suite de l'écran ; on attend que le serveur ait retiré le fruit avant de
  // recharger (recharger plus tôt interromprait l'enregistrement).
  const removed = page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/semaine"));
  await sheet.getByRole("button", { name: "Retirer" }).click();
  await expect(chip).toHaveCount(0);
  await removed;
  await page.reload();
  await expect(monday.getByRole("button", { name: /^Laitage : Yaourt nature/ })).toBeVisible();
  await expect(monday.getByRole("button", { name: /^Fruit : Pomme/ })).toHaveCount(0);
});
