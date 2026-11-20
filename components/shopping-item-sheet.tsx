"use client";

import { useState, type FormEvent } from "react";
import { Archive, House, Pencil, Refrigerator, Trash2 } from "lucide-react";
import { Field, FieldError } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { sourceDetail, type ShoppingSource } from "@/lib/shopping";

export type SheetItem = {
  label: string;
  quantity: string;
  manual: boolean;
  pantry: boolean;
  needed: boolean;
  quantityText: string | null;
  sources: ShoppingSource[];
  // « Au frigo : 200 g, jusqu'au mar. 24 ».
  fridgeLine?: string | null;
};

// Le panneau d'un article : « Pour quoi ? » (les plats qui le demandent), « J'en ai déjà », et pour
// un article ajouté à la main, modifier ou supprimer. `onEdit` rend un message d'erreur, ou null.
export function ShoppingItemSheet({
  item,
  open,
  onOpenChange,
  onHaveIt,
  onBackToPantry,
  onEdit,
  onDelete,
}: {
  item: SheetItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHaveIt: () => void;
  onBackToPantry: () => void;
  onEdit: (label: string, quantity: string) => Promise<string | null>;
  onDelete: () => void;
}) {
  return (
    <Sheet open={open && item !== null} onOpenChange={onOpenChange}>
      <SheetContent>
        {item && (
          // Un autre article repart d'un panneau neuf (formulaire fermé, champs pré-remplis).
          <SheetBody key={`${item.label}|${item.quantityText ?? ""}`} item={item} {...{ onHaveIt, onBackToPantry, onEdit, onDelete }} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({
  item,
  onHaveIt,
  onBackToPantry,
  onEdit,
  onDelete,
}: {
  item: SheetItem;
  onHaveIt: () => void;
  onBackToPantry: () => void;
  onEdit: (label: string, quantity: string) => Promise<string | null>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(item.label);
  const [quantity, setQuantity] = useState(item.quantityText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const message = await onEdit(label, quantity);
    setSaving(false);
    setError(message);
    if (!message) setEditing(false);
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{item.label}</SheetTitle>
        {item.quantity ? <SheetDescription>{item.quantity}</SheetDescription> : <SheetDescription className="sr-only">Article de la liste</SheetDescription>}
      </SheetHeader>

      <section aria-labelledby="pour-quoi" className="rounded-2xl bg-muted/70 px-4 py-3">
        <h3 id="pour-quoi" className="text-[1.125rem]">
          Pour quoi ?
        </h3>
        {item.sources.length > 0 ? (
          <ul className="mt-1 space-y-2">
            {item.sources.map((source, index) => (
              <li key={`${source.recipeId}-${source.day}-${source.mealType}-${index}`} className="leading-snug">
                <span className="block font-semibold">{source.recipeTitle}</span>
                <span className="sr-only"> · </span>
                <span className="block text-[0.9375rem] text-muted-foreground">{sourceDetail(source)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted-foreground">Ajouté à la main</p>
        )}
        {item.fridgeLine && (
          <p className="mt-2 flex items-center gap-2 border-t border-border/70 pt-2 font-semibold">
            <Refrigerator aria-hidden="true" className="size-4.5 shrink-0 text-sage-deep" />
            {item.fridgeLine}
          </p>
        )}
      </section>

      {editing ? (
        <form onSubmit={save} className="mt-5 space-y-4">
          <Field id="article-label" label="Article">
            {() => <Input id="article-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} />}
          </Field>
          <Field id="article-quantity" label="Quantité" help="Facultatif : « 2 », « 500 g », « 1 paquet ».">
            {({ describedBy }) => (
              <Input
                id="article-quantity"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                maxLength={40}
                aria-describedby={describedBy}
              />
            )}
          </Field>
          {error && <FieldError alert>{error}</FieldError>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" variant="secondary" block onClick={onHaveIt}>
            <House aria-hidden="true" />
            J&apos;en ai déjà
          </Button>
          {item.pantry && item.needed && (
            <Button type="button" variant="secondary" block onClick={onBackToPantry}>
              <Archive aria-hidden="true" />
              Remettre au placard
            </Button>
          )}
          {item.manual && (
            <>
              <Button type="button" variant="secondary" block onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Modifier
              </Button>
              <Button type="button" variant="destructive" block onClick={onDelete}>
                <Trash2 aria-hidden="true" />
                Supprimer
              </Button>
            </>
          )}
        </div>
      )}
    </>
  );
}
