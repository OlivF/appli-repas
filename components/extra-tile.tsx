"use client";

import { Check, Heart, Refrigerator } from "lucide-react";
import { cn } from "cn";
import { COURSE_TINT } from "@/components/extra-chip";
import { DietBadge } from "@/components/diet-badge";
import { Badge } from "@/components/ui/badge";
import type { FridgeHint } from "@/lib/fridge";
import { courseOf, type Course } from "@/lib/recipes";
import type { Diet } from "@/lib/members";

export type TileRecipe = { id: string; title: string; course: Course; diets: readonly Diet[]; favorite: boolean };

// Une grosse tuile à cocher du panneau « Dessert, fruit… » : l'icône de la sorte, le titre, la
// pastille Céto, « Au frigo » (« À finir » si la date limite approche), le favori. `already` : la
// recette est déjà au repas, cochée et figée (« Déjà là » ; on la change depuis sa puce).
export function ExtraTile({
  recipe,
  checked,
  already = false,
  hint,
  onChange,
  className,
}: {
  recipe: TileRecipe;
  checked: boolean;
  already?: boolean;
  hint?: FridgeHint;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const Icon = courseOf(recipe.course).icon;
  return (
    <label
      className={cn(
        "press group relative flex h-full min-h-26 cursor-pointer flex-col gap-1.5 rounded-2xl border-2 border-border bg-card p-3 shadow-soft hover:border-input/60 has-checked:border-primary has-checked:bg-tomato-soft has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
        already && "cursor-default opacity-75 shadow-none",
        className,
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked || already}
        disabled={already}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden="true"
        className="absolute top-3 right-3 grid size-6 place-items-center rounded-full border-2 border-input bg-card text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground"
      >
        <Check className="size-3.5" strokeWidth={4} />
      </span>
      <Icon aria-hidden="true" className={cn("size-6 shrink-0", COURSE_TINT[recipe.course])} />
      <span className="line-clamp-2 pr-1 leading-snug font-semibold group-has-checked:text-tomato-deep">{recipe.title}</span>
      <span className="mt-auto flex flex-wrap items-center gap-1.5 empty:hidden">
        {already && <Badge variant="outline">Déjà là</Badge>}
        {hint && (
          <Badge variant={hint === "soon" ? "mustard" : "sage"}>
            <Refrigerator aria-hidden="true" />
            {hint === "soon" ? "À finir" : "Au frigo"}
          </Badge>
        )}
        {recipe.diets.includes("keto") && <DietBadge diet="keto" />}
        {recipe.favorite && <Heart aria-label="Favori" role="img" className="size-4 fill-primary text-primary" />}
      </span>
    </label>
  );
}
