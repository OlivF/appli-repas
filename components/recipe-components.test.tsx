import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Autocomplete, type AutocompleteOption } from "@/components/autocomplete";
import { IngredientList } from "@/components/ingredient-list";
import { MemberToggle } from "@/components/member-toggle";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeChip } from "@/components/recipe-chip";
import { LEA, PAUL, TOM } from "@/test/helpers";

const OPTIONS: AutocompleteOption[] = [
  { value: "Courgettes", hint: "Fruits et légumes" },
  { value: "Crème liquide", hint: "Crèmerie" },
  { value: "Œufs", hint: "Crèmerie" },
  { value: "Concombre", hint: "Fruits et légumes" },
];

function Harness({ onPick }: { onPick?: (option: AutocompleteOption) => void }) {
  const [value, setValue] = useState("");
  return (
    <>
      <label htmlFor="ingredient">Ingrédient</label>
      <Autocomplete id="ingredient" value={value} onValueChange={setValue} options={OPTIONS} onPick={onPick} />
    </>
  );
}

describe("Autocomplete", () => {
  it("propose les ingrédients connus avec leur rayon", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("combobox", { name: "Ingrédient" }), "cour");

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Courgettes");
    expect(options[0]).toHaveTextContent("Fruits et légumes");
  });

  it("ignore les accents et les ligatures", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("combobox"), "oeu");
    expect(screen.getByRole("option", { name: /Œufs/ })).toBeInTheDocument();
  });

  it("se choisit au clavier", async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "c");
    // Suggestions par ordre alphabétique : Concombre, Courgettes, Crème liquide.
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledWith(OPTIONS[0]);
    expect(input).toHaveValue("Courgettes");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("se choisit au toucher", async () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    await userEvent.type(screen.getByRole("combobox"), "conc");
    await userEvent.click(screen.getByRole("option", { name: /Concombre/ }));
    expect(onPick).toHaveBeenCalledWith(OPTIONS[3]);
  });

  it("se ferme avec Échap", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("combobox"), "c");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("IngredientList", () => {
  it("recalcule les quantités pour le nombre de personnes", () => {
    render(
      <IngredientList
        servings={4}
        persons={6}
        ingredients={[
          { name: "Farine", quantity: 250, unit: "g" },
          { name: "Œufs", quantity: 3, unit: "piece" },
          { name: "Sel", quantity: null, unit: null },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Farine380 g", "Œufs4 ½", "Sel"]);
  });
});

const member = { id: LEA, first_name: "Léa", color: 1, initials: "L" };

describe("MemberToggle", () => {
  it("se coche pour dire qu'un membre n'en mange pas", async () => {
    const onPressedChange = vi.fn();
    render(<MemberToggle member={member} pressed={false} onPressedChange={onPressedChange} />);
    const toggle = screen.getByRole("button", { name: "Léa n’en mange pas" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    expect(onPressedChange).toHaveBeenCalledWith(true);
  });

  it("reste barré et inactif quand son régime l'écarte, en disant pourquoi", () => {
    render(<MemberToggle member={member} pressed disabled reason="Céto" onPressedChange={() => {}} />);
    const toggle = screen.getByRole("button", { name: /Léa n’en mange pas/ });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveTextContent("Céto");
  });
});

describe("RecipeCard", () => {
  const family = [
    { id: PAUL, first_name: "Paul", color: 0, initials: "P", out: false },
    { id: LEA, first_name: "Léa", color: 1, initials: "L", out: true },
    { id: TOM, first_name: "Tom", color: 2, initials: "T", out: false },
  ];

  it("dit qui n'en mange pas, et mène à la fiche", () => {
    render(
      <RecipeCard
        href="/recettes/1"
        title="Lasagnes"
        mealTypes={["soir"]}
        minutes={75}
        diets={[]}
        members={family}
        favorite
      />,
    );
    const link = screen.getByRole("link", { name: /Lasagnes/ });
    expect(link).toHaveAttribute("href", "/recettes/1");
    expect(link).toHaveTextContent("Sauf Léa");
    expect(link).toHaveTextContent("1 h 15");
    expect(within(link).getByRole("img", { name: "Favori" })).toBeInTheDocument();
  });

  it("porte l'étiquette de sa sorte quand ce n'est pas un plat", () => {
    const { rerender } = render(
      <RecipeCard href="/recettes/1" title="Yaourt nature" mealTypes={["soir"]} minutes={0} diets={[]} members={family} course="dairy" />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("Laitage");
    rerender(<RecipeCard href="/recettes/1" title="Lasagnes" mealTypes={["soir"]} minutes={75} diets={[]} members={family} course="main" />);
    expect(screen.getByRole("link")).not.toHaveTextContent("Plat");
  });

  it("ne met pas d'article dans le lien : Chromium lui ôterait son nom", () => {
    render(<RecipeCard href="/recettes/1" title="Lasagnes" mealTypes={["soir"]} minutes={75} diets={[]} members={family} />);
    expect(within(screen.getByRole("link")).queryByRole("article")).not.toBeInTheDocument();
  });
});

describe("RecipeChip", () => {
  it("mène à la recette quand il a une adresse, avec la pastille Céto", () => {
    render(<RecipeChip label="Steak haché et haricots verts" keto href="/recettes/1" />);
    const link = screen.getByRole("link", { name: /Steak haché et haricots verts/ });
    expect(link).toHaveAttribute("href", "/recettes/1");
    expect(within(link).getByText("Céto")).toBeInTheDocument();
  });

  it("choisit la recette quand on le touche", async () => {
    const onClick = vi.fn();
    render(<RecipeChip label="frites" onClick={onClick} />);
    await userEvent.click(screen.getByRole("button", { name: "frites" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByText("Céto")).not.toBeInTheDocument();
  });

  it("reste une simple pastille sans adresse ni action, pour être glissée", () => {
    render(<RecipeChip label="frites" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("frites")).toBeInTheDocument();
  });
});
