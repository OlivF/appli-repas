import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Autocomplete } from "@/components/autocomplete";
import { ShoppingAisle } from "@/components/shopping-aisle";
import { ShoppingItemSheet, type SheetItem } from "@/components/shopping-item-sheet";
import { HomeItemRow, PantryItemRow, ShoppingItemRow } from "@/components/shopping-item-row";

const ONIONS = { id: "oignons", label: "Oignons", quantity: "4", checked: false, quantityChanged: false };

describe("ShoppingItemRow", () => {
  it("toute la ligne est une case à cocher ; « … » est un bouton à côté", async () => {
    const onToggle = vi.fn();
    const onMore = vi.fn();
    render(
      <ul>
        <ShoppingItemRow item={ONIONS} onToggle={onToggle} onMore={onMore} />
      </ul>,
    );
    const checkbox = screen.getByRole("checkbox", { name: /Oignons/ });
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    expect(checkbox).toHaveTextContent("4");
    const more = screen.getByRole("button", { name: "Plus sur Oignons" });
    expect(checkbox).not.toContainElement(more);

    await userEvent.click(screen.getByText("Oignons"));
    expect(onToggle).toHaveBeenCalledOnce();
    await userEvent.click(more);
    expect(onMore).toHaveBeenCalledOnce();
  });

  it("barre un article coché et signale une quantité modifiée", () => {
    const { rerender } = render(
      <ul>
        <ShoppingItemRow item={{ ...ONIONS, checked: true }} onToggle={() => {}} onMore={() => {}} />
      </ul>,
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Oignons")).toHaveClass("line-through");

    rerender(
      <ul>
        <ShoppingItemRow item={{ ...ONIONS, quantityChanged: true }} onToggle={() => {}} onMore={() => {}} />
      </ul>,
    );
    expect(screen.getByRole("checkbox")).toHaveTextContent("quantité modifiée");
  });
});

describe("PantryItemRow et HomeItemRow", () => {
  it("« Il n'en reste plus » passe l'article dans la liste", async () => {
    const onNeeded = vi.fn();
    render(<PantryItemRow label="Huile d'olive" note="pour 5 recettes" onNeeded={onNeeded} />);
    expect(screen.getByText("pour 5 recettes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Il n'en reste plus : Huile d'olive" }));
    expect(onNeeded).toHaveBeenCalledOnce();
  });

  it("« Remettre dans la liste » ramène un article déjà à la maison", async () => {
    const onRestore = vi.fn();
    render(<HomeItemRow label="Œufs" onRestore={onRestore} />);
    await userEvent.click(screen.getByRole("button", { name: "Remettre dans la liste : Œufs" }));
    expect(onRestore).toHaveBeenCalledOnce();
  });
});

describe("ShoppingAisle", () => {
  it("montre l'icône, le titre et ce qui reste à prendre", () => {
    render(
      <ShoppingAisle aisle="fruits_legumes" label="Fruits et légumes" remaining={2}>
        <li>Oignons</li>
      </ShoppingAisle>,
    );
    expect(screen.getByRole("heading", { name: "Fruits et légumes" })).toBeInTheDocument();
    expect(screen.getByText("2 à prendre")).toBeInTheDocument();
    expect(screen.getByText("Oignons")).toBeVisible();
  });

  it("se replie quand tout est pris, et se rouvre", async () => {
    render(
      <ShoppingAisle aisle="boucherie" label="Boucherie" remaining={0}>
        <li>Steaks</li>
      </ShoppingAisle>,
    );
    const toggle = screen.getByRole("button", { name: /Boucherie/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("Tout est pris");
    expect(screen.queryByText("Steaks")).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByText("Steaks")).toBeVisible();
  });
});

const STEAKS: SheetItem = {
  label: "Steaks hachés pur bœuf",
  quantity: "5",
  manual: false,
  pantry: false,
  needed: false,
  quantityText: null,
  sources: [{ recipeId: "frites", recipeTitle: "Steak haché et frites", day: 0, mealType: "soir", eaters: 4 }],
};

function sheetHandlers() {
  return {
    onOpenChange: vi.fn(),
    onHaveIt: vi.fn(),
    onBackToPantry: vi.fn(),
    onEdit: vi.fn(async () => null),
    onDelete: vi.fn(),
  };
}

describe("ShoppingItemSheet", () => {
  it("dit pour quoi on l'achète, et propose « J'en ai déjà »", async () => {
    const handlers = sheetHandlers();
    render(<ShoppingItemSheet item={STEAKS} open {...handlers} />);
    expect(screen.getByRole("dialog", { name: "Steaks hachés pur bœuf" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pour quoi ?" })).toBeInTheDocument();
    const source = screen.getByRole("listitem");
    expect(source).toHaveTextContent("Steak haché et frites · lun. soir · 4 pers.");
    expect(screen.getByText("lun. soir · 4 pers.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supprimer" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "J'en ai déjà" }));
    expect(handlers.onHaveIt).toHaveBeenCalledOnce();
  });

  it("un article ajouté à la main se modifie et se supprime", async () => {
    const handlers = sheetHandlers();
    render(
      <ShoppingItemSheet
        item={{ ...STEAKS, label: "Bougies", quantity: "2", quantityText: "2", manual: true, sources: [] }}
        open
        {...handlers}
      />,
    );
    expect(screen.getByText("Ajouté à la main")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
    const name = screen.getByRole("textbox", { name: "Article" });
    await userEvent.clear(name);
    await userEvent.type(name, "Bougies parfumées");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(handlers.onEdit).toHaveBeenCalledWith("Bougies parfumées", "2");
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(handlers.onDelete).toHaveBeenCalledOnce();
  });

  it("un produit du placard passé dans la liste peut y retourner", async () => {
    const handlers = sheetHandlers();
    render(<ShoppingItemSheet item={{ ...STEAKS, label: "Huile d'olive", quantity: "", pantry: true, needed: true }} open {...handlers} />);
    await userEvent.click(screen.getByRole("button", { name: "Remettre au placard" }));
    expect(handlers.onBackToPantry).toHaveBeenCalledOnce();
  });
});

describe("Autocomplete", () => {
  function TopAutocomplete() {
    const [value, setValue] = useState("");
    return <Autocomplete id="article" aria-label="Article" value={value} onValueChange={setValue} options={[{ value: "Œufs" }]} placement="top" />;
  }

  it("peut ouvrir ses suggestions au-dessus du champ", async () => {
    render(<TopAutocomplete />);
    await userEvent.type(screen.getByRole("combobox", { name: "Article" }), "oe");
    const list = screen.getByRole("listbox");
    expect(list).toBeVisible();
    expect(list).toHaveClass("bottom-full");
  });
});
