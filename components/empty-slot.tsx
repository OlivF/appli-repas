"use client";

import type { ComponentProps } from "react";
import { Plus } from "lucide-react";
import { cn } from "cn";

// Un repas sans plat : un cadre en pointillés pour en choisir un (on peut aussi y lâcher
// une recette de la Bibliothèque). `label` : lu par les lecteurs d'écran.
export function EmptySlot({
  label,
  onClick,
  dropState,
  compact = false,
  className,
  ...props
}: {
  label: string;
  onClick?: () => void;
  dropState?: "target" | "refused";
  compact?: boolean;
  className?: string;
} & Omit<ComponentProps<"button">, "children" | "onClick">) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-haspopup="dialog"
      className={cn(
        "press flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card/50 font-semibold text-muted-foreground outline-none hover:border-input/60 hover:text-foreground focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
        compact ? "min-h-24 flex-col text-[0.9375rem]" : "min-h-18 text-base",
        dropState === "target" && "border-primary bg-tomato-soft text-tomato-deep",
        dropState === "refused" && "opacity-35",
        className,
      )}
      {...props}
    >
      <Plus aria-hidden="true" className="size-5" />
      Choisir
    </button>
  );
}
