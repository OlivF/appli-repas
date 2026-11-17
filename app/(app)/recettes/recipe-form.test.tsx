import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LEA, PAUL } from "@/test/helpers";
import { RecipeForm } from "./recipe-form";

// L'action serveur n'est pas appelée ici : on teste ce qui se passe avant l'envoi.
vi.mock("./actions", () => ({ saveRecipe: vi.fn() }));

const members = [
  { id: PAUL, first_name: "Paul", color: 0, initials: "P", diets: [] },
  { id: LEA, first_name: "Léa", color: 1, initials: "L", diets: ["keto" as const] },
];

function renderForm() {
  render(
    <RecipeForm
      recipe={null}
      ingredients={[]}
      members={members}
      excludedIds={[]}
      known={[{ name: "Courgettes", aisle: "fruits_legumes", unit: "piece" }]}
    />,
  );
}

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

  it("vide la dernière ligne au lieu de la retirer", async () => {
    renderForm();
    await userEvent.type(screen.getByRole("combobox", { name: "Ingrédient 1" }), "Sel");
    await userEvent.click(screen.getByRole("button", { name: "Retirer l’ingrédient 1" }));
    expect(screen.getByRole("combobox", { name: "Ingrédient 1" })).toHaveValue("");
  });
});
