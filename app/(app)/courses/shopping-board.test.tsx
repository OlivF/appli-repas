import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListItem } from "@/lib/shopping-data";
import { shoppingListText } from "@/lib/shopping";
import { setCheckedAction, uncheckAllAction } from "./actions";
import { ShoppingBoard } from "./shopping-board";

vi.mock("./actions", () => ({
  setCheckedAction: vi.fn(async () => ({ ok: true })),
  setRemovedAction: vi.fn(async () => ({ ok: true })),
  setNeededAction: vi.fn(async () => ({ ok: true })),
  uncheckAllAction: vi.fn(async () => ({ ok: true })),
  addItemAction: vi.fn(),
  editItemAction: vi.fn(async () => ({ ok: true })),
  deleteItemAction: vi.fn(async () => ({ ok: true })),
  updateListAction: vi.fn(),
}));

const SAVE_ERROR = "L'enregistrement n'a pas abouti. Vérifie ta connexion, puis réessaie.";

function listItem(fields: Partial<ListItem> & Pick<ListItem, "id" | "label">): ListItem {
  return {
    ingredient_id: fields.id,
    amounts: [],
    aisle: "fruits_legumes",
    pantry: false,
    sources: [],
    checked: false,
    removed: false,
    needed: false,
    quantity_changed: false,
    manual: false,
    quantity_text: null,
    position: 0,
    from_fridge: 0,
    maybe_in_fridge: false,
    stored: false,
    ...fields,
  };
}

const ITEMS = [
  listItem({ id: "oignons", label: "Oignons", amounts: [{ quantity: 4, unit: "piece" }], position: 0 }),
  listItem({ id: "courgettes", label: "Courgettes", amounts: [{ quantity: 6, unit: "piece" }], position: 1 }),
  listItem({ id: "steaks", label: "Steaks hachés", aisle: "boucherie", amounts: [{ quantity: 5, unit: "piece" }], checked: true }),
];

function renderBoard(items = ITEMS) {
  return render(
    <ShoppingBoard weekStart="2026-11-23" label="Semaine du 23 au 29 novembre" listId="liste" outdated={false} initialItems={items} known={[]} />,
  );
}

beforeEach(() => {
  vi.mocked(setCheckedAction).mockClear();
  vi.mocked(uncheckAllAction).mockClear();
});

describe("ShoppingBoard", () => {
  it("cocher fait avancer la progression tout de suite et l'enregistre", async () => {
    renderBoard();
    expect(screen.getByText("1 sur 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Oignons/ }));
    expect(screen.getByText("2 sur 3")).toBeInTheDocument();
    expect(setCheckedAction).toHaveBeenCalledWith("oignons", true);
  });

  it("une case qui ne s'enregistre pas revient, avec un message", async () => {
    vi.mocked(setCheckedAction).mockResolvedValueOnce({ error: SAVE_ERROR });
    renderBoard();
    const onions = screen.getByRole("checkbox", { name: /Oignons/ });
    await userEvent.click(onions);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(SAVE_ERROR));
    expect(screen.getByRole("checkbox", { name: /Oignons/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("1 sur 3")).toBeInTheDocument();
  });

  it("« Tout décocher » demande confirmation", async () => {
    renderBoard();
    await userEvent.click(screen.getByRole("button", { name: "Tout décocher" }));
    expect(uncheckAllAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Oui, tout décocher" }));
    expect(uncheckAllAction).toHaveBeenCalledWith("liste");
    expect(screen.getByText("0 sur 3")).toBeInTheDocument();
  });

  it("« Copier la liste » copie les articles non cochés, par rayon", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    renderBoard();
    await user.click(screen.getByRole("button", { name: "Copier la liste" }));
    expect(writeText).toHaveBeenCalledWith(shoppingListText("Semaine du 23 au 29 novembre", ITEMS));
    expect(await screen.findByRole("button", { name: "Liste copiée" })).toBeInTheDocument();
  });
});
