import { cn } from "cn";
import { MEAL_TYPES, type MealType } from "@/lib/meal-slots";

export function mealType(type: MealType) {
  return MEAL_TYPES.find((meal) => meal.value === type) ?? MEAL_TYPES[0];
}

// « ☕ Petit-déj » : l'emoji est décoratif, le mot reste lu.
export function MealLabel({ type, className }: { type: MealType; className?: string }) {
  const meal = mealType(type);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="text-[1.15em] leading-none">
        {meal.emoji}
      </span>
      {meal.label}
    </span>
  );
}

// Couleur douce associée à chaque repas (couvertures de recettes sans photo).
export const MEAL_TINT: Record<MealType, string> = {
  petit_dej: "bg-mustard-soft",
  midi: "bg-sage-soft",
  pique_nique: "bg-oat-soft",
  soir: "bg-tomato-soft",
};
