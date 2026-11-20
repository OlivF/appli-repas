import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddExtraChip, ExtraChip } from "@/components/extra-chip";
import { ExtraTile } from "@/components/extra-tile";
import { ExtrasPanel } from "@/components/extras-panel";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Course } from "@/lib/recipes";
import type { RecipeMember } from "@/lib/recipes-data";
import type { WeekRecipe } from "@/lib/week-data";

const OLIVIER: RecipeMember = { id: "o", first_name: "Olivier", color: 0, initials: "O", diets: [] };
const ML: RecipeMember = { id: "ml", first_name: "Marie-Laure", color: 1, initials: "M", diets: ["keto"] };
const OTIS: RecipeMember = { id: "x", first_name: "Otis", color: 2, initials: "Ot", diets: [] };
const PRESENT = [OLIVIER, ML, OTIS];

function extra(id: string, title: string, course: Course, overrides: Partial<WeekRecipe> = {}): WeekRecipe {
  return {
    id,
    title,
    photo_url: null,
    meal_types: ["petit_dej", "midi", "soir", "pique_nique"],
    minutes: 0,
    diets: ["vegetarian", "gluten_free"],
    batch_friendly: false,
    ingredientNames: [title],
    favorite: false,
    excludedIds: [],
    base: null,
    basic: false,
    course,
    servings: 1,
    ingredientIds: [`i-${id}`],
    protein: null,
    ...overrides,
  };
}

const YAOURT = extra("yaourt", "Yaourt nature", "dairy");
const GREC = extra("grec", "Yaourt grec nature", "dairy", { diets: ["vegetarian", "gluten_free", "keto"] });
const POMME = extra("pomme", "Pomme", "fruit", { diets: ["vegetarian", "gluten_free", "lactose_free"] });
const FRAMBOISES = extra("framboises", "Framboises", "fruit", { diets: ["vegetarian", "gluten_free", "lactose_free", "keto"] });
const COMTE = extra("comte", "Comté", "cheese", { diets: ["vegetarian", "gluten_free", "lactose_free", "keto"], favorite: true });
const CAMEMBERT = extra("camembert", "Camembert", "cheese", { diets: ["vegetarian", "gluten_free", "keto"], meal_types: ["midi", "soir"] });
const AVOCAT = extra("avocat", "Avocat vinaigrette", "starter", { diets: ["vegetarian", "gluten_free", "lactose_free", "keto"], servings: 2 });
const RECIPES = [YAOURT, GREC, POMME, FRAMBOISES, COMTE, CAMEMBERT, AVOCAT];

describe("ExtraChip", () => {
  it("montre la sorte et le titre, sans avatars quand c'est pour tous", async () => {
    const onOpen = vi.fn();
    render(<ExtraChip course="dairy" title="Yaourt nature" onOpen={onOpen} />);
    const chip = screen.getByRole("button", { name: /Laitage : Yaourt nature/ });
    expect(within(chip).queryByRole("img")).toBeNull();
    await userEvent.click(chip);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("montre à qui il est quand ce n'est pas pour tous, et « Pas mangé »", () => {
    render(<ExtraChip course="cheese" title="Comté" eaters={[ML]} skipped onOpen={() => {}} />);
    const chip = screen.getByRole("button", { name: /Fromage : Comté/ });
    expect(chip).toHaveAccessibleName(/pour Marie-Laure/);
    expect(chip).toHaveTextContent("Pas mangé");
  });
});

describe("AddExtraChip", () => {
  it("ouvre le panneau d'ajout", async () => {
    const onClick = vi.fn();
    render(<AddExtraChip label="Ajouter un dessert, un fruit… au dîner de lundi" onClick={onClick} />);
    const chip = screen.getByRole("button", { name: "Ajouter un dessert, un fruit… au dîner de lundi" });
    expect(chip).toHaveTextContent("Dessert, fruit…");
    await userEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("ExtraTile", () => {
  it("se coche, avec la pastille Keto et « Au frigo »", async () => {
    const onChange = vi.fn();
    render(<ExtraTile recipe={COMTE} checked={false} hint="fridge" onChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: /Comté/ });
    const tile = box.closest("label")!;
    expect(tile).toHaveTextContent("Céto");
    expect(tile).toHaveTextContent("Au frigo");
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("« À finir » quand la date limite approche", () => {
    render(<ExtraTile recipe={YAOURT} checked={false} hint="soon" onChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: /Yaourt nature/ }).closest("label")).toHaveTextContent("À finir");
  });

  it("déjà au repas : cochée, figée, « Déjà là »", () => {
    render(<ExtraTile recipe={YAOURT} checked already onChange={() => {}} />);
    const box = screen.getByRole("checkbox", { name: /Yaourt nature/ });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(box.closest("label")).toHaveTextContent("Déjà là");
  });
});

describe("ExtrasPanel", () => {
  function panel(overrides: Partial<Parameters<typeof ExtrasPanel>[0]> = {}) {
    const props: Parameters<typeof ExtrasPanel>[0] = {
      mealType: "soir",
      dayLabel: "lundi",
      present: PRESENT,
      recipes: RECIPES,
      already: [],
      weekMeals: 7,
      fridgeHints: {},
      known: [],
      course: "dairy",
      onCourseChange: vi.fn(),
      onAdd: vi.fn(async () => ({ unserved: [] })),
      onCreate: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
    render(
      <Sheet open>
        <SheetContent>
          <ExtrasPanel {...props} />
        </SheetContent>
      </Sheet>,
    );
    return props;
  }

  it("titre, « Pour qui ? » avec tous les présents cochés, et les laitages d'abord", () => {
    panel();
    expect(screen.getByRole("heading", { name: "Pour finir le dîner de lundi" })).toBeInTheDocument();
    for (const name of ["Olivier", "Marie-Laure", "Otis"]) {
      expect(screen.getByRole("button", { name: `${name} mange ce plat` })).toHaveAttribute("aria-pressed", "true");
    }
    expect(screen.getByRole("checkbox", { name: /Yaourt nature/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Pomme/ })).toBeNull();
  });

  it("garde ce qu'on a coché en changeant de sorte : « Ajouter 2 »", async () => {
    const props = panel();
    await userEvent.click(screen.getByRole("checkbox", { name: /^Yaourt nature/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Fruit" }));
    expect(props.onCourseChange).toHaveBeenCalledWith("fruit");
    await userEvent.click(screen.getByRole("checkbox", { name: /Pomme/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter 2" }));
    expect(props.onAdd).toHaveBeenCalledWith("meal", ["yaourt", "pomme"], ["o", "ml", "x"]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("« Tous les dîners de la semaine » : « Ajouter à 7 dîners »", async () => {
    const props = panel();
    await userEvent.click(screen.getByRole("checkbox", { name: /^Yaourt nature/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Tous les dîners de la semaine" }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter à 7 dîners" }));
    expect(props.onAdd).toHaveBeenCalledWith("week", ["yaourt"], ["o", "ml", "x"]);
  });

  it("une recette déjà au repas est cochée et figée", () => {
    panel({ already: ["yaourt"] });
    const box = screen.getByRole("checkbox", { name: /^Yaourt nature/ });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ajouter" })).toBeDisabled();
  });

  it("ne montre que les recettes du repas : pas de camembert au petit-déj", async () => {
    panel({ mealType: "petit_dej", course: "cheese" });
    expect(screen.getByRole("checkbox", { name: /Comté/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Camembert/ })).toBeNull();
  });

  it("met en tête de sa sorte ce qui est au frigo, puis les favoris", () => {
    panel({ course: "cheese", fridgeHints: { camembert: "soon" } });
    const names = screen.getAllByRole("checkbox").map((box) => box.closest("label")!.textContent);
    expect(names[0]).toMatch(/Camembert.*À finir/);
    expect(names[1]).toMatch(/Comté/);
  });

  it("« Et pour Marie-Laure ? » : des plats légers qui lui vont, la même sorte d'abord, puis les autres", async () => {
    const onAdd = vi
      .fn()
      .mockResolvedValueOnce({ unserved: [{ day: 0, meal_type: "soir", member_ids: ["ml"] }] })
      .mockResolvedValueOnce({ unserved: [] });
    const props = panel({ onAdd });
    await userEvent.click(screen.getByRole("radio", { name: "Fruit" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Pomme/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter 1" }));
    expect(props.onClose).not.toHaveBeenCalled();
    const line = screen.getByRole("group", { name: "Et pour Marie-Laure ?" });
    expect(within(line).getAllByRole("button").map((button) => button.textContent)).toEqual([
      expect.stringContaining("Framboises"),
      // Puis la fin du repas, sorte par sorte (laitage, fromage), favoris d'abord ; pas d'entrée.
      expect.stringContaining("Yaourt grec nature"),
      expect.stringContaining("Comté"),
      expect.stringContaining("Camembert"),
      "Rien pour Marie-Laure",
    ]);
    await userEvent.click(within(line).getByRole("button", { name: /Framboises/ }));
    expect(onAdd).toHaveBeenLastCalledWith("meal", ["framboises"], ["ml"]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("« Rien pour Marie-Laure » ferme le panneau", async () => {
    const onAdd = vi.fn().mockResolvedValue({ unserved: [{ day: 0, meal_type: "soir", member_ids: ["ml"] }] });
    const props = panel({ onAdd });
    await userEvent.click(screen.getByRole("checkbox", { name: /^Yaourt nature/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter 1" }));
    const line = screen.getByRole("group", { name: "Et pour Marie-Laure ?" });
    // Pas d'autre laitage céto que le yaourt grec.
    expect(within(line).getByRole("button", { name: /Yaourt grec nature/ })).toBeInTheDocument();
    await userEvent.click(within(line).getByRole("button", { name: "Rien pour Marie-Laure" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("créer à la volée quand la recherche ne trouve rien", async () => {
    const created = extra("kaki", "Kaki", "fruit", { diets: ["vegetarian", "gluten_free", "lactose_free"] });
    const onCreate = vi.fn().mockResolvedValue({ recipe: created });
    const props = panel({
      onCreate,
      known: [{ name: "Kakis", aisle: "fruits_legumes", unit: "piece" }],
    });
    await userEvent.type(screen.getByRole("searchbox"), "kaki");
    await userEvent.click(screen.getByRole("button", { name: "Créer « Kaki »" }));
    // Devinée par le rayon de l'ingrédient : fruits et légumes → Fruit.
    const form = screen.getByRole("group", { name: "Créer « Kaki »" });
    expect(within(form).getByRole("radio", { name: "Fruit" })).toBeChecked();
    expect(within(form).getByRole("textbox", { name: "Une portion, c’est" })).toHaveValue("1");
    expect(within(form).getByRole("checkbox", { name: "Sans lactose" })).toBeChecked();
    await userEvent.click(within(form).getByRole("button", { name: "Créer" }));
    expect(onCreate).toHaveBeenCalledWith({
      title: "Kaki",
      course: "fruit",
      quantity: "1",
      unit: "piece",
      ingredient: "Kakis",
      aisle: "fruits_legumes",
      diets: ["vegetarian", "gluten_free", "lactose_free"],
    });
    expect(await screen.findByRole("checkbox", { name: /Kaki/ })).toBeChecked();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
