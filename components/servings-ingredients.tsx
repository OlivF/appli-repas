"use client";

import { useId, useState } from "react";
import { IngredientList, type ListIngredient } from "@/components/ingredient-list";
import { Slider } from "@/components/ui/slider";

export const MIN_PERSONS = 1;
export const MAX_PERSONS = 12;

// Les ingrédients avec leur curseur « pour N personnes » : les quantités suivent le curseur.
export function ServingsIngredients({
  ingredients,
  servings,
  initialPersons,
}: {
  ingredients: ListIngredient[];
  // Nombre de personnes pour lequel la recette est écrite.
  servings: number;
  initialPersons: number;
}) {
  const id = useId();
  const [persons, setPersons] = useState(clamp(initialPersons));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p id={id} className="text-base font-semibold">
          Pour{" "}
          <output aria-live="polite" className="font-heading text-[1.625rem] text-tomato-deep tabular-nums">
            {persons}
          </output>{" "}
          {persons > 1 ? "personnes" : "personne"}
        </p>
        <p className="text-[0.875rem] text-muted-foreground">Recette pour {servings}</p>
      </div>
      <Slider
        className="mt-1"
        min={MIN_PERSONS}
        max={MAX_PERSONS}
        step={1}
        value={[persons]}
        onValueChange={([value]) => setPersons(value)}
        thumbLabel="Nombre de personnes"
        aria-labelledby={id}
      />
      <IngredientList className="mt-4" ingredients={ingredients} servings={servings} persons={persons} />
    </div>
  );
}

function clamp(value: number) {
  return Math.min(MAX_PERSONS, Math.max(MIN_PERSONS, Math.round(value)));
}
