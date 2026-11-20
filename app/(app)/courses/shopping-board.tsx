"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Copy, House, Refrigerator, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AisleIcon } from "@/components/aisle-icon";
import { FieldError } from "@/components/field";
import { ShoppingAddBar } from "@/components/shopping-add-bar";
import { ShoppingAisle, ShoppingFold } from "@/components/shopping-aisle";
import { ShoppingItemSheet } from "@/components/shopping-item-sheet";
import { HomeItemRow, PantryItemRow, ShoppingItemRow } from "@/components/shopping-item-row";
import { StoreGroceriesCard, StoreGroceriesSheet, type StoredEntry, type StoreRow } from "@/components/store-groceries";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStoredFlag } from "@/components/use-stored-flag";
import { defaultBestBefore } from "@/lib/fridge";
import type { KnownIngredient } from "@/lib/recipes-data";
import {
  SHOPPING_AISLES,
  formatAmounts,
  isAtHome,
  itemQuantity,
  shoppingListText,
  shoppingProgress,
  shoppingSections,
  usageLabel,
} from "@/lib/shopping";
import type { ListIngredient, ListItem, Outdated } from "@/lib/shopping-data";
import {
  fridgeNote,
  fridgeSourceLine,
  parseManualItem,
  preStored,
  storeCandidates,
  storeProposalVisible,
  storedQuantity,
} from "@/lib/shopping-items";
import {
  addItemAction,
  deleteItemAction,
  editItemAction,
  setCheckedAction,
  setNeededAction,
  setRemovedAction,
  skipStoringAction,
  storeGroceriesAction,
  uncheckAllAction,
  updateListAction,
  type DoneResult,
} from "./actions";

type ItemChange = Partial<Pick<ListItem, "checked" | "removed" | "needed" | "quantity_changed">>;

// La liste de la semaine, telle qu'on la suit au drive : chaque geste s'affiche tout de suite et
// s'enregistre ; s'il ne s'enregistre pas, l'article revient comme avant et un message le dit.
// Le frigo : ce qu'il donne à la liste (« + 200 g au frigo », « Déjà à la maison »), et, les
// courses faites, « Range-les au frigo ».
export function ShoppingBoard({
  today,
  weekStart,
  label,
  listId,
  outdated: initialOutdated,
  initialItems,
  known,
  ingredients = {},
  fridgeDates = {},
  storedAt: initialStoredAt = null,
  settledAt = null,
}: {
  today: string;
  weekStart: string;
  label: string;
  listId: string;
  outdated: Outdated;
  initialItems: ListItem[];
  known: KnownIngredient[];
  ingredients?: Record<string, ListIngredient>;
  fridgeDates?: Record<string, string>;
  storedAt?: string | null;
  settledAt?: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [outdated, setOutdated] = useState(initialOutdated);
  const [storedAt, setStoredAt] = useState(initialStoredAt);
  const [storing, setStoring] = useState(false);
  const [later, setLater] = useStoredFlag("session", `popote:ranger-plus-tard:${listId}`, false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sections = shoppingSections(items);
  const progress = shoppingProgress(items);
  const openItem = items.find((item) => item.id === openId) ?? null;
  const unitOf = (item: ListItem) => (item.ingredient_id ? (ingredients[item.ingredient_id]?.unit ?? null) : null);

  // Ranger les courses : les articles cochés pas encore rangés, dans l'ordre des rayons.
  const candidates = settledAt ? [] : storeCandidates(sections.aisles.flatMap((section) => section.items));
  const showStoreCard =
    !later && storeProposalVisible({ items, list: { stored_at: storedAt, settled_at: settledAt }, weekStart, today });
  const storeRows: StoreRow[] = candidates.map((item) => {
    const info = item.ingredient_id ? ingredients[item.ingredient_id] : undefined;
    const quantity = storedQuantity(item, info?.unit ?? null);
    return {
      id: item.id,
      label: item.label,
      quantity,
      quantityLabel: quantity !== null && info ? formatAmounts([{ quantity, unit: info.unit }]) : "",
      bestBefore: info ? defaultBestBefore({ shelf_life_days: info.shelfLifeDays }, today) : null,
      checked: preStored(item),
    };
  });
  const options = useMemo(
    () =>
      known.map((ingredient) => ({
        value: ingredient.name,
        hint: SHOPPING_AISLES.find((aisle) => aisle.value === ingredient.aisle)?.label,
      })),
    [known],
  );

  // Optimiste : l'article change tout de suite ; en cas d'échec, il revient (s'il n'a pas changé
  // entre-temps) et le message s'affiche.
  async function change(id: string, next: ItemChange, action: () => Promise<DoneResult>) {
    const before = items.find((item) => item.id === id);
    if (!before) return;
    const previous = Object.fromEntries(Object.keys(next).map((key) => [key, before[key as keyof ItemChange]])) as ItemChange;
    setError(null);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...next } : item)));
    const result = await action();
    if ("error" in result) {
      setItems((current) =>
        current.map((item) =>
          item.id === id && Object.entries(next).every(([key, value]) => item[key as keyof ItemChange] === value)
            ? { ...item, ...previous }
            : item,
        ),
      );
      setError(result.error);
    }
  }

  function toggle(item: ListItem) {
    const checked = !item.checked;
    void change(item.id, checked ? { checked, quantity_changed: false } : { checked }, () => setCheckedAction(item.id, checked));
  }

  function setRemoved(item: ListItem, removed: boolean) {
    setOpenId(null);
    void change(item.id, { removed, checked: false }, () => setRemovedAction(item.id, removed));
  }

  function setNeeded(item: ListItem, needed: boolean) {
    setOpenId(null);
    void change(item.id, { needed, checked: false }, () => setNeededAction(item.id, needed));
  }

  async function uncheckAll() {
    const before = items;
    setConfirming(false);
    setError(null);
    setItems((current) => current.map((item) => ({ ...item, checked: false })));
    const result = await uncheckAllAction(listId);
    if ("error" in result) {
      setItems(before);
      setError(result.error);
    }
  }

  async function add(text: string, quantity: string) {
    const result = await addItemAction(listId, text, quantity);
    if ("error" in result) return result.error;
    setItems((current) => [...current, result.item]);
    return null;
  }

  async function edit(text: string, quantity: string) {
    if (!openItem) return null;
    const id = openItem.id;
    const result = await editItemAction(id, text, quantity);
    if ("error" in result) return result.error;
    const parsed = parseManualItem(text, quantity);
    if (parsed.ok) {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, label: parsed.label, quantity_text: parsed.quantityText } : item)),
      );
    }
    return null;
  }

  async function remove(item: ListItem) {
    setOpenId(null);
    setError(null);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    const result = await deleteItemAction(item.id);
    if ("error" in result) {
      setItems((current) => [...current, item]);
      setError(result.error);
    }
  }

  async function update() {
    setUpdating(true);
    setError(null);
    const result = await updateListAction(weekStart);
    setUpdating(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setItems(result.items);
    setOutdated(null);
  }

  async function store(entries: StoredEntry[]) {
    const result = await storeGroceriesAction(listId, entries);
    if ("error" in result) return result.error;
    const ids = new Set(entries.map((entry) => entry.itemId));
    setItems((current) => current.map((item) => (ids.has(item.id) ? { ...item, stored: true } : item)));
    setStoredAt(new Date().toISOString());
    setStoring(false);
    toast(entries.length > 1 ? `${entries.length} articles rangés au frigo` : "Rangé au frigo");
    return null;
  }

  async function skipStoring() {
    setStoring(false);
    setError(null);
    const before = storedAt;
    setStoredAt(new Date().toISOString());
    const result = await skipStoringAction(listId);
    if ("error" in result) {
      setStoredAt(before);
      setError(result.error);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shoppingListText(label, items));
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("La copie n’a pas marché. Réessaie.");
    }
  }

  return (
    <>
      {showStoreCard && (
        <div className="mt-6">
          <StoreGroceriesCard onStore={() => setStoring(true)} onLater={setLater} />
        </div>
      )}

      <div className="mt-6">
        <p className="font-heading text-[1.625rem] leading-tight tabular-nums">
          {`${progress.done} sur ${progress.total}`}
          <span className="sr-only"> articles pris</span>
        </p>
        <Progress
          value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
          aria-label="Articles pris"
          className="mt-2 h-1.5"
        />
      </div>

      {outdated && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-mustard-soft py-2 pr-2 pl-4">
          <p className="font-semibold text-mustard-deep">{outdated === "fridge" ? "Le frigo a changé" : "Le menu a changé"}</p>
          <Button type="button" variant="ghost" size="sm" onClick={update} disabled={updating}>
            <RefreshCw aria-hidden="true" className={updating ? "animate-spin motion-reduce:animate-none" : undefined} />
            {updating ? "Mise à jour…" : "Mettre à jour la liste"}
          </Button>
        </div>
      )}

      <div className="mt-3 min-h-6" aria-live="polite">
        {error && <FieldError alert>{error}</FieldError>}
      </div>

      {sections.aisles.length === 0 && (
        <p role="status" className="mt-2 font-semibold text-muted-foreground">
          Rien à acheter pour l’instant.
        </p>
      )}

      <div className="mt-2 space-y-4">
        {sections.aisles.map((section) => (
          <ShoppingAisle key={section.aisle} aisle={section.aisle} label={section.label} remaining={section.remaining}>
            {section.items.map((item) => (
              <ShoppingItemRow
                key={item.id}
                item={{
                  id: item.id,
                  label: item.label,
                  quantity: itemQuantity(item),
                  checked: item.checked,
                  quantityChanged: item.quantity_changed,
                  note: fridgeNote(item, unitOf(item)),
                }}
                onToggle={() => toggle(item)}
                onMore={() => setOpenId(item.id)}
              />
            ))}
          </ShoppingAisle>
        ))}

        {sections.pantry.length > 0 && (
          <ShoppingFold icon={<AisleIcon aisle="placard" className="size-5" />} title="Placard" hint="À vérifier avant de commander">
            {sections.pantry.map((item) => (
              <PantryItemRow key={item.id} label={item.label} note={usageLabel(item.sources)} onNeeded={() => setNeeded(item, true)} />
            ))}
          </ShoppingFold>
        )}

        {sections.home.length > 0 && (
          <ShoppingFold
            icon={<House aria-hidden="true" className="size-5" />}
            title={`Déjà à la maison (${sections.home.length})`}
            hint="Au frigo ou déjà là"
          >
            {sections.home.map((item) => (
              <HomeItemRow
                key={item.id}
                label={item.label}
                note={isAtHome(item) ? fridgeNote(item, unitOf(item)) : null}
                onRestore={item.removed ? () => setRemoved(item, false) : undefined}
              />
            ))}
          </ShoppingFold>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button type="button" variant="secondary" size="lg" block className="max-w-sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Liste copiée" : "Copier la liste"}
        </Button>
        {candidates.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setStoring(true)}>
            <Refrigerator aria-hidden="true" />
            Ranger au frigo
          </Button>
        )}
        {progress.done > 0 &&
          (confirming ? (
            <div role="group" aria-label="Tout décocher ?" className="w-full max-w-sm space-y-3 rounded-2xl border-2 border-destructive/40 p-4 text-center">
              <p className="font-semibold">Tout décocher ? Les {progress.done} articles pris reviendront dans la liste.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button type="button" variant="destructive" onClick={uncheckAll}>
                  Oui, tout décocher
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
                  Non, garder
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              Tout décocher
            </Button>
          ))}
      </div>

      {/* La place de la barre « Ajouter un article », fixée en bas. */}
      <div aria-hidden="true" className="h-24" />
      <ShoppingAddBar options={options} onAdd={add} />

      <ShoppingItemSheet
        item={
          openItem && {
            label: openItem.label,
            quantity: itemQuantity(openItem),
            manual: openItem.manual,
            pantry: openItem.pantry,
            needed: openItem.needed,
            quantityText: openItem.quantity_text,
            sources: openItem.sources,
            fridgeLine: fridgeSourceLine(
              openItem,
              unitOf(openItem),
              openItem.ingredient_id ? (fridgeDates[openItem.ingredient_id] ?? null) : null,
              today,
            ),
          }
        }
        open={openItem !== null}
        onOpenChange={(open) => !open && setOpenId(null)}
        onHaveIt={() => openItem && setRemoved(openItem, true)}
        onBackToPantry={() => openItem && setNeeded(openItem, false)}
        onEdit={edit}
        onDelete={() => openItem && remove(openItem)}
      />

      <StoreGroceriesSheet
        open={storing && storeRows.length > 0}
        onOpenChange={(open) => !open && setStoring(false)}
        rows={storeRows}
        today={today}
        onStore={store}
        onSkip={() => void skipStoring()}
      />
    </>
  );
}
