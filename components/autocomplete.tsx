"use client";

import { useId, useMemo, useState, type ComponentProps } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { normalizeText } from "@/lib/recipes";

export type AutocompleteOption = { value: string; hint?: string };

const MAX_SUGGESTIONS = 6;

// Les suggestions pour ce qui est tapé : sans accents, celles qui commencent pareil d'abord.
function suggest(options: AutocompleteOption[], query: string) {
  const typed = normalizeText(query);
  if (!typed) return [];
  return options
    .map((option) => ({ option, text: normalizeText(option.value) }))
    .filter(({ text }) => text.includes(typed) && text !== typed)
    .sort((a, b) => Number(!a.text.startsWith(typed)) - Number(!b.text.startsWith(typed)) || a.text.localeCompare(b.text, "fr"))
    .slice(0, MAX_SUGGESTIONS)
    .map(({ option }) => option);
}

// Champ avec suggestions (motif « combobox » ARIA) : flèches pour parcourir, Entrée pour
// choisir, Échap pour fermer ; au toucher, on choisit d'un doigt.
export function Autocomplete({
  id,
  value,
  onValueChange,
  options,
  onPick,
  placement = "bottom",
  className,
  ...input
}: Omit<ComponentProps<"input">, "value" | "onChange" | "id"> & {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: AutocompleteOption[];
  onPick?: (option: AutocompleteOption) => void;
  // « top » : les suggestions s'ouvrent au-dessus (champ fixé en bas de l'écran).
  placement?: "bottom" | "top";
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useMemo(() => suggest(options, value), [options, value]);
  const expanded = open && suggestions.length > 0;

  function pick(option: AutocompleteOption) {
    onValueChange(option.value);
    onPick?.(option);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div className={cn("relative", className)}>
      <Input
        {...input}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onBlur={(event) => {
          setOpen(false);
          input.onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (suggestions.length === 0) return;
            event.preventDefault();
            setOpen(true);
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((current) => (current + step + suggestions.length) % suggestions.length);
          } else if (event.key === "Enter" && expanded && active >= 0) {
            event.preventDefault();
            pick(suggestions[active]);
          } else if (event.key === "Escape" && expanded) {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          }
          input.onKeyDown?.(event);
        }}
      />
      <ul
        id={listId}
        role="listbox"
        hidden={!expanded}
        className={cn(
          "absolute inset-x-0 z-30 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lift",
          placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {expanded &&
          suggestions.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // Garde le focus dans le champ : le choix se fait au relâchement.
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-base aria-selected:bg-tomato-soft aria-selected:text-tomato-deep hover:bg-muted"
            >
              <span className="font-semibold">{option.value}</span>
              {option.hint && <span className="text-[0.875rem] text-muted-foreground">{option.hint}</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}
