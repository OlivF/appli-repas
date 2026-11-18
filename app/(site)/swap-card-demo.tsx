"use client";

import { PlannedMealCard } from "@/components/planned-meal-card";
import { LANDING_FAMILY, LANDING_MEALS } from "./landing-data";

const noop = () => {};

// Étape 2 de « Comment ça marche » : une carte de la semaine, avec son cadenas et « Autre idée ».
// Décorative : rien ne s'y touche.
export function SwapCardDemo() {
  const meal = LANDING_MEALS[5];
  return (
    <div aria-hidden="true" inert>
      <PlannedMealCard
        recipe={meal.recipe}
        eaters={meal.eaters}
        household={LANDING_FAMILY}
        locked={false}
        onToggleLock={noop}
        onAnotherIdea={noop}
      />
    </div>
  );
}
