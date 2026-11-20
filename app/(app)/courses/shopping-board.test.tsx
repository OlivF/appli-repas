import type { ComponentProps } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListItem } from "@/lib/shopping-data";
import { shoppingListText } from "@/lib/shopping";
import {
  loadListItemsAction,
  setCheckedAction,
  skipStoringAction,
  storeGroceriesAction,
  uncheckAllAction,
} from "./actions";
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
  storeGroceriesAction: vi.fn(async () => ({ ok: true })),
  skipStoringAction: vi.fn(async () => ({ ok: true })),
  loadListItemsAction: vi.fn(),
}));

// Le direct : un faux canal Supabase. `live.send` joue un changement venu de l'autre téléphone,
// `live.status` l'état de la connexion.
type Payload = { table: string; eventType: "INSERT" | "UPDATE" | "DELETE"; new: object; old: object };
const live = vi.hoisted(() => ({
  handlers: [] as { table: string; handler: (payload: Payload) => void }[],
  status: (() => {}) as (state: string) => void,
  send(payload: Payload) {
    for (const { table, handler } of live.handlers) if (table === payload.table) handler(payload);
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    const channel = {
      on: (_type: string, filter: { table: string }, handler: (payload: Payload) => void) => {
        live.handlers.push({ table: filter.table, handler });
        return channel;
      },
      subscribe: (callback: (state: string) => void) => {
        live.status = callback;
        return channel;
      },
    };
    return {
      auth: { getSession: async () => ({ data: { session: { access_token: "jeton" } } }) },
      realtime: { setAuth: async () => {} },
      channel: () => channel,
      removeChannel: async () => "ok",
    };
  },
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

function renderBoard(items = ITEMS, props: Partial<ComponentProps<typeof ShoppingBoard>> = {}) {
  return render(
    <ShoppingBoard
      today="2026-11-17"
      weekStart="2026-11-23"
      label="Semaine du 23 au 29 novembre"
      listId="liste"
      outdated={null}
      initialItems={items}
      known={[]}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.mocked(setCheckedAction).mockClear();
  vi.mocked(uncheckAllAction).mockClear();
  vi.mocked(loadListItemsAction).mockReset();
  live.handlers = [];
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

describe("ShoppingBoard et le frigo", () => {
  const CREME = listItem({
    id: "creme",
    label: "Crème fraîche épaisse",
    aisle: "cremerie",
    amounts: [{ quantity: 150, unit: "g" }],
    from_fridge: 200,
    position: 3,
  });
  const BEURRE = listItem({ id: "beurre", label: "Beurre", aisle: "cremerie", from_fridge: 250, position: 4 });
  const INGREDIENTS = {
    creme: { unit: "g" as const, shelfLifeDays: 7 },
    beurre: { unit: "g" as const, shelfLifeDays: 30 },
    oignons: { unit: "piece" as const, shelfLifeDays: 30 },
    courgettes: { unit: "piece" as const, shelfLifeDays: 5 },
    steaks: { unit: "piece" as const, shelfLifeDays: 1 },
  };

  it("dit ce que le frigo donne : « + 200 g au frigo », et « Déjà à la maison »", async () => {
    renderBoard([...ITEMS, CREME, BEURRE], { ingredients: INGREDIENTS, fridgeDates: { creme: "2026-11-24" } });
    expect(screen.getByRole("checkbox", { name: /Crème fraîche épaisse/ })).toHaveTextContent("+ 200 g au frigo");
    await userEvent.click(screen.getByRole("button", { name: /Déjà à la maison \(1\)/ }));
    expect(screen.getByText("250 g au frigo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Plus sur Crème fraîche épaisse" }));
    expect(await screen.findByText("Au frigo : 200 g, jusqu’au mar. 24")).toBeInTheDocument();
  });

  it("le bandeau dit ce qui a changé", () => {
    renderBoard(ITEMS, { outdated: "fridge" });
    expect(screen.getByText("Le frigo a changé")).toBeInTheDocument();
  });

  it("tout coché : « Range-les au frigo », puis « Ranger N articles »", async () => {
    vi.mocked(storeGroceriesAction).mockClear();
    const all = ITEMS.map((item) => ({ ...item, checked: true }));
    renderBoard(all, { ingredients: INGREDIENTS });
    const card = screen.getByRole("region", { name: "Ranger les courses" });
    expect(card).toHaveTextContent("Courses faites ? Range-les au frigo");
    await userEvent.click(within(card).getByRole("button", { name: "Ranger" }));
    const sheet = await screen.findByRole("dialog", { name: "Ranger au frigo" });
    expect(within(sheet).getByRole("checkbox", { name: /Oignons/ })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(within(sheet).getByRole("button", { name: "Ranger 3 articles" }));
    expect(storeGroceriesAction).toHaveBeenCalledWith("liste", [
      { itemId: "oignons", quantity: 4, bestBefore: "2026-12-17" },
      { itemId: "courgettes", quantity: 6, bestBefore: "2026-11-22" },
      { itemId: "steaks", quantity: 5, bestBefore: "2026-11-18" },
    ]);
    await waitFor(() => expect(screen.queryByRole("region", { name: "Ranger les courses" })).toBeNull());
  });

  it("« Non merci » traite la proposition sans rien ranger ; pas de carte avant le jeudi", async () => {
    vi.mocked(skipStoringAction).mockClear();
    const some = ITEMS.map((item, index) => ({ ...item, checked: index === 0 }));
    const { unmount } = renderBoard(some, { ingredients: INGREDIENTS, today: "2026-11-18" });
    expect(screen.queryByRole("region", { name: "Ranger les courses" })).toBeNull();
    unmount();

    renderBoard(some, { ingredients: INGREDIENTS, today: "2026-11-19" });
    await userEvent.click(within(screen.getByRole("region", { name: "Ranger les courses" })).getByRole("button", { name: "Ranger" }));
    await userEvent.click(await screen.findByRole("button", { name: "Non merci" }));
    expect(skipStoringAction).toHaveBeenCalledWith("liste");
    await waitFor(() => expect(screen.queryByRole("region", { name: "Ranger les courses" })).toBeNull());
  });
});

describe("ShoppingBoard en direct", () => {
  const checkedOnPhone = (item: ListItem, checked: boolean) =>
    act(() => live.send({ table: "shopping_items", eventType: "UPDATE", new: { ...item, checked }, old: { id: item.id } }));

  it("« En direct » à plusieurs comptes, « Hors ligne » quand la connexion tombe ; rien seul·e", async () => {
    const { unmount } = renderBoard(ITEMS, { shared: true });
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    await waitFor(() => expect(live.handlers).toHaveLength(2));
    act(() => live.status("SUBSCRIBED"));
    expect(status).toHaveTextContent("En direct");
    act(() => live.status("CHANNEL_ERROR"));
    expect(status).toHaveTextContent("Hors ligne");
    unmount();

    live.handlers = [];
    renderBoard(ITEMS);
    await waitFor(() => expect(live.handlers).toHaveLength(2));
    act(() => live.status("SUBSCRIBED"));
    expect(screen.queryByText("En direct")).toBeNull();
  });

  it("une case cochée sur l'autre téléphone se coche ici, sans message", async () => {
    renderBoard(ITEMS, { shared: true });
    await waitFor(() => expect(live.handlers).toHaveLength(2));
    checkedOnPhone(ITEMS[0], true);
    expect(screen.getByRole("checkbox", { name: /Oignons/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("2 sur 3")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un geste encore en cours d'enregistrement ici l'emporte", async () => {
    let saved: (value: { ok: true }) => void = () => {};
    vi.mocked(setCheckedAction).mockReturnValueOnce(new Promise((resolve) => (saved = resolve)));
    renderBoard(ITEMS, { shared: true });
    await waitFor(() => expect(live.handlers).toHaveLength(2));
    await userEvent.click(screen.getByRole("checkbox", { name: /Oignons/ }));
    checkedOnPhone(ITEMS[0], false);
    expect(screen.getByRole("checkbox", { name: /Oignons/ })).toHaveAttribute("aria-checked", "true");
    await act(async () => saved({ ok: true }));
    checkedOnPhone(ITEMS[1], true);
    expect(screen.getByText("3 sur 3")).toBeInTheDocument();
  });

  it("un article ajouté ailleurs : la liste est relue, le panneau ouvert reste ouvert", async () => {
    const bread = listItem({ id: "pain", label: "Pain", aisle: "boulangerie", manual: true, position: 5 });
    vi.mocked(loadListItemsAction).mockResolvedValue({
      list: { items: [...ITEMS, bread], ingredients: {}, fridgeDates: {}, outdated: null, storedAt: null, settledAt: null },
    });
    renderBoard(ITEMS, { shared: true });
    await waitFor(() => expect(live.handlers).toHaveLength(2));
    await userEvent.click(screen.getByRole("button", { name: "Plus sur Courgettes" }));
    const sheet = await screen.findByRole("dialog");
    act(() => live.send({ table: "shopping_items", eventType: "INSERT", new: { id: "pain" }, old: {} }));
    act(() => live.send({ table: "shopping_lists", eventType: "UPDATE", new: { id: "liste" }, old: { id: "liste" } }));
    await waitFor(() => expect(screen.getByText("1 sur 4")).toBeInTheDocument(), { timeout: 2000 });
    expect(loadListItemsAction).toHaveBeenCalledTimes(1);
    expect(loadListItemsAction).toHaveBeenCalledWith("liste");
    expect(sheet).toBeInTheDocument();
  });

  it("la liste mise à jour sur l'autre téléphone : le bandeau « Le menu a changé » s'en va", async () => {
    vi.mocked(loadListItemsAction).mockResolvedValue({
      list: { items: ITEMS, ingredients: {}, fridgeDates: {}, outdated: null, storedAt: null, settledAt: null },
    });
    renderBoard(ITEMS, { outdated: "menu" });
    await waitFor(() => expect(live.handlers).toHaveLength(2));
    expect(screen.getByText("Le menu a changé")).toBeInTheDocument();
    act(() => live.send({ table: "shopping_lists", eventType: "UPDATE", new: { id: "liste" }, old: { id: "liste" } }));
    await waitFor(() => expect(screen.queryByText("Le menu a changé")).toBeNull(), { timeout: 2000 });
  });
});
