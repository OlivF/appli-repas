import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionGlobalConfig } from "framer-motion";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/sonner";
import type { FridgeItem } from "@/lib/fridge";
import { addFridgeItemAction, finishFridgeItemAction, restoreFridgeItemAction } from "./actions";
import { FridgeBoard } from "./fridge-board";

vi.mock("./actions", () => ({
  addFridgeItemAction: vi.fn(),
  updateFridgeItemAction: vi.fn(),
  finishFridgeItemAction: vi.fn(async () => ({ ok: true })),
  restoreFridgeItemAction: vi.fn(async () => ({ ok: true })),
  freeFridgeItemAction: vi.fn(async () => ({ ok: true })),
}));

const SAVE_ERROR = "L'enregistrement n'a pas abouti. Vérifie ta connexion, puis réessaie.";
const TODAY = "2026-11-19";

function fridge(id: string, fields: Partial<FridgeItem> = {}): FridgeItem {
  return {
    id,
    ingredient_id: null,
    label: id,
    quantity: null,
    unit: null,
    best_before: null,
    origin: "manual",
    recipe_id: null,
    reserved_list_id: null,
    ...fields,
  };
}

const CREME = fridge("c1", { ingredient_id: "creme", label: "Crème fraîche épaisse", quantity: 200, unit: "g", best_before: "2026-11-20" });
const CAROTTES = fridge("k1", { ingredient_id: "carottes", label: "Carottes", quantity: 6, unit: "piece", best_before: "2026-12-10" });

function renderBoard(items: FridgeItem[] = [CREME, CAROTTES]) {
  return render(
    <>
      <FridgeBoard
        today={TODAY}
        items={items}
        ingredients={[
          {
            id: "creme",
            name: "Crème fraîche épaisse",
            name_key: "creme fraiche epaisse",
            aliases: ["creme fraiche"],
            aisle: "cremerie",
            shopping_unit: "g",
            shelf_life_days: 7,
          },
        ]}
        aisles={{ creme: "cremerie", carottes: "fruits_legumes" }}
        listWeeks={{}}
        settlement={null}
      />
      <Toaster />
    </>,
  );
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  vi.mocked(finishFridgeItemAction).mockClear();
  vi.mocked(restoreFridgeItemAction).mockClear();
  vi.mocked(addFridgeItemAction).mockReset();
});

describe("FridgeBoard", () => {
  it("met en haut ce qu'il faut finir vite, avec sa date", () => {
    renderBoard();
    const urgent = screen.getByRole("region", { name: "À finir vite" });
    expect(within(urgent).getByText("Crème fraîche épaisse")).toBeInTheDocument();
    expect(within(urgent).getByText("Demain")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Restes" })).getByText("Carottes")).toBeInTheDocument();
  });

  it("« Fini » retire la ligne et propose « Annuler », qui la remet", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(screen.getByRole("button", { name: "Fini : Crème fraîche épaisse" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Fini : Crème fraîche épaisse" })).toBeNull());
    expect(finishFridgeItemAction).toHaveBeenCalledWith("c1");

    await user.click(await screen.findByRole("button", { name: "Annuler" }));
    expect(restoreFridgeItemAction).toHaveBeenCalledWith(CREME);
    expect(await screen.findByRole("button", { name: "Fini : Crème fraîche épaisse" })).toBeInTheDocument();
  });

  it("si « Fini » ne s'enregistre pas, la ligne revient avec un message", async () => {
    vi.mocked(finishFridgeItemAction).mockResolvedValueOnce({ error: SAVE_ERROR });
    const user = userEvent.setup();
    renderBoard();
    await user.click(screen.getByRole("button", { name: "Fini : Crème fraîche épaisse" }));
    await waitFor(() => expect(screen.getAllByRole("alert").some((alert) => alert.textContent === SAVE_ERROR)).toBe(true));
    expect(screen.getByRole("button", { name: "Fini : Crème fraîche épaisse" })).toBeInTheDocument();
  });

  it("ajouter : le nom tapé retrouve l'ingrédient, la date par défaut vient de sa conservation", async () => {
    vi.mocked(addFridgeItemAction).mockResolvedValueOnce({
      item: fridge("c2", { ingredient_id: "creme", label: "Crème fraîche épaisse", quantity: 150, unit: "g", best_before: "2026-11-26" }),
    });
    const user = userEvent.setup();
    renderBoard([]);
    expect(screen.getByText("Rien au frigo pour l’instant")).toBeInTheDocument();

    await user.type(screen.getByRole("combobox", { name: "Ce que tu ranges" }), "creme fraiche{Enter}");
    const sheet = await screen.findByRole("dialog", { name: "Crème fraîche épaisse" });
    expect(within(sheet).getByText("g")).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { name: "Dans 1 semaine" })).toBeChecked();

    await user.type(within(sheet).getByRole("textbox", { name: /Quantité/ }), "150");
    await user.click(within(sheet).getByRole("button", { name: "Ranger" }));
    expect(addFridgeItemAction).toHaveBeenCalledWith({
      label: "Crème fraîche épaisse",
      ingredientId: "creme",
      quantity: "150",
      bestBefore: "2026-11-26",
    });
    expect(await screen.findByRole("button", { name: "Fini : Crème fraîche épaisse" })).toBeInTheDocument();
  });

  it("un texte libre se range sans ingrédient ni date", async () => {
    vi.mocked(addFridgeItemAction).mockResolvedValueOnce({ item: fridge("l1", { label: "Reste de lasagnes" }) });
    const user = userEvent.setup();
    renderBoard([]);
    await user.type(screen.getByRole("combobox", { name: "Ce que tu ranges" }), "Reste de lasagnes{Enter}");
    const sheet = await screen.findByRole("dialog", { name: "Reste de lasagnes" });
    expect(within(sheet).getByRole("radio", { name: "Pas de date" })).toBeChecked();
    await user.click(within(sheet).getByRole("button", { name: "Ranger" }));
    expect(addFridgeItemAction).toHaveBeenCalledWith({ label: "Reste de lasagnes", ingredientId: null, quantity: "", bestBefore: null });
  });
});
