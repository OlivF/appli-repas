import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LEA, PAUL } from "@/test/helpers";
import { saveRecipe } from "./actions";
import { RecipeForm, type FormRecipe } from "./recipe-form";

// L'action serveur n'est pas appelée ici : on teste ce qui se passe avant l'envoi.
vi.mock("./actions", () => ({ saveRecipe: vi.fn() }));

const members = [
  { id: PAUL, first_name: "Paul", color: 0, initials: "P", diets: [] },
  { id: LEA, first_name: "Léa", color: 1, initials: "L", diets: ["keto" as const] },
];

const known = [
  { name: "Courgettes", aisle: "fruits_legumes" as const, unit: "piece" as const },
  { name: "Blancs de poulet", aisle: "boucherie" as const, unit: "g" as const },
  { name: "Pavés de bœuf", aisle: "boucherie" as const, unit: "piece" as const },
];
const bases = ["Côte de porc", "Poulet", "Steak haché"];

function renderForm(recipe: FormRecipe | null = null, ingredients: Parameters<typeof RecipeForm>[0]["ingredients"] = []) {
  render(
    <RecipeForm
      recipe={recipe}
      ingredients={ingredients}
      members={members}
      excludedIds={[]}
      known={known}
      bases={bases}
    />,
  );
}

async function pickIngredient(row: number, typed: string, option: RegExp) {
  await userEvent.type(screen.getByRole("combobox", { name: `Ingrédient ${row}` }), typed);
  await userEvent.click(screen.getByRole("option", { name: option }));
}

const baseField = () => screen.getByRole("combobox", { name: "Élément principal" });

describe("RecipeForm", () => {
  it("remplit le rayon et l'unité d'un ingrédient connu", async () => {
    renderForm();
    await userEvent.type(screen.getByRole("combobox", { name: "Ingrédient 1" }), "cour");
    await userEvent.click(screen.getByRole("option", { name: /Courgettes/ }));

    expect(screen.getByRole("combobox", { name: "Ingrédient 1" })).toHaveValue("Courgettes");
    expect(screen.getByRole("combobox", { name: "Rayon de l’ingrédient 1" })).toHaveValue("fruits_legumes");
    expect(screen.getByRole("combobox", { name: "Unité de l’ingrédient 1" })).toHaveValue("piece");
  });

  it("passe à une nouvelle ligne avec Entrée, sans envoyer le formulaire", async () => {
    renderForm();
    await userEvent.type(screen.getByRole("textbox", { name: "Quantité de l’ingrédient 1" }), "250{Enter}");

    const second = screen.getByRole("combobox", { name: "Ingrédient 2" });
    expect(second).toHaveFocus();
  });

  it("barre d'office un membre que son régime écarte, et le libère quand le régime est coché", async () => {
    renderForm();
    const lea = screen.getByRole("button", { name: "Léa n’en mange pas" });
    expect(lea).toBeDisabled();
    expect(lea).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("checkbox", { name: "Cétogène" }));
    expect(lea).toBeEnabled();
    expect(lea).toHaveAttribute("aria-pressed", "false");
  });

  it("pré-remplit l'élément principal avec la base connue du premier ingrédient de la boucherie", async () => {
    renderForm();
    expect(baseField()).toHaveValue("");
    await pickIngredient(1, "blan", /Blancs de poulet/);
    expect(baseField()).toHaveValue("Poulet");
  });

  it("met l'ingrédient au singulier quand aucune base connue ne correspond", async () => {
    renderForm();
    await pickIngredient(1, "pav", /Pavés de bœuf/);
    expect(baseField()).toHaveValue("Pavé de bœuf");
  });

  it("ne suit plus l'ingrédient une fois l'élément principal modifié", async () => {
    renderForm();
    await pickIngredient(1, "blan", /Blancs de poulet/);
    await userEvent.clear(baseField());
    await userEvent.type(baseField(), "Rôti");
    await userEvent.clear(screen.getByRole("combobox", { name: "Ingrédient 1" }));
    await pickIngredient(1, "pav", /Pavés de bœuf/);
    expect(baseField()).toHaveValue("Rôti");
  });

  it("garde l'élément principal enregistré d'une recette existante, sans pré-remplir", () => {
    const recipe: FormRecipe = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Gratin",
      description: null,
      photo_url: null,
      meal_types: ["soir"],
      servings: 4,
      prep_minutes: 10,
      cook_minutes: 30,
      diets: [],
      steps: [],
      batch_friendly: false,
      batch_notes: null,
      kid_friendly: false,
      base: null,
      basic: true,
    };
    renderForm(recipe, [{ name: "Blancs de poulet", quantity: 400, unit: "g", aisle: "boucherie" }]);
    expect(baseField()).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Recette basique" })).toBeChecked();
  });

  it("envoie l'élément principal et le drapeau basique", async () => {
    renderForm();
    await userEvent.type(screen.getByRole("textbox", { name: "Titre" }), "Poulet et riz");
    await pickIngredient(1, "blan", /Blancs de poulet/);
    await userEvent.click(screen.getByRole("switch", { name: "Recette basique" }));
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la recette" }));

    const data = vi.mocked(saveRecipe).mock.lastCall?.[1] as FormData;
    expect(data.get("base")).toBe("Poulet");
    expect(data.get("basic")).toBe("on");
  });

  it("vide la dernière ligne au lieu de la retirer", async () => {
    renderForm();
    await userEvent.type(screen.getByRole("combobox", { name: "Ingrédient 1" }), "Sel");
    await userEvent.click(screen.getByRole("button", { name: "Retirer l’ingrédient 1" }));
    expect(screen.getByRole("combobox", { name: "Ingrédient 1" })).toHaveValue("");
  });
});
