"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlarmClock, CalendarDays, CookingPot, Refrigerator } from "lucide-react";
import { toast } from "sonner";
import { AisleIcon } from "@/components/aisle-icon";
import type { BestBeforeValue } from "@/components/best-before-chips";
import { EmptyState } from "@/components/empty-state";
import { FieldError } from "@/components/field";
import { FridgeAddField } from "@/components/fridge-add-field";
import { FridgeItemRow } from "@/components/fridge-item-row";
import { FridgeItemSheet, type FridgeSheetTarget } from "@/components/fridge-item-sheet";
import { FridgeGroup, FridgeSection } from "@/components/fridge-section";
import { FridgeIllustration } from "@/components/illustrations";
import { SettlementNotice } from "@/components/settlement-notice";
import { ShoppingFold } from "@/components/shopping-aisle";
import { defaultBestBefore, type FridgeItem } from "@/lib/fridge";
import {
  bestBeforeLabel,
  dateForPreset,
  findIngredient,
  formatFridgeQuantity,
  fridgeSections,
  settlementText,
  shortDate,
  type FridgeIngredient,
} from "@/lib/fridge-items";
import type { GroceryAisle } from "@/lib/recipes";
import { SHOPPING_AISLES } from "@/lib/shopping";
import { weekLabel } from "@/lib/week";
import {
  addFridgeItemAction,
  finishFridgeItemAction,
  freeFridgeItemAction,
  restoreFridgeItemAction,
  updateFridgeItemAction,
} from "./actions";

type Adding = { label: string; ingredient: FridgeIngredient | null };

const isDish = (item: FridgeItem) => item.origin === "leftover" || item.recipe_id !== null;

// Le frigo, tel qu'on le regarde porte ouverte : ce qu'il faut finir vite en haut, les restes par
// rayon, ce qui est rangé pour le menu de la semaine replié. Chaque geste s'affiche tout de suite
// et s'enregistre ; s'il ne s'enregistre pas, l'article revient et un message le dit.
export function FridgeBoard({
  today,
  items: serverItems,
  ingredients,
  aisles,
  listWeeks,
  settlement,
}: {
  today: string;
  items: FridgeItem[];
  ingredients: FridgeIngredient[];
  aisles: Record<string, GroceryAisle>;
  listWeeks: Record<string, string>;
  settlement: { listId: string; weekStart: string; remaining: number } | null;
}) {
  const [items, setItems] = useState(serverItems);
  // Rechargé par le serveur (après un geste, ou l'autre téléphone) : on repart de sa version.
  const [synced, setSynced] = useState(serverItems);
  if (serverItems !== synced) {
    setSynced(serverItems);
    setItems(serverItems);
  }
  const [text, setText] = useState("");
  const [adding, setAdding] = useState<Adding | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sections = fridgeSections(items, { listWeeks, aisles, today });
  const openItem = items.find((item) => item.id === openId) ?? null;
  const options = useMemo(
    () =>
      ingredients.map((ingredient) => ({
        value: ingredient.name,
        hint: SHOPPING_AISLES.find((aisle) => aisle.value === ingredient.aisle)?.label,
      })),
    [ingredients],
  );

  const weekOf = (item: FridgeItem) => (item.reserved_list_id ? (listWeeks[item.reserved_list_id] ?? null) : null);
  const reservedFor = (item: FridgeItem) => {
    const week = weekOf(item);
    return week ? `semaine du ${shortDate(week)}` : null;
  };

  function row(item: FridgeItem, note?: string | null) {
    return (
      <FridgeItemRow
        key={item.id}
        item={{
          id: item.id,
          label: item.label,
          quantity: formatFridgeQuantity(item),
          date: bestBeforeLabel(item.best_before, today),
          note: note ?? undefined,
        }}
        onOpen={() => setOpenId(item.id)}
        onFinish={() => void finish(item)}
      />
    );
  }

  function choose(label: string) {
    const ingredient = findIngredient(label, ingredients);
    setOpenId(null);
    setAdding({ label: ingredient?.name ?? label.replace(/\s+/g, " ").trim(), ingredient });
  }

  async function submitAdd(quantity: string, date: BestBeforeValue) {
    if (!adding) return null;
    const result = await addFridgeItemAction({
      label: adding.label,
      ingredientId: adding.ingredient?.id ?? null,
      quantity,
      bestBefore: dateForPreset(date.preset, date.custom, today),
    });
    if ("error" in result) return result.error;
    setItems((current) => [...current.filter((item) => item.id !== result.item.id), result.item]);
    setAdding(null);
    setText("");
    toast("Rangé au frigo");
    return null;
  }

  async function submitEdit(quantity: string, date: BestBeforeValue) {
    if (!openItem) return null;
    const result = await updateFridgeItemAction(openItem.id, {
      quantity,
      bestBefore: dateForPreset(date.preset, date.custom, today),
    });
    if ("error" in result) return result.error;
    setItems((current) => current.map((item) => (item.id === result.item.id ? result.item : item)));
    setOpenId(null);
    return null;
  }

  // « Fini » : la ligne s'en va tout de suite, « Annuler » la remet quelques secondes durant.
  async function finish(item: FridgeItem) {
    setOpenId(null);
    setError(null);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    const toastId = toast(`Fini : ${item.label}`, {
      action: { label: "Annuler", onClick: () => void restore(item) },
    });
    const result = await finishFridgeItemAction(item.id);
    if ("error" in result) {
      toast.dismiss(toastId);
      setItems((current) => (current.some((entry) => entry.id === item.id) ? current : [...current, item]));
      setError(result.error);
    }
  }

  async function restore(item: FridgeItem) {
    setError(null);
    setItems((current) => (current.some((entry) => entry.id === item.id) ? current : [...current, item]));
    const result = await restoreFridgeItemAction(item);
    if ("error" in result) {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setError(result.error);
    }
  }

  // « C'est un reste » : l'article n'est plus réservé au menu de sa semaine.
  async function free(item: FridgeItem) {
    setOpenId(null);
    setError(null);
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, reserved_list_id: null } : entry)));
    const result = await freeFridgeItemAction(item.id);
    if ("error" in result) {
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, reserved_list_id: item.reserved_list_id } : entry)),
      );
      setError(result.error);
    }
  }

  const target: FridgeSheetTarget | null = adding
    ? {
        title: adding.label,
        unit: adding.ingredient?.shopping_unit ?? null,
        parts: false,
        quantity: null,
        bestBefore: defaultBestBefore(adding.ingredient, today),
        existing: false,
        reservedFor: null,
      }
    : openItem && {
        title: openItem.label,
        unit: openItem.unit,
        parts: isDish(openItem),
        quantity: openItem.quantity,
        bestBefore: openItem.best_before,
        existing: true,
        reservedFor: reservedFor(openItem),
      };

  const reservedWeeks = sections.reserved.map((group) => group.weekStart);

  return (
    <>
      <div className="mt-6">
        <FridgeAddField value={text} onValueChange={setText} options={options} onChoose={choose} />
      </div>

      {settlement && (
        <div className="mt-4">
          <SettlementNotice listId={settlement.listId} text={settlementText(settlement.weekStart, settlement.remaining)} />
        </div>
      )}

      <div className="mt-3 min-h-6" aria-live="polite">
        {error && <FieldError alert>{error}</FieldError>}
      </div>

      {items.length === 0 ? (
        <EmptyState className="mt-2" illustration={<FridgeIllustration />} title="Rien au frigo pour l’instant">
          Après le drive, range tes courses ici : l’appli s’en servira pour ta prochaine liste.
        </EmptyState>
      ) : (
        <div className="mt-2 space-y-4">
          {sections.urgent.length > 0 && (
            <FridgeSection title="À finir vite" hint="À manger en premier" icon={<AlarmClock />} urgent>
              <ul className="border-t border-border/70">
                <AnimatePresence initial={false}>{sections.urgent.map((item) => row(item, reservedFor(item)))}</AnimatePresence>
              </ul>
            </FridgeSection>
          )}

          {sections.leftovers.length > 0 && (
            <FridgeSection title="Restes" icon={<Refrigerator />}>
              <div className="space-y-1">
                {sections.leftovers.map((group) => (
                  <FridgeGroup
                    key={group.key}
                    label={group.label}
                    icon={group.key === "plats" ? <CookingPot /> : <AisleIcon aisle={group.key} />}
                  >
                    <AnimatePresence initial={false}>{group.items.map((item) => row(item))}</AnimatePresence>
                  </FridgeGroup>
                ))}
              </div>
            </FridgeSection>
          )}

          {sections.reserved.length > 0 && (
            <ShoppingFold
              icon={<CalendarDays aria-hidden="true" className="size-5" />}
              title="Pour le menu de la semaine"
              hint={reservedWeeks.length === 1 && reservedWeeks[0] ? weekLabel(reservedWeeks[0]) : "Rangé depuis les courses"}
            >
              <AnimatePresence initial={false}>
                {sections.reserved.flatMap((group) =>
                  group.items.map((item) => row(item, reservedWeeks.length > 1 ? reservedFor(item) : null)),
                )}
              </AnimatePresence>
            </ShoppingFold>
          )}
        </div>
      )}

      <FridgeItemSheet
        target={target}
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(null);
            setOpenId(null);
          }
        }}
        today={today}
        onSubmit={adding ? submitAdd : submitEdit}
        onFinish={openItem ? () => void finish(openItem) : undefined}
        onFree={openItem ? () => void free(openItem) : undefined}
      />
    </>
  );
}
