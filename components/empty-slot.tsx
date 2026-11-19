"use client";

import type { ComponentProps } from "react";
import { Plus } from "lucide-react";
import { cn } from "cn";

// Un repas sans plat : un cadre en pointillés pour en choisir un (on peut aussi y lâcher
// une recette de la Bibliothèque). `label` : lu par les lecteurs d'écran.
// `variant="add"` : sous les plats d'un repas rempli, un petit cadre « + Ajouter un plat ».
export function EmptySlot({
  label,
  onClick,
  dropState,
  compact = false,
  variant = "choose",
  className,
  ...props
}: {
  label: string;
  onClick?: () => void;
  dropState?: "target" | "refused";
  compact?: boolean;
  variant?: "choose" | "add";
  className?: string;
} & Omit<ComponentProps<"button">, "children" | "onClick">) {
  const add = variant === "add";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="dialog"
      className={cn(
        "press flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/50 font-semibold text-muted-foreground outline-none hover:border-input/60 hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
        add ? "min-h-11 gap-1.5 text-[0.9375rem]" : compact ? "min-h-24 flex-col text-[0.9375rem]" : "min-h-18 text-base",
        dropState === "target" && "border-primary bg-tomato-soft text-tomato-deep",
        dropState === "refused" && "opacity-35",
        className,
      )}
      {...props}
    >
      <Plus aria-hidden="true" className={add ? "size-4" : "size-5"} />
      {add ? "Ajouter un plat" : "Choisir"}
    </button>
  );
}
