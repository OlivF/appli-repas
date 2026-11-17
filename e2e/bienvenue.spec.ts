import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion");
  await page.getByRole("link", { name: "Créer un compte" }).click();
  // Attendre le nouveau formulaire : les deux pages ont les mêmes champs.
  await expect(page).toHaveURL(/\/connexion\/inscription$/);
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
}

async function addMember(page: Page, firstName: string, age: string) {
  await page.getByLabel("Prénom", { exact: true }).fill(firstName);
  await page.getByLabel("Âge", { exact: true }).fill(age);
}

test("un nouveau compte crée son foyer en trois écrans, puis le modifie", async ({ page }) => {
  await signUp(page);

  // Écran 1 : le nom du foyer
  await expect(page).toHaveURL(/\/bienvenue$/);
  await expect(page.getByText("Étape 1 sur 3")).toBeVisible();
  await page.getByLabel("Nom du foyer").fill("Famille Durand");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Écran 2 : les membres
  await expect(page).toHaveURL(/\/bienvenue\/membres$/);
  await expect(page.getByText("Étape 2 sur 3")).toBeVisible();

  await addMember(page, "Paul", "42");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Paul" })).toContainText("42 ans");

  await addMember(page, "Léa", "8");
  await page.getByLabel("Végétarien").check();
  await page.getByLabel("Grand appétit").check();
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Léa" })).toContainText(
    "8 ans, végétarien, grand appétit",
  );

  await page.getByRole("link", { name: "Continuer" }).click();

  // Écran 3 : qui mange quoi, petit-déj et dîner déjà cochés pour tous
  await expect(page).toHaveURL(/\/bienvenue\/repas$/);
  await expect(page.getByText("Étape 3 sur 3")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Dîner lundi : Paul" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Petit-déj dimanche : Léa" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Midi lundi : Léa" })).not.toBeChecked();

  await page.getByRole("checkbox", { name: "Midi lundi : Léa" }).check();
  await page.getByRole("checkbox", { name: "Dîner samedi : Paul" }).uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // Fin du parcours : la semaine ; le récapitulatif est dans l'onglet Foyer
  await expect(page).toHaveURL(/\/semaine$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("La semaine");
  await page.getByRole("link", { name: "Foyer" }).click();
  await expect(page).toHaveURL(/\/foyer$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Durand");
  const meals = page.getByRole("region", { name: "Les repas de la semaine" });
  await expect(meals.getByRole("listitem")).toHaveText([
    /Tout le monde\s*tous les jours/, // petit-déj
    /Léa\s*lundi/, // midi
    /Tout le monde\s*lundi, mardi, mercredi, jeudi, vendredi et dimanche/, // dîner
    /Léa\s*samedi/,
  ]);

  // Modifier un membre : l'écran se rouvre, déjà rempli
  await page.getByRole("link", { name: "Modifier les membres" }).click();
  await expect(page).toHaveURL(/\/bienvenue\/membres$/);
  await expect(page.getByText("Étape 2 sur 3")).toHaveCount(0);
  await page.getByRole("link", { name: "Modifier Léa" }).click();
  await expect(page.getByLabel("Prénom", { exact: true })).toHaveValue("Léa");
  await expect(page.getByLabel("Âge", { exact: true })).toHaveValue("8");
  await expect(page.getByLabel("Végétarien")).toBeChecked();
  await page.getByLabel("Âge", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Léa" })).toContainText("9 ans");

  // Renommer le foyer
  await page.goto("/foyer");
  await page.getByRole("link", { name: "Renommer le foyer" }).click();
  await expect(page.getByLabel("Nom du foyer")).toHaveValue("Famille Durand");
  await page.getByLabel("Nom du foyer").fill("Famille Durand-Martin");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Durand-Martin");

  // Modifier les repas : la grille se rouvre telle qu'enregistrée ; un repas vidé disparaît
  await page.getByRole("link", { name: "Modifier les repas" }).click();
  await expect(page.getByRole("checkbox", { name: "Midi lundi : Léa" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Dîner samedi : Paul" })).not.toBeChecked();
  await page.getByRole("checkbox", { name: "Midi lundi : Léa" }).uncheck();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Famille Durand-Martin");
  await expect(meals.getByRole("heading", { name: "Petit-déj" })).toBeVisible();
  await expect(meals.getByRole("heading", { name: "Midi" })).toHaveCount(0);

  // Déconnexion
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/connexion$/);
});

test("retirer un membre l'enlève de la liste", async ({ page }) => {
  await signUp(page);
  await page.getByLabel("Nom du foyer").fill("Famille Test");
  await page.getByRole("button", { name: "Continuer" }).click();

  await addMember(page, "Jules", "30");
  await page.getByRole("button", { name: "Ajouter" }).click();
  // Le formulaire se vide une fois Jules enregistré : attendre avant de saisir la suite.
  await expect(page.getByRole("listitem").filter({ hasText: "Jules" })).toBeVisible();
  await addMember(page, "Inès", "5");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(2);

  await page.getByRole("button", { name: "Retirer Jules" }).click();
  await expect(page.getByRole("listitem")).toHaveText([/Inès/]);
});
