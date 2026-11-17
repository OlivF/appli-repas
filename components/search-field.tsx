"use client";

import { Search, X } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

// Champ de recherche : la loupe à gauche, une croix pour tout effacer quand il y a du texte.
export function SearchField({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  className,
}: {
  id: string;
  // Lu par les lecteurs d'écran ; la loupe et le texte d'exemple suffisent à l'œil.
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        className="rounded-full pr-13 pl-12 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          className="press absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">Effacer la recherche</span>
        </button>
      )}
    </div>
  );
}
