import { expect, test, type Page } from "@playwright/test";

// Les puces de choix cachent leur case : on touche la puce, comme au doigt.
function chip(page: Page, name: string) {
  return page.locator("label").filter({ has: page.getByRole("checkbox", { name, exact: true }) });
}

// Un compte neuf et son foyer : Paul (40 ans) et Léa (40 ans, cétogène). Chaque test a le
// sien, pour ne rien changer au foyer de test partagé.
async function newHousehold(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto("/connexion/inscription");
  await expect(page.getByRole("button", { name: "Créer mon compte" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill("motdepasse");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/bienvenue$/);
  await page.getByLabel("Nom du foyer").fill("Famille Recettes");
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("La semaine");
}

test("chercher, filtrer, ouvrir une recette du catalogue puis la copier", async ({ page }) => {
  await newHousehold(page);
  await page.getByRole("link", { name: "Recettes" }).click();
  await expect(page).toHaveURL(/\/recettes$/);
  // 40 recettes du quotidien et 35 basiques
  await expect(page.getByRole("status")).toHaveText("75 recettes");

  // Recherche par ingrédient, sans accent ni majuscule
  await page.getByRole("searchbox", { name: "Chercher une recette" }).fill("COURGETTE");
  await expect(page.getByRole("status")).toHaveText("5 recettes");
  await expect(page.getByRole("link", { name: /Courgettes farcies à la viande/ })).toBeVisible();
  await page.getByRole("button", { name: "Effacer la recherche" }).click();

  // Filtre en puce, gardé dans l'adresse
  await chip(page, "Cétogène").click();
  await expect(page.getByRole("status")).toHaveText("33 recettes");
  await expect(page).toHaveURL(/regime=keto/);

  // Fiche : quantités pour les 2 membres, puis pour 3 au curseur
  await page.getByRole("link", { name: /Saumon au four, beurre citronné et brocolis/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saumon au four, beurre citronné et brocolis");
  const salmon = page.getByRole("region", { name: "Ingrédients" }).getByRole("listitem").filter({ hasText: "Pavés de saumon" });
  await expect(salmon).toHaveText("Pavés de saumon2");
  await page.getByRole("slider", { name: "Nombre de personnes" }).press("ArrowRight");
  await expect(salmon).toHaveText("Pavés de saumon3");

  // Les recettes de même élément principal : celles pour les autres d'abord (celle-ci est céto)
  const partners = page.getByRole("list", { name: "Se marie avec" });
  await expect(partners.getByRole("link").first()).toHaveText("Saumon et pâtes au pesto");
  await expect(partners.getByRole("link", { name: /Saumon et haricots verts/ })).toContainText("Céto");

  // Exclure Paul et mettre en favori, enregistré aussitôt
  await page.getByRole("button", { name: "Paul n’en mange pas" }).click();
  await expect(page.getByRole("button", { name: "Paul n’en mange pas" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Sauf Paul")).toBeVisible();
  await page.getByRole("button", { name: "Favori" }).click();
  await expect(page.getByRole("button", { name: "Favori" })).toHaveAttribute("aria-pressed", "true");

  // Le retour retrouve le filtre ; la carte porte le cœur
  await page.getByRole("link", { name: "Recettes" }).first().click();
  await expect(page).toHaveURL(/regime=keto/);
  await expect(page.getByRole("checkbox", { name: "Cétogène" })).toBeChecked();
  const card = page.getByRole("link", { name: /Saumon au four/ });
  await expect(card.getByRole("img", { name: "Favori" })).toBeVisible();
  await expect(card).toContainText("Sauf Paul");

  // Copier : le formulaire de la copie s'ouvre, avec ce que le foyer avait noté
  await card.click();
  await page.getByRole("button", { name: "Copier dans mes recettes" }).click();
  await expect(page).toHaveURL(/\/recettes\/[0-9a-f-]+\/modifier$/);
  await expect(page.getByLabel("Titre")).toHaveValue("Saumon au four, beurre citronné et brocolis");
  await expect(page.getByRole("button", { name: "Paul n’en mange pas" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Titre").fill("Saumon de Léa");
  await page.getByRole("button", { name: "Enregistrer la recette" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saumon de Léa");
  await expect(page.getByRole("link", { name: "Modifier la recette" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Favori" })).toHaveAttribute("aria-pressed", "true");

  const copyUrl = page.url();

  // Rouvert ensuite, le formulaire montre ce qui vient d'être enregistré. On relit d'abord la
  // fiche une seconde : Next.js en profite pour préparer le formulaire d'avance, avec ses données
  // de la visite précédente (aucune requête ne le signale, d'où l'attente fixe).
  await page.waitForTimeout(1000);
  await page.getByRole("link", { name: "Modifier la recette" }).click();
  await expect(page).toHaveURL(/\/recettes\/[0-9a-f-]+\/modifier$/);
  await expect(page.getByRole("textbox", { name: "Titre" })).toHaveValue("Saumon de Léa");

  // L'adresse de l'originale mène désormais à la copie
  await page.goto("/recettes/ca7a0000-0000-4000-8000-000000000022");
  await expect(page).toHaveURL(copyUrl);

  // La copie remplace l'originale dans la liste
  await page.goto("/recettes?regime=keto");
  await expect(page.getByRole("status")).toHaveText("33 recettes");
  await expect(page.getByRole("link", { name: /Saumon de Léa/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Saumon au four/ })).toHaveCount(0);
});

test("créer une recette avec l'autocomplétion des ingrédients", async ({ page }) => {
  await newHousehold(page);
  await page.goto("/recettes/nouvelle");

  // Sans repas, rien n'est enregistré, et rien de ce qui est saisi ne se perd
  await page.getByLabel("Titre").fill("Omelette du dimanche");
  await page.getByRole("switch", { name: "Se prépare à l’avance" }).click();
  await page.getByLabel("Ce qu’on fait le dimanche").fill("Battre les œufs la veille.");
  await page.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(page.getByText("Choisis au moins un repas.")).toBeVisible();
  await expect(page.getByLabel("Titre")).toHaveValue("Omelette du dimanche");
  await expect(page.getByRole("switch", { name: "Se prépare à l’avance" })).toBeChecked();
  await expect(page.getByLabel("Ce qu’on fait le dimanche")).toHaveValue("Battre les œufs la veille.");

  await page.getByLabel("Titre").fill("");
  await page.getByRole("button", { name: "Enregistrer la recette" }).click();
  await expect(page.getByText("Donne un titre à la recette.")).toBeVisible();

  await page.getByLabel("Titre").fill("Omelette du dimanche");
  await chip(page, "Petit-déj").click();
  await page.getByLabel("Pour combien de personnes ?").fill("2");

  // Un ingrédient connu apporte son rayon et son unité ; Entrée ouvre la ligne suivante
  await page.getByRole("combobox", { name: "Ingrédient 1", exact: true }).fill("œu");
  await page.getByRole("option", { name: /Œufs/ }).click();
  await expect(page.getByRole("combobox", { name: "Rayon de l’ingrédient 1" })).toHaveValue("cremerie");
  await expect(page.getByRole("combobox", { name: "Unité de l’ingrédient 1" })).toHaveValue("piece");
  await page.getByRole("textbox", { name: "Quantité de l’ingrédient 1" }).fill("3");
  await page.getByRole("textbox", { name: "Quantité de l’ingrédient 1" }).press("Enter");
  await expect(page.getByRole("combobox", { name: "Ingrédient 2", exact: true })).toBeFocused();
  await page.getByRole("combobox", { name: "Ingrédient 2", exact: true }).fill("Ciboul");
  await page.getByRole("option", { name: /Ciboulette/ }).click();
  await page.getByRole("textbox", { name: "Quantité de l’ingrédient 2" }).fill("1,5");

  await page.getByLabel("Étapes").fill("Bats les œufs.\nFais cuire à feu doux.");
  await page.getByRole("button", { name: "Enregistrer la recette" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Omelette du dimanche");
  const ingredients = page.getByRole("region", { name: "Ingrédients" }).getByRole("listitem");
  await expect(ingredients).toHaveText(["Œufs3", "Ciboulette1 ½ c. à soupe"]);
  await expect(page.getByRole("region", { name: "Étapes" }).getByRole("listitem")).toHaveText([
    "1Bats les œufs.",
    "2Fais cuire à feu doux.",
  ]);
});
