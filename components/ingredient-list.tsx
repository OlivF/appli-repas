import { cn } from "cn";
import { formatIngredientQuantity, type IngredientUnit } from "@/lib/recipes";

export type ListIngredient = { name: string; quantity: number | null; unit: IngredientUnit | null };

// Ingrédients d'une recette pour `persons` personnes : le nom à gauche, la quantité à
// droite (pas de pluriel à accorder). La recette est écrite pour `servings` personnes.
export function IngredientList({
  ingredients,
  servings,
  persons,
  className,
}: {
  ingredients: ListIngredient[];
  servings: number;
  persons: number;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border/80 border-y border-border/80", className)}>
      {ingredients.map((ingredient, index) => (
        <li key={`${index}-${ingredient.name}`} className="flex items-baseline justify-between gap-4 py-3">
          <span>{ingredient.name}</span>
          <span className="shrink-0 text-right font-semibold whitespace-nowrap tabular-nums">
            {formatIngredientQuantity(ingredient.quantity, ingredient.unit, servings, persons)}
          </span>
        </li>
      ))}
    </ul>
  );
}
