import { devices, type Browser, type Page } from "@playwright/test";
import { expect, hideDevIndicator, test } from "./fixtures";

// Le foyer partagé, de bout en bout, sur plusieurs téléphones : Olivier crée « Famille F » et
// envoie un lien ; une visiteuse crée son compte depuis le lien et rejoint le foyer ; le lien ne
// resert pas ; invite@popote.test quitte son propre foyer pour rejoindre ; au drive, la liste se
// coche en direct ; Olivier retire invite@, qui repart sur /bienvenue (et le test peut rejouer).

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Un autre téléphone (même appareil que le projet Playwright), avec sa propre session.
async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "fr-FR",
    baseURL: test.info().project.use.baseURL,
  });
  const page = await context.newPage();
  await hideDevIndicator(page);
  return page;
}

async function fillAccount(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
}

async function signIn(page: Page, email: string) {
  await page.goto("/connexion");
  await fillAccount(page, email);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

// Olivier, Marie-Laure (cétogène) et Otis ; petit-déj et dîner tous les jours.
async function newHousehold(page: Page, name: string) {
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await fillAccount(page, `e2e-${unique()}@example.com`);
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill(name);
  await page.getByRole("button", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/membres$/);
  for (const [first, age, keto] of [
    ["Olivier", "40", false],
    ["Marie-Laure", "40", true],
    ["Otis", "6", false],
  ] as const) {
    await page.getByLabel("Prénom", { exact: true }).fill(first);
    await page.getByLabel("Âge", { exact: true }).fill(age);
    if (keto) await page.getByLabel("Cétogène").check();
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: first })).toBeVisible();
  }
  await page.getByRole("link", { name: "Continuer" }).click();

  await expect(page).toHaveURL(/\/bienvenue\/repas$/);
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/semaine$/);
}

// « Inviter quelqu'un » sur /foyer : le panneau s'ouvre avec un code neuf.
async function openInvite(page: Page) {
  await page.goto("/foyer");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Inviter quelqu’un" }).click();
  const panel = page.getByRole("dialog", { name: "Inviter quelqu’un" });
  await expect(panel).toBeVisible();
  return panel;
}

const shoppingRow = (page: Page, label: string) => page.getByRole("checkbox", { name: new RegExp(`^${label}`) });

test("un foyer, plusieurs comptes : inviter, rejoindre, cocher en direct, retirer", async ({ page: olivier, context, browser }) => {
  test.setTimeout(240_000);
  // Sans partage natif (ordinateur) : le lien est copié.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await olivier.addInitScript(() => {
    delete (Navigator.prototype as { share?: unknown }).share;
  });

  let dish = "";
  let link = "";

  await test.step("Olivier crée « Famille F », sa semaine, et invite quelqu'un", async () => {
    await newHousehold(olivier, "Famille F");
    await olivier.getByRole("button", { name: "Proposer la semaine" }).first().click();
    await expect(olivier.getByRole("button", { name: "Relancer" }).first()).toBeVisible();
    dish = (await olivier.locator('section[data-day="0"]').getByRole("group").first().getAttribute("aria-label")) ?? "";
    expect(dish).not.toBe("");

    const panel = await openInvite(olivier);
    await panel.getByRole("button", { name: "Partager le lien" }).click();
    await expect(olivier.getByText("Lien copié")).toBeVisible();
    const text = await olivier.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^Rejoins le foyer « Famille F » sur Popote/);
    link = new URL(text.match(/https?:\/\/\S+\/rejoindre\/[A-Z0-9]{8}/)![0]).pathname;
    await olivier.keyboard.press("Escape");
    await expect(panel).toBeHidden();
  });

  const visitor = await phone(browser);

  await test.step("Une visiteuse crée son compte depuis le lien et rejoint le foyer", async () => {
    await visitor.goto(link);
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(/^Tu es invité·e à rejoindre «\s+Famille F\s+»/);
    await visitor.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(visitor).toHaveURL(/\/connexion\/inscription$/);
    await fillAccount(visitor, `e2e-${unique()}@example.com`);
    await visitor.getByRole("button", { name: "Créer mon compte" }).click();

    // De retour sur l'invitation, sans retaper le lien.
    await expect(visitor).toHaveURL(new RegExp(`${link}$`));
    await visitor.getByRole("button", { name: "Rejoindre le foyer" }).click();
    await expect(visitor).toHaveURL(/\/semaine$/);
    await expect(visitor.getByText(/^Bienvenue dans «\s+Famille F\s+» !$/)).toBeVisible();
    // Les mêmes plats que sur le téléphone d'Olivier.
    await expect(visitor.locator('section[data-day="0"]').getByRole("group", { name: dish }).first()).toBeVisible();

    // « C'est moi : Marie-Laure ».
    await visitor.goto("/foyer");
    const whoAmI = visitor.getByRole("region", { name: "Qui es-tu à table ?" });
    await whoAmI.getByText("Marie-Laure", { exact: true }).click();
    await expect(whoAmI).toBeHidden();
    await expect(visitor.getByRole("button", { name: /^Marie-Laure \(toi\)/ })).toBeVisible();
  });

  await test.step("Le même lien ne resert pas", async () => {
    await visitor.goto(link);
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Ce lien ne marche plus.");
  });

  const invited = await phone(browser);

  await test.step("invite@popote.test quitte son propre foyer pour rejoindre « Famille F »", async () => {
    await signIn(invited, "invite@popote.test");
    // Sans foyer (cas normal) : il en crée un. Resté dans un foyer après un passage raté, le champ
    // porte déjà son nom : il le garde.
    await invited.goto("/bienvenue");
    const name = invited.getByLabel("Nom du foyer");
    await expect(name).toBeVisible();
    if ((await name.inputValue()) === "") {
      await name.fill("Chez invite");
      await invited.getByRole("button", { name: "Continuer" }).click();
      await expect(invited).toHaveURL(/\/bienvenue\/membres$/);
    }

    const panel = await openInvite(olivier);
    const code = (await panel.getByLabel(/^Code :/).getAttribute("aria-label"))!.replace("Code : ", "").replaceAll(" ", "");
    await olivier.keyboard.press("Escape");

    await invited.goto(`/rejoindre/${code}`);
    await expect(invited.getByText(/^Tu as déjà le foyer «.+»\. En rejoignant «\s+Famille F\s+», tu le quittes\.$/)).toBeVisible();
    await invited.getByRole("button", { name: /^Quitter «.+» et rejoindre$/ }).click();
    await expect(invited).toHaveURL(/\/semaine$/);
  });

  await test.step("Au drive : Olivier coche « Œufs », l'autre téléphone le voit sans recharger", async () => {
    await olivier.goto("/semaine");
    await olivier.getByRole("link", { name: "Faire les courses" }).click();
    await expect(olivier).toHaveURL(/\/courses\?semaine=\d{4}-\d{2}-\d{2}$/);
    await invited.goto(new URL(olivier.url()).pathname + new URL(olivier.url()).search);
    await expect(olivier.getByText("En direct")).toBeVisible();
    await expect(invited.getByText("En direct")).toBeVisible();

    // Pas d'œufs au menu : Olivier les ajoute, l'autre téléphone les voit arriver.
    if ((await shoppingRow(olivier, "Œufs").count()) === 0) {
      await olivier.getByRole("combobox", { name: "Article à ajouter" }).fill("Œufs");
      await olivier.getByRole("button", { name: "Ajouter", exact: true }).click();
      await expect(shoppingRow(olivier, "Œufs")).toBeVisible();
    }
    await expect(shoppingRow(invited, "Œufs")).toHaveAttribute("aria-checked", "false");

    await shoppingRow(olivier, "Œufs").click();
    await expect(shoppingRow(olivier, "Œufs")).toHaveAttribute("aria-checked", "true");
    await expect(shoppingRow(invited, "Œufs")).toHaveAttribute("aria-checked", "true");
  });

  await test.step("Olivier retire invite@ du foyer : au rechargement, retour sur /bienvenue", async () => {
    await olivier.goto("/foyer");
    await olivier.waitForLoadState("networkidle");
    await olivier.getByRole("button", { name: /^invite@popote\.test/ }).click();
    const panel = olivier.getByRole("dialog", { name: "invite@popote.test" });
    await panel.getByRole("button", { name: "Retirer du foyer" }).click();
    await panel.getByRole("button", { name: "Oui, retirer" }).click();
    await expect(olivier.getByText("invite@popote.test ne fait plus partie du foyer")).toBeVisible();

    await invited.reload();
    await expect(invited).toHaveURL(/\/bienvenue$/);
  });
});
