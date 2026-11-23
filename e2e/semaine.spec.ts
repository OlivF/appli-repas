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
// Dans une journée : petit-déj, puis dîner ; la dernière carte est le dernier plat du dîner.
const dinner = (page: Page, index: number) => day(page, index).getByRole("group").last();

async function propose(page: Page) {
  await page.getByRole("button", { name: "Proposer la semaine" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeVisible();
  // Au moins le petit-déj et le dîner chaque jour ; souvent un plat pour Paul et un plat céto
  // pour Léa.
  for (const index of [0, 1, 2, 3, 4, 5, 6]) {
    await expect.poll(() => day(page, index).getByRole("group").count()).toBeGreaterThanOrEqual(2);
  }
}

test("proposer la semaine, verrouiller un plat, relancer", async ({ page }) => {
  await newHousehold(page);
  await expect(page.getByText("Semaine prochaine")).toBeVisible();
  await expect(day(page, 0).getByRole("button", { name: /^Choisir le dîner de lundi/ })).toBeVisible();

  await propose(page);
  // Lundi soir : un duo de même base, le plat céto pour Léa (le petit-déj peut avoir le sien).
  await expect(day(page, 0).locator('[data-meal="soir"]').getByText(/^Même base : /)).toBeVisible();
  await expect(dinner(page, 0)).not.toContainText("Ne convient pas");

  const kept = await dinner(page, 0).getAttribute("aria-label");
  await dinner(page, 0).getByRole("button", { name: "Verrouiller" }).click();
  await expect(dinner(page, 0).getByRole("button", { name: "Déverrouiller" })).toHaveAttribute("aria-pressed", "true");

  // Relancer garde le plat verrouillé ; l'autre plat du dîner se refait autour de lui.
  await page.getByRole("button", { name: "Relancer" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeEnabled();
  const keptCard = day(page, 0).getByRole("group", { name: kept!, exact: true });
  await expect(keptCard.getByRole("button", { name: "Déverrouiller" })).toBeVisible();

  // Tout est enregistré : on le retrouve en revenant.
  await page.reload();
  await expect(keptCard.getByRole("button", { name: "Déverrouiller" })).toBeVisible();

  // La semaine suivante est encore vide.
  await page.getByRole("link", { name: "Semaine suivante" }).click();
  await expect(page).toHaveURL(/semaine=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("button", { name: "Proposer la semaine" }).first()).toBeVisible();
  await expect(page.getByText("Semaine prochaine")).toHaveCount(0);
});

test("vider la semaine garde les plats verrouillés et les desserts", async ({ page }) => {
  await newHousehold(page);
  await propose(page);

  // Lundi soir : un plat verrouillé et un Comté pour tous les deux.
  const kept = await dinner(page, 0).getAttribute("aria-label");
  await dinner(page, 0).getByRole("button", { name: "Verrouiller" }).click();
  await expect(dinner(page, 0).getByRole("button", { name: "Déverrouiller" })).toBeVisible();

  const extras = day(page, 0).getByRole("button", { name: "Ajouter un dessert, un fruit… au dîner de lundi" });
  const panel = page.getByRole("dialog", { name: /^Pour finir/ });
  await expect(async () => {
    await extras.click();
    await expect(panel).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await panel.getByText("Fromage", { exact: true }).click();
  await panel.getByText("Comté", { exact: true }).click();
  await panel.getByRole("button", { name: "Ajouter 1" }).click();
  await expect(panel).toBeHidden();
  const cheese = day(page, 0).getByRole("button", { name: /^Fromage : Comté/ });
  await expect(cheese).toBeVisible();

  // On vide : seuls le plat verrouillé et le Comté restent.
  await page.getByRole("button", { name: "Vider la semaine" }).click();
  const confirm = page.getByRole("dialog", { name: "Vider la semaine ?" });
  await expect(confirm).toContainText(/plats? partent?\./);
  await confirm.getByRole("button", { name: "Vider", exact: true }).click();
  await expect(page.getByText(/plats? retirés?/)).toBeVisible();

  const keptCard = day(page, 0).getByRole("group", { name: kept!, exact: true });
  const remaining = async () => {
    await expect(day(page, 0).getByRole("group")).toHaveCount(1);
    await expect(keptCard.getByRole("button", { name: "Déverrouiller" })).toBeVisible();
    await expect(cheese).toBeVisible();
    await expect(day(page, 1).getByRole("group")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Vider la semaine" })).toHaveCount(0);
  };
  await remaining();

  // Tout est enregistré.
  await page.reload();
  await remaining();
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

test.describe("sur un ordinateur portable", () => {
  // 1280 px (un écran 1920 px à 150 %) : la grille des sept jours, aux colonnes les plus étroites.
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("rien ne dépasse de la colonne de son jour, une entrée garde les plats alignés", async ({ page }) => {
    await newHousehold(page);
    await propose(page);

    // Une entrée au titre trop long pour la colonne : le titre se coupe, l'icône reste devant.
    const extras = day(page, 0).getByRole("button", { name: "Ajouter un dessert, un fruit… au dîner de lundi" });
    const panel = page.getByRole("dialog", { name: /^Pour finir/ });
    await expect(async () => {
      await extras.click();
      await expect(panel).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await panel.getByText("Entrée", { exact: true }).click();
    await panel.getByText("Avocat vinaigrette", { exact: true }).click();
    await panel.getByRole("button", { name: "Ajouter 1" }).click();
    await expect(panel).toBeHidden();
    const chip = day(page, 0).getByRole("button", { name: /^Entrée : Avocat vinaigrette/ });
    await expect(chip).toBeVisible();
    const sameLine = async () => {
      const icon = (await chip.locator("svg").first().boundingBox())!;
      const title = (await chip.getByText("Avocat vinaigrette").boundingBox())!;
      const middle = icon.y + icon.height / 2;
      return middle > title.y && middle < title.y + title.height;
    };
    await expect.poll(sameLine).toBe(true);

    // Les plats du dîner restent alignés d'un jour à l'autre : lundi (avec entrée) et mardi (sans).
    const firstDish = (index: number) => day(page, index).locator('[data-meal="soir"]').getByRole("group").first();
    const gap = async () => {
      const [monday, tuesday] = await Promise.all([firstDish(0).boundingBox(), firstDish(1).boundingBox()]);
      return Math.round(monday!.y - tuesday!.y);
    };
    await expect.poll(gap).toBe(0);

    // Ce qui sort de la colonne de son jour, à gauche ou à droite (les copies cachées des pages
    // déjà vues n'ont pas de boîte ; les textes pour lecteur d'écran, rognés, ne se voient pas).
    const overflowing = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("section[data-day]")]
          .filter((section) => section.getClientRects().length > 0)
          .flatMap((section) => {
            const column = section.getBoundingClientRect();
            const clipped = (element: Element) => {
              for (let node: Element | null = element; node && node !== section; node = node.parentElement) {
                if (getComputedStyle(node).clipPath !== "none") return true;
              }
              return false;
            };
            return [...section.querySelectorAll<HTMLElement>("*")]
              .filter((element) => {
                const box = element.getBoundingClientRect();
                return (
                  box.width > 1 && (box.left < column.left - 0.5 || box.right > column.right + 0.5) && !clipped(element)
                );
              })
              .map((element) => `${section.dataset.day} : ${element.tagName} « ${element.textContent?.slice(0, 30)} »`);
          }),
      );
    await expect.poll(overflowing).toEqual([]);
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
