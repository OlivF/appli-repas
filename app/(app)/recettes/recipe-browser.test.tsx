import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ListRecipe } from "@/lib/recipes-data";
import { RecipeBrowser } from "./recipe-browser";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

function recipe(id: string, title: string, basic: boolean): ListRecipe {
  return {
    id,
    title,
    photo_url: null,
    meal_types: ["soir"],
    minutes: 30,
    diets: [],
    batch_friendly: false,
    ingredientNames: [],
    favorite: false,
    excludedIds: [],
    base: basic ? "Steak haché" : null,
    basic,
  };
}

describe("RecipeBrowser", () => {
  it("filtre les basiques avec la puce « Basiques », gardée dans l'adresse", async () => {
    render(
      <RecipeBrowser
        recipes={[recipe("1", "Steak haché et frites", true), recipe("2", "Lasagnes", false)]}
        members={[]}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 recettes");

    await userEvent.click(screen.getByRole("checkbox", { name: "Basiques" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 recette");
    expect(screen.getByRole("link", { name: /Steak haché et frites/ })).toBeInTheDocument();
    expect(window.location.search).toBe("?basiques=1");
  });
});
