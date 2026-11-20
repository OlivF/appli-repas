import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EatersPicker } from "@/components/eaters-picker";
import { EmptySlot } from "@/components/empty-slot";
import { MemberToggle } from "@/components/member-toggle";
import { PlannedMealCard } from "@/components/planned-meal-card";
import { RecipeLibrary } from "@/components/recipe-library";
import { SameBaseNote } from "@/components/same-base-note";
import type { ListRecipe } from "@/lib/recipes-data";
import { LEA, PAUL } from "@/test/helpers";

const PAUL_AVATAR = { id: PAUL, first_name: "Paul", color: 0, initials: "P" };
const LEA_AVATAR = { id: LEA, first_name: "Léa", color: 1, initials: "L" };

const SALMON = { title: "Saumon au four", minutes: 40, photo_url: null, mealType: "soir" as const };

describe("PlannedMealCard", () => {
  it("montre le plat, son temps et qui le mange", () => {
    render(<PlannedMealCard recipe={SALMON} eaters={[PAUL_AVATAR, LEA_AVATAR]} locked={false} />);
    const card = screen.getByRole("group", { name: "Saumon au four" });
    expect(card).toHaveTextContent("40 min");
    expect(card).toHaveTextContent("Pour Paul et Léa");
    expect(card).not.toHaveTextContent("Ne convient pas");
  });

  it("signale les mangeurs à qui le plat ne convient pas", () => {
    render(
      <PlannedMealCard recipe={SALMON} eaters={[PAUL_AVATAR, { ...LEA_AVATAR, out: true }]} locked={false} />,
    );
    expect(screen.getByRole("group")).toHaveTextContent("Ne convient pas à Léa");
  });

  it("se verrouille, et cache alors « Autre idée »", async () => {
    const onToggleLock = vi.fn();
    const { rerender } = render(
      <PlannedMealCard recipe={SALMON} eaters={[PAUL_AVATAR]} locked={false} onToggleLock={onToggleLock} onAnotherIdea={() => {}} />,
    );
    const lock = screen.getByRole("button", { name: "Verrouiller" });
    expect(lock).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Autre idée" })).toBeInTheDocument();
    await userEvent.click(lock);
    expect(onToggleLock).toHaveBeenCalledOnce();

    rerender(
      <PlannedMealCard recipe={SALMON} eaters={[PAUL_AVATAR]} locked onToggleLock={onToggleLock} onAnotherIdea={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Déverrouiller" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Autre idée" })).not.toBeInTheDocument();
  });

  it("s'ouvre en touchant le plat", async () => {
    const onOpen = vi.fn();
    render(<PlannedMealCard recipe={SALMON} eaters={[PAUL_AVATAR]} locked={false} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /Saumon au four/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});

function listRecipe(id: string, title: string, overrides: Partial<ListRecipe> = {}): ListRecipe {
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
    base: null,
    basic: false,
    course: "main",
    servings: 4,
    ingredientIds: [],
    ...overrides,
  };
}

const RECIPES = [
  listRecipe("1", "Saumon au four", { minutes: 30, diets: ["keto"] }),
  listRecipe("2", "Lasagnes", { minutes: 75 }),
  listRecipe("3", "Tartines", { meal_types: ["petit_dej"], minutes: 5 }),
];

describe("RecipeLibrary", () => {
  it("ne montre que les recettes du repas demandé", () => {
    render(<RecipeLibrary recipes={RECIPES} mealType="soir" />);
    const list = screen.getByRole("list", { name: "Recettes" });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Lasagnes"),
      expect.stringContaining("Saumon au four"),
    ]);
  });

  it("filtre les recettes rapides et cherche", async () => {
    render(<RecipeLibrary recipes={RECIPES} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Rapide" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 recettes");
    await userEvent.type(screen.getByRole("searchbox"), "saumon");
    expect(screen.getByRole("status")).toHaveTextContent("1 recette");
  });

  it("rend la recette touchée et signale celles qui ne conviennent pas", async () => {
    const onPick = vi.fn();
    render(
      <RecipeLibrary
        recipes={RECIPES}
        mealType="soir"
        eaters={[
          { ...PAUL_AVATAR, diets: [] },
          { ...LEA_AVATAR, diets: ["keto"] },
        ]}
        onPick={onPick}
      />,
    );
    expect(screen.getByRole("button", { name: /Lasagnes/ })).toHaveTextContent("Ne convient pas à Léa");
    await userEvent.click(screen.getByRole("button", { name: /Saumon au four/ }));
    expect(onPick).toHaveBeenCalledWith(RECIPES[0]);
  });
});

describe("RecipeLibrary : les basiques", () => {
  const BASICS = [
    listRecipe("b1", "Steak haché et frites", { basic: true, base: "Steak haché" }),
    listRecipe("b2", "Steak haché et haricots verts", { basic: true, base: "Steak haché", diets: ["keto"] }),
    listRecipe("b3", "Poulet et riz", { basic: true, base: "Poulet" }),
  ];
  const ALL = [...RECIPES, ...BASICS];
  const basics = () => screen.getByRole("region", { name: "Les basiques" });
  const rowNames = () =>
    within(basics())
      .getAllByRole("list")
      .map((list) => document.getElementById(list.getAttribute("aria-labelledby") ?? "")?.textContent);
  const chips = (base: string) =>
    within(within(basics()).getByRole("list", { name: base })).getAllByRole("listitem").map((item) => item.textContent);

  it("range les basiques en tête, une ligne par base, sans les répéter dans la liste", () => {
    render(<RecipeLibrary recipes={ALL} mealType="soir" />);
    expect(rowNames()).toEqual(["Poulet", "Steak haché"]);
    expect(chips("Steak haché")).toEqual(["frites", "haricots vertsCéto"]);
    expect(within(screen.getByRole("list", { name: "Recettes" })).queryByText(/Steak haché/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("5 recettes");
  });

  it("cherche aussi dans les basiques", async () => {
    render(<RecipeLibrary recipes={ALL} mealType="soir" />);
    await userEvent.type(screen.getByRole("searchbox"), "frites");
    expect(rowNames()).toEqual(["Steak haché"]);
    expect(chips("Steak haché")).toEqual(["frites"]);
    expect(screen.getByRole("status")).toHaveTextContent("1 recette");
  });

  it("cache les puces que personne à table ne peut manger", () => {
    render(<RecipeLibrary recipes={ALL} mealType="soir" eaters={[{ ...LEA_AVATAR, diets: ["keto"] }]} />);
    expect(rowNames()).toEqual(["Steak haché"]);
    expect(chips("Steak haché")).toEqual(["haricots vertsCéto"]);
  });

  it("met en tête la base déjà au menu de ce repas", () => {
    render(<RecipeLibrary recipes={ALL} mealType="soir" firstBase="steak hache" />);
    expect(rowNames()).toEqual(["Steak haché", "Poulet"]);
  });

  it("choisit la recette en touchant sa puce", async () => {
    const onPick = vi.fn();
    render(<RecipeLibrary recipes={ALL} mealType="soir" onPick={onPick} />);
    await userEvent.click(within(basics()).getByRole("button", { name: "frites" }));
    expect(onPick).toHaveBeenCalledWith(BASICS[0]);
  });

  it("enveloppe chaque puce, pour la glisser vers la grille", () => {
    render(
      <RecipeLibrary
        recipes={ALL}
        renderItem={(recipe, item) => <div data-testid={`glisser-${recipe.id}`}>{item}</div>}
      />,
    );
    expect(screen.getByTestId("glisser-b1")).toHaveTextContent("frites");
    expect(within(basics()).queryByRole("button")).not.toBeInTheDocument();
  });

  it("n'affiche pas la section sans basique", () => {
    render(<RecipeLibrary recipes={RECIPES} mealType="soir" />);
    expect(screen.queryByRole("region", { name: "Les basiques" })).not.toBeInTheDocument();
  });
});

describe("plusieurs plats sur un repas", () => {
  it("« + Ajouter un plat » : un petit cadre en pointillés, lu avec son repas", async () => {
    const onClick = vi.fn();
    render(<EmptySlot variant="add" label="Ajouter un plat au dîner de lundi" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Ajouter un plat au dîner de lundi" });
    expect(button).toHaveTextContent("Ajouter un plat");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("un avatar à cocher : « Léa mange ce plat »", async () => {
    const onPressedChange = vi.fn();
    render(<MemberToggle mode="pick" member={LEA_AVATAR} pressed={false} reason="Céto" onPressedChange={onPressedChange} />);
    const toggle = screen.getByRole("button", { name: "Léa mange ce plat" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("Céto");
    await userEvent.click(toggle);
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it("les avatars d'une carte ouvrent « Qui mange ce plat ? », le reste de la carte ouvre « Changer »", async () => {
    const onOpen = vi.fn();
    const onEaters = vi.fn();
    render(
      <PlannedMealCard recipe={SALMON} eaters={[PAUL_AVATAR, LEA_AVATAR]} locked={false} onOpen={onOpen} onEaters={onEaters} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Qui mange ce plat \? Pour Paul et Léa/ }));
    expect(onEaters).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Saumon au four/ }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("« Pour qui ? » coche, décoche, et signale qui ne peut pas manger la recette", async () => {
    const onChange = vi.fn();
    const members = [
      { ...PAUL_AVATAR, diets: [] },
      { ...LEA_AVATAR, diets: ["keto" as const] },
    ];
    render(
      <EatersPicker
        members={members}
        selected={[PAUL, LEA]}
        onChange={onChange}
        recipe={{ diets: [], excludedIds: [] }}
      />,
    );
    expect(screen.getByRole("group", { name: "Pour qui ?" })).toBeInTheDocument();
    expect(screen.getByText(/Ne convient pas à Léa/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Paul mange ce plat" }));
    expect(onChange).toHaveBeenCalledWith([LEA]);
  });

  it("deux plats de même base sont liés : « Même base : steak haché »", () => {
    render(<SameBaseNote base="Steak haché" />);
    expect(screen.getByText("Même base : steak haché")).toBeInTheDocument();
  });
});
