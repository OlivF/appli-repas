"use client";

import { useId, useState, type FormEvent } from "react";
import { Check, Minus, Plus, Refrigerator, Undo2 } from "lucide-react";
import { BestBeforeChips, type BestBeforeValue } from "@/components/best-before-chips";
import { FieldError } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UNIT_WORDS, parseQuantity, presetFor, quantityStep } from "@/lib/fridge-items";
import type { ShoppingUnit } from "@/lib/shopping";

// Ce que le panneau range ou modifie.
export type FridgeSheetTarget = {
  title: string;
  unit: ShoppingUnit | null;
  // Reste de plat : la quantité compte des parts.
  parts: boolean;
  quantity: number | null;
  bestBefore: string | null;
  // Un article déjà au frigo (sinon : on le range).
  existing: boolean;
  // Rangé pour le menu d'une semaine : « Rangé pour la semaine du 23 nov. ».
  reservedFor: string | null;
};

function quantityText(quantity: number | null) {
  return quantity === null ? "" : String(Number(quantity.toFixed(2))).replace(".", ",");
}

// Le panneau d'un article : quantité (− / + au pas de l'unité, ou au clavier), date limite en
// puces, puis « Ranger » (nouvel article) ou « Enregistrer », « Fini » et « C'est un reste ».
// `onSubmit` rend un message d'erreur, ou null.
export function FridgeItemSheet({
  target,
  open,
  onOpenChange,
  today,
  onSubmit,
  onFinish,
  onFree,
}: {
  target: FridgeSheetTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
  onSubmit: (quantity: string, bestBefore: BestBeforeValue) => Promise<string | null>;
  onFinish?: () => void;
  onFree?: () => void;
}) {
  return (
    <Sheet open={open && target !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        {target && (
          // Un autre article, ou le même enregistré, repart d'un panneau neuf.
          <SheetBody
            key={`${target.title}|${target.quantity}|${target.bestBefore}|${target.reservedFor}`}
            {...{ target, today, onSubmit, onFinish, onFree }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({
  target,
  today,
  onSubmit,
  onFinish,
  onFree,
}: {
  target: FridgeSheetTarget;
  today: string;
  onSubmit: (quantity: string, bestBefore: BestBeforeValue) => Promise<string | null>;
  onFinish?: () => void;
  onFree?: () => void;
}) {
  const quantityId = useId();
  const [quantity, setQuantity] = useState(quantityText(target.quantity));
  const [date, setDate] = useState<BestBeforeValue>({
    preset: presetFor(target.bestBefore, today),
    custom: target.bestBefore ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const step = quantityStep(target.unit);
  const parsed = parseQuantity(quantity);
  const current = parsed.ok ? parsed.quantity : null;
  const unitWord = target.parts ? (current !== null && current > 1 ? "parts" : "part") : target.unit ? UNIT_WORDS[target.unit] : "";
  const stepWord = target.unit === "g" || target.unit === "ml" ? `${step} ${target.unit}` : String(step);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const message = await onSubmit(quantity, date);
    setSaving(false);
    setError(message);
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{target.title}</SheetTitle>
        {target.reservedFor ? (
          <SheetDescription>{`Rangé pour la ${target.reservedFor}`}</SheetDescription>
        ) : (
          <SheetDescription className="sr-only">{target.existing ? "Article du frigo" : "Ranger au frigo"}</SheetDescription>
        )}
      </SheetHeader>

      <form onSubmit={save} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor={quantityId} className="block text-base leading-snug font-semibold">
            Quantité <span className="font-normal text-muted-foreground">(facultatif)</span>
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`Moins ${stepWord}`}
              disabled={current === null || current <= step}
              onClick={() => current !== null && setQuantity(quantityText(current - step))}
            >
              <Minus aria-hidden="true" />
            </Button>
            <Input
              id={quantityId}
              inputMode="decimal"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="?"
              aria-invalid={parsed.ok ? undefined : true}
              className="w-28 text-center tabular-nums"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label={`Plus ${stepWord}`}
              onClick={() => setQuantity(quantityText((current ?? 0) + step))}
            >
              <Plus aria-hidden="true" />
            </Button>
            {unitWord && <span className="font-semibold text-muted-foreground">{unitWord}</span>}
          </div>
        </div>

        <BestBeforeChips value={date} onChange={setDate} today={today} />

        {error && <FieldError alert>{error}</FieldError>}

        <Button type="submit" size="lg" block disabled={saving}>
          {target.existing ? (
            <Check aria-hidden="true" />
          ) : (
            <Refrigerator aria-hidden="true" />
          )}
          {saving ? "Enregistrement…" : target.existing ? "Enregistrer" : "Ranger"}
        </Button>
      </form>

      {target.existing && (
        <div className="mt-3 flex flex-col gap-2">
          {target.reservedFor && onFree && (
            <Button type="button" variant="secondary" block onClick={onFree}>
              <Undo2 aria-hidden="true" />
              C’est un reste
            </Button>
          )}
          {onFinish && (
            <Button type="button" variant="secondary" block onClick={onFinish}>
              Fini
            </Button>
          )}
        </div>
      )}
    </>
  );
}
