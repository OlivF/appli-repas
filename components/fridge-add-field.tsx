"use client";

import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { Autocomplete, type AutocompleteOption } from "@/components/autocomplete";
import { Button } from "@/components/ui/button";

// « Ajouter au frigo », collé en haut de l'écran sous le header : un nom (suggestions du
// référentiel, ou texte libre), puis le panneau de la quantité et de la date.
export function FridgeAddField({
  value,
  onValueChange,
  options,
  onChoose,
  sticky = true,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: AutocompleteOption[];
  onChoose: (label: string) => void;
  // Dans la page /design, le champ reste dans le flux.
  sticky?: boolean;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim()) onChoose(value);
  }

  return (
    <div className={sticky ? "sticky top-[calc(var(--header-height)+0.5rem)] z-30" : undefined}>
      <form
        aria-label="Ajouter au frigo"
        onSubmit={submit}
        className="relative flex items-center gap-2 rounded-3xl border border-border/80 bg-card/95 p-2 shadow-bar backdrop-blur-md"
      >
        <Autocomplete
          id="fridge-add"
          aria-label="Ce que tu ranges"
          placeholder="Ajouter au frigo…"
          value={value}
          onValueChange={onValueChange}
          options={options}
          onPick={(option) => onChoose(option.value)}
          enterKeyHint="next"
          maxLength={80}
          className="static min-w-0 flex-1"
        />
        <Button type="submit" size="icon" aria-label="Ajouter" disabled={!value.trim()}>
          <Plus aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
