import { expect, test } from "./fixtures";
import type { Locator, Page } from "@playwright/test";

// La corbeille : pendant qu'on fait glisser un plat (appui long au doigt), une poubelle apparaît
// en bas de l'écran ; on y lâche le plat pour le retirer, « Annuler » le fait revenir. Un compte
// neuf : Paul (40 ans) et Léa (40 ans, cétogène), petit-déj et dîner tous les jours.
async function newHousehold(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill("Famille Corbeille");
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

const monday = (page: Page) => page.locator('section[data-day="0"]');
const mondayDinner = (page: Page) => monday(page).locator('[data-meal="soir"]');

async function propose(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Proposer la semaine" }).first().click();
  await expect(page.getByRole("button", { name: "Relancer" }).first()).toBeVisible();
  await expect(mondayDinner(page).getByRole("group").first()).toBeVisible();
}

// Appui long au doigt (le capteur de dnd-kit attend 250 ms), puis glisser jusqu'à la corbeille.
// Rend la position de défilement de la page mesurée au-dessus de la corbeille, avant et après
// une pause : elle ne doit pas bouger.
async function dropInTrash(page: Page, item: Locator) {
  await item.scrollIntoViewIfNeeded();
  const box = (await item.boundingBox())!;
  const start = { x: box.x + 24, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  await page.waitForTimeout(400);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + 4, y: start.y + 6 }] });

  const trash = page.getByTestId("trash-zone");
  await expect(trash).toHaveText("Retirer du menu");
  await page.waitForTimeout(500);
  const target = (await trash.boundingBox())!;
  const end = { x: target.x + target.width / 2, y: target.y + target.height / 3 };
  for (let step = 1; step <= 12; step++) {
    const x = start.x + ((end.x - start.x) * step) / 12;
    const y = start.y + 6 + ((end.y - start.y - 6) * step) / 12;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await page.waitForTimeout(30);
  }
  await expect(trash).toHaveText("Lâche pour retirer");
  const before = await page.evaluate(() => [window.scrollY, document.querySelector('section[data-day="0"]')!.getBoundingClientRect().left]);
  await page.waitForTimeout(900);
  const after = await page.evaluate(() => [window.scrollY, document.querySelector('section[data-day="0"]')!.getBoundingClientRect().left]);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(trash).toBeHidden();
  return { before, after };
}

test("jeter un plat dans la corbeille, puis « Annuler »", async ({ page }) => {
  await newHousehold(page);
  await propose(page);
  await expect(page.getByText(/Reste appuyé pour le déplacer sur un autre, ou le jeter dans la corbeille/)).toBeVisible();

  const dish = mondayDinner(page).getByRole("group").last();
  const title = (await dish.getAttribute("aria-label"))!;
  const count = await mondayDinner(page).getByRole("group").count();

  const { before, after } = await dropInTrash(page, dish);
  // Ni la page ni les jours n'ont défilé au-dessus de la corbeille.
  expect(after).toEqual(before);

  await expect(mondayDinner(page).getByRole("group")).toHaveCount(count - 1);
  await expect(mondayDinner(page).getByText(/^Rien de prévu pour /)).toBeVisible();
  const toast = page.getByText(`${title} retiré du dîner de lundi`);
  await expect(toast).toBeVisible();

  await page.getByRole("button", { name: "Annuler" }).click();
  await expect(mondayDinner(page).getByRole("group", { name: title })).toBeVisible();
  await expect(mondayDinner(page).getByText(/^Rien de prévu pour /)).toBeHidden();
  await page.reload();
  await expect(mondayDinner(page).getByRole("group", { name: title })).toBeVisible();
});

test("un plat verrouillé se jette aussi, et revient verrouillé", async ({ page }) => {
  await newHousehold(page);
  await propose(page);

  const dish = mondayDinner(page).getByRole("group").last();
  const title = (await dish.getAttribute("aria-label"))!;
  await dish.getByRole("button", { name: "Verrouiller" }).click();
  await expect(dish.getByRole("button", { name: "Déverrouiller" })).toBeVisible();

  await dropInTrash(page, mondayDinner(page).getByRole("group", { name: title }));
  await expect(mondayDinner(page).getByRole("group", { name: title })).toBeHidden();

  await page.getByRole("button", { name: "Annuler" }).click();
  const back = mondayDinner(page).getByRole("group", { name: title });
  await expect(back).toBeVisible();
  await expect(back.getByRole("button", { name: "Déverrouiller" })).toBeVisible();
});

test("une puce (fromage) jetée disparaît", async ({ page }) => {
  await newHousehold(page);
  await propose(page);

  const add = mondayDinner(page).getByRole("button", { name: "Ajouter un dessert, un fruit… au dîner de lundi" });
  const panel = page.getByRole("dialog", { name: /^Pour finir/ });
  await expect(async () => {
    await add.click();
    await expect(panel).toBeVisible({ timeout: 1_000 });
  }).toPass();
  // Du comté : il va aussi à Léa (céto), le panneau se ferme tout seul.
  await panel.getByText("Fromage", { exact: true }).click();
  await panel.getByText("Comté", { exact: true }).click();
  await panel.getByRole("button", { name: "Ajouter 1" }).click();
  await expect(panel).toBeHidden();

  const chip = mondayDinner(page).getByRole("button", { name: /^Fromage : Comté/ });
  await expect(chip).toBeVisible();
  await dropInTrash(page, chip);
  await expect(chip).toBeHidden();
  await expect(page.getByText("Comté retiré du dîner de lundi")).toBeVisible();
  await page.reload();
  await expect(mondayDinner(page).getByRole("button", { name: /^Fromage : Comté/ })).toBeHidden();
});
