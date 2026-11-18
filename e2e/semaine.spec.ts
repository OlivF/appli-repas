import { expect, test, type Page } from "@playwright/test";

// Un compte neuf et son foyer : Paul (40 ans) et Léa (40 ans, cétogène), petit-déj et dîner
// tous les jours. Chaque test a le sien, pour ne rien changer au foyer de test partagé.
async function newHousehold(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill("Famille Semaine");
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/membres$/);
  await page.getByLabel("Prénom", { exact: true }).fill("Paul");
  await page.getByLabel("Âge", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Paul" })).toBeVisible();
  await page.getByLabel("Prénom", { exact: true }).fill("Léa");
  await page.getByLabel("Âge", { exact: true }).fill("40");
  await page.getByLabel("Cétogène").check();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Léa" })).toBeVisible();
  await page.getByRole("link", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/repas$/);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/semaine$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("La semaine");
}

const day = (page: Page, index: number) => page.locator(`section[data-day="${index}"]`);
// Dans une journée : petit-déj, puis dîner (la dernière carte).
const dinner = (page: Page, index: number) => day(page, index).getByRole("group").last();

async function propose(page: Page) {
  await page.getByRole("button", { name: "Proposer la semaine" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeVisible();
  // Au moins le petit-déj et le dîner chaque jour (le dimanche, Léa a souvent son plat à part :
  // le catalogue n'a que 3 petits-déj et 6 dîners céto).
  for (const index of [0, 1, 2, 3, 4, 5, 6]) {
    await expect.poll(() => day(page, index).getByRole("group").count()).toBeGreaterThanOrEqual(2);
  }
  await expect(day(page, 0).getByRole("group")).toHaveCount(2);
}

test("proposer la semaine, verrouiller un plat, relancer", async ({ page }) => {
  await newHousehold(page);
  await expect(page.getByText("Semaine prochaine")).toBeVisible();
  await expect(day(page, 0).getByRole("button", { name: /^Choisir le dîner de lundi/ })).toBeVisible();

  await propose(page);
  // Céto pour tous : un seul plat par repas, que Léa peut manger.
  await expect(dinner(page, 0)).toContainText("Pour tout le monde");
  await expect(dinner(page, 0)).not.toContainText("Ne convient pas");

  const kept = await dinner(page, 0).getAttribute("aria-label");
  await dinner(page, 0).getByRole("button", { name: "Verrouiller" }).click();
  await expect(dinner(page, 0).getByRole("button", { name: "Déverrouiller" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Relancer" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeEnabled();
  await expect(dinner(page, 0)).toHaveAttribute("aria-label", kept!);
  await expect(dinner(page, 0).getByRole("button", { name: "Déverrouiller" })).toBeVisible();

  // Tout est enregistré : on le retrouve en revenant.
  await page.reload();
  await expect(dinner(page, 0)).toHaveAttribute("aria-label", kept!);

  // La semaine suivante est encore vide.
  await page.getByRole("link", { name: "Semaine suivante" }).click();
  await expect(page).toHaveURL(/semaine=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("button", { name: "Proposer la semaine" }).first()).toBeVisible();
  await expect(page.getByText("Semaine prochaine")).toHaveCount(0);
});

test("« Autre idée » change le plat", async ({ page }) => {
  await newHousehold(page);
  await propose(page);

  const before = await dinner(page, 0).getAttribute("aria-label");
  await dinner(page, 0).getByRole("button", { name: "Autre idée" }).click();
  await expect(dinner(page, 0)).not.toHaveAttribute("aria-label", before!);
  await expect(dinner(page, 0)).not.toContainText("Ne convient pas");
});

test("choisir un plat dans la Bibliothèque", async ({ page }) => {
  await newHousehold(page);
  await propose(page);

  // Toucher la carte ouvre la Bibliothèque, filtrée sur le dîner.
  await dinner(page, 0).getByRole("button").first().click();
  const sheet = page.getByRole("dialog", { name: "Changer le dîner de lundi" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Lasagnes à la bolognaise/ })).toContainText("Ne convient pas à Léa");
  await sheet.getByRole("searchbox").fill("pizza");
  await sheet.getByRole("button", { name: /Pizza à la pâte de mozzarella/ }).click();

  await expect(sheet).toBeHidden();
  await expect(dinner(page, 0)).toHaveAttribute("aria-label", "Pizza à la pâte de mozzarella");
  // Choisie à la main : elle est gardée si l'on relance.
  await expect(dinner(page, 0).getByRole("button", { name: "Déverrouiller" })).toBeVisible();

  // Un plat verrouillé se change quand même par la Bibliothèque, et reste verrouillé.
  await dinner(page, 0).getByRole("button").first().click();
  await sheet.getByRole("searchbox").fill("saumon");
  await sheet.getByRole("button", { name: /Saumon au four/ }).click();
  await expect(sheet).toBeHidden();
  await expect(dinner(page, 0)).toHaveAttribute("aria-label", "Saumon au four, beurre citronné et brocolis");
  await page.reload();
  await expect(dinner(page, 0)).toHaveAttribute("aria-label", "Saumon au four, beurre citronné et brocolis");
  await expect(dinner(page, 0).getByRole("button", { name: "Déverrouiller" })).toBeVisible();
});

test.describe("sur ordinateur", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

  test("glisser un plat sur un autre les échange", async ({ page }) => {
    await newHousehold(page);
    await propose(page);

    const monday = await dinner(page, 0).getAttribute("aria-label");
    const tuesday = await dinner(page, 1).getAttribute("aria-label");
    await dinner(page, 0).scrollIntoViewIfNeeded();
    const from = (await dinner(page, 0).boundingBox())!;
    const to = (await dinner(page, 1).boundingBox())!;

    await page.mouse.move(from.x + from.width / 2, from.y + from.height - 20);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height - 20, { steps: 5 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();

    await expect(dinner(page, 0)).toHaveAttribute("aria-label", tuesday!);
    await expect(dinner(page, 1)).toHaveAttribute("aria-label", monday!);
    await page.reload();
    await expect(dinner(page, 0)).toHaveAttribute("aria-label", tuesday!);
  });
});

test("sur téléphone, la barre d'onglets est collée au bas de l'écran", async ({ page }) => {
  await newHousehold(page);
  // Même tout en bas de la page : rien ne doit défiler sous la barre ni à côté.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  const box = (await nav.boundingBox())!;
  const screen = page.viewportSize()!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(screen.width);
  expect(box.y + box.height).toBeCloseTo(screen.height, 0);
});
