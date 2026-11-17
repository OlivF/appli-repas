"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { saveMealSlots, type MealSlotsFormState } from "./actions";
import { MealGrid } from "./meal-grid";

export function MealSlotsForm({
  members,
  selected,
}: {
  members: { id: string; first_name: string }[];
  selected: string[];
}) {
  const [state, formAction] = useActionState<MealSlotsFormState, FormData>(saveMealSlots, null);

  return (
    <form action={formAction} className="mt-6">
      {/* Après une erreur, on garde les cases cochées par l'utilisateur. */}
      <MealGrid members={members} selected={state?.selected ?? selected} />

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-line bg-enamel/95 px-4 pt-3 pb-4 backdrop-blur-sm">
        {state?.error && (
          <p role="alert" className="field-error mt-0 mb-3">
            {state.error}
          </p>
        )}
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
