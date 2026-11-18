import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const SLOGAN = "Les repas de la semaine, sans prise de tête.";

async function signIn(page: Page, email = "test@example.com", password = "motdepasse") {
  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("un visiteur voit la page d'accueil et peut créer son compte", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SLOGAN);
  await expect(page.getByRole("heading", { name: "Comment ça marche" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pensé pour les vraies familles" })).toBeVisible();

  // Header sur téléphone : le logo et « Se connecter » ; l'inscription est dans la page.
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Popote" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Se connecter" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Créer mon compte" })).toBeHidden();

  await page.getByRole("link", { name: "Créer mon compte gratuit" }).first().click();
  await expect(page).toHaveURL(/\/connexion\/inscription$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Crée ton compte");
});

test("le pied de page mène aux pages légales", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await footer.getByRole("link", { name: "Mentions légales" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mentions légales");
  await page.getByRole("contentinfo").getByRole("link", { name: "Confidentialité" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confidentialité");
});

test("un compte connecté passe l'accueil et arrive sur sa semaine", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/semaine$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/semaine$/);
  await page.goto("/connexion");
  await expect(page).toHaveURL(/\/semaine$/);
});

test("le menu du compte mène au foyer, aux paramètres, et déconnecte", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/semaine$/);

  const account = page.getByRole("button", { name: "Ton compte" });
  await account.click();
  const menu = page.getByRole("menu");
  await expect(menu).toContainText("test@example.com");
  await expect(menu.getByRole("menuitem")).toHaveText(["Mon foyer", "Paramètres", "Se déconnecter"]);
  // Échap ferme le menu et rend la main au bouton.
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(account).toBeFocused();

  await account.click();
  await page.getByRole("menuitem", { name: "Mon foyer" }).click();
  await expect(page).toHaveURL(/\/foyer$/);

  await account.click();
  await page.getByRole("menuitem", { name: "Paramètres" }).click();
  await expect(page).toHaveURL(/\/parametres$/);
  await expect(page.getByText("test@example.com")).toBeVisible();

  await account.click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(SLOGAN);
});

test("changer de mot de passe dans les paramètres", async ({ page }) => {
  // Un compte neuf : le compte de test garde son mot de passe.
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/bienvenue$/);

  await page.goto("/parametres");
  await page.getByLabel("Nouveau mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "déjà ton mot de passe" })).toBeVisible();

  await page.getByLabel("Nouveau mot de passe").fill("nouveau-secret");
  await page.getByRole("button", { name: "Changer le mot de passe" }).click();
  await expect(page.getByRole("status").filter({ hasText: "ton mot de passe est changé" })).toBeVisible();

  await page.getByRole("button", { name: "Ton compte" }).click();
  await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await signIn(page, email, "nouveau-secret");
  // Foyer pas encore créé : /semaine renvoie vers le parcours.
  await expect(page).toHaveURL(/\/bienvenue$/);
});

test.describe("sur ordinateur", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("le header porte la navigation, l'onglet actif bien marqué", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Créer mon compte" })).toBeVisible();

    await signIn(page);
    await expect(page).toHaveURL(/\/semaine$/);
    const nav = page.getByRole("banner").getByRole("navigation", { name: "Navigation principale" });
    await expect(nav.getByRole("link")).toHaveText(["Semaine", "Recettes", "Courses", "Foyer"]);
    await expect(nav.getByRole("link", { name: "Semaine" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Recettes" }).click();
    await expect(page).toHaveURL(/\/recettes$/);
    await expect(nav.getByRole("link", { name: "Recettes" })).toHaveAttribute("aria-current", "page");
    // La barre du bas est réservée au téléphone.
    await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(1);
  });
});
