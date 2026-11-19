"use client";

import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Autocomplete, type AutocompleteOption } from "@/components/autocomplete";
import { FieldError } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// « Ajouter un article », fixé au-dessus du menu du bas (en bas de l'écran sur ordinateur) : un
// nom (suggestions du référentiel, ouvertes vers le haut), une quantité libre facultative.
// `onAdd` rend un message d'erreur, ou null.
export function ShoppingAddBar({
  options,
  onAdd,
  fixed = true,
}: {
  options: AutocompleteOption[];
  onAdd: (label: string, quantity: string) => Promise<string | null>;
  // Dans la page /design, la barre reste dans le flux.
  fixed?: boolean;
}) {
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (adding) return;
    setAdding(true);
    const message = await onAdd(label, quantity);
    setAdding(false);
    setError(message);
    if (!message) {
      setLabel("");
      setQuantity("");
      nameInput.current?.focus();
    }
  }

  return (
    <div
      className={
        fixed
          ? "fixed inset-x-0 bottom-[calc(4.1875rem+max(0.375rem,env(safe-area-inset-bottom)))] z-30 px-3 pb-2 lg:bottom-0 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          : undefined
      }
    >
      <form
        aria-label="Ajouter un article"
        onSubmit={submit}
        // Les suggestions s'ancrent sur la barre entière (pas sur le seul champ du nom).
        className="relative mx-auto w-full max-w-2xl rounded-3xl border border-border/80 bg-card/95 p-2 shadow-bar backdrop-blur-md"
      >
        {error && (
          <div className="px-2 pt-1 pb-2">
            <FieldError alert>{error}</FieldError>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Autocomplete
            ref={nameInput}
            id="shopping-add"
            aria-label="Article à ajouter"
            placeholder="Ajouter un article…"
            value={label}
            onValueChange={setLabel}
            options={options}
            placement="top"
            enterKeyHint="done"
            maxLength={80}
            className="static min-w-0 flex-1"
          />
          <Input
            aria-label="Quantité (facultatif)"
            placeholder="Qté"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            maxLength={40}
            className="w-20 shrink-0 sm:w-28"
          />
          <Button type="submit" size="icon" aria-label="Ajouter" disabled={adding}>
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </form>
    </div>
  );
}
