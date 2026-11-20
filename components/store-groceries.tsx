"use client";

import { useState } from "react";
import { CalendarDays, Refrigerator } from "lucide-react";
import { BestBeforeChips, type BestBeforeValue } from "@/components/best-before-chips";
import { FieldError } from "@/components/field";
import { CheckMark } from "@/components/shopping-item-row";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { dateForPreset, dayDate, presetFor } from "@/lib/fridge-items";

// « Courses faites ? Range-les au frigo » : en haut de la liste, une fois les courses faites.
export function StoreGroceriesCard({ onStore, onLater }: { onStore: () => void; onLater: () => void }) {
  return (
    <section aria-label="Ranger les courses" className="rounded-3xl border border-border/80 bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-sage-soft text-sage-deep">
          <Refrigerator className="size-5" />
        </span>
        <p className="font-heading text-[1.25rem] leading-tight">Courses faites ? Range-les au frigo</p>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" className="flex-1" onClick={onStore}>
          Ranger
        </Button>
        <Button type="button" variant="ghost" onClick={onLater}>
          Plus tard
        </Button>
      </div>
    </section>
  );
}

// Un article coché, prêt à ranger : sa quantité achetée (dans l'unité d'achat) et la date limite
// proposée (selon sa conservation).
export type StoreRow = {
  id: string;
  label: string;
  quantity: number | null;
  quantityLabel: string;
  bestBefore: string | null;
  checked: boolean;
};

export type StoredEntry = { itemId: string; quantity: number | null; bestBefore: string | null };

// Le panneau « Ranger au frigo » : chaque article coché avec sa case (pré-cochés : ceux qui vont
// au frigo), sa quantité et sa date, qu'on change en la touchant. « Ranger N articles », ou
// « Non merci ». `onStore` rend un message d'erreur, ou null.
export function StoreGroceriesSheet({
  open,
  onOpenChange,
  rows,
  today,
  onStore,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: StoreRow[];
  today: string;
  onStore: (entries: StoredEntry[]) => Promise<string | null>;
  onSkip: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {open && <StoreBody key={rows.map((row) => row.id).join(" ")} {...{ rows, today, onStore, onSkip }} />}
      </SheetContent>
    </Sheet>
  );
}

function StoreBody({
  rows: initialRows,
  today,
  onStore,
  onSkip,
}: {
  rows: StoreRow[];
  today: string;
  onStore: (entries: StoredEntry[]) => Promise<string | null>;
  onSkip: () => void;
}) {
  const [rows, setRows] = useState(initialRows);
  const [dates, setDates] = useState<Record<string, BestBeforeValue>>(() =>
    Object.fromEntries(initialRows.map((row) => [row.id, { preset: presetFor(row.bestBefore, today), custom: row.bestBefore ?? "" }])),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = rows.filter((row) => row.checked);
  const dateOf = (id: string) => {
    const value = dates[id];
    return value ? dateForPreset(value.preset, value.custom, today) : null;
  };

  async function store() {
    if (saving || chosen.length === 0) return;
    setSaving(true);
    const message = await onStore(chosen.map((row) => ({ itemId: row.id, quantity: row.quantity, bestBefore: dateOf(row.id) })));
    setSaving(false);
    setError(message);
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Ranger au frigo</SheetTitle>
        <SheetDescription>Ce qui est coché part au frigo, pour le menu de la semaine. Touche une date pour la changer.</SheetDescription>
      </SheetHeader>

      <ul className="border-t border-border/70">
        {rows.map((row) => {
          const date = dateOf(row.id);
          return (
            <li key={row.id} className="border-b border-border/70 last:border-b-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={row.checked}
                  onClick={() => setRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, checked: !entry.checked } : entry)))}
                  className="press flex min-h-14 min-w-0 flex-1 items-center gap-3.5 rounded-2xl py-2 pr-2 pl-1 text-left outline-offset-2"
                >
                  <CheckMark checked={row.checked} />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug font-semibold break-words">{row.label}</span>
                    {row.quantityLabel && <span className="block text-[0.875rem] text-muted-foreground">{row.quantityLabel}</span>}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={editing === row.id}
                  aria-label={`Date limite de ${row.label} : ${date ? dayDate(date, today) : "pas de date"}`}
                  onClick={() => setEditing((current) => (current === row.id ? null : row.id))}
                  className="shrink-0 px-3 text-muted-foreground"
                >
                  <CalendarDays aria-hidden="true" className="size-4.5" />
                  {date ? dayDate(date, today) : "Pas de date"}
                </Button>
              </div>
              {editing === row.id && (
                <div className="pb-4 pl-1">
                  <BestBeforeChips
                    legend={`Date limite : ${row.label}`}
                    value={dates[row.id]}
                    onChange={(value) => setDates((current) => ({ ...current, [row.id]: value }))}
                    today={today}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <div className="mt-3">
          <FieldError alert>{error}</FieldError>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Button type="button" size="lg" block disabled={saving || chosen.length === 0} onClick={store}>
          <Refrigerator aria-hidden="true" />
          {saving ? "Rangement…" : `Ranger ${chosen.length} ${chosen.length > 1 ? "articles" : "article"}`}
        </Button>
        <Button type="button" variant="ghost" block onClick={onSkip}>
          Non merci
        </Button>
      </div>
    </>
  );
}
