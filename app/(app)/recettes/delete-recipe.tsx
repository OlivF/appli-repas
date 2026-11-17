"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { FormSubmit } from "@/components/form-submit";
import { Button } from "@/components/ui/button";
import { deleteRecipe } from "./actions";

// Supprimer en deux touches : la première demande confirmation.
export function DeleteRecipe({ recipeId, fromCatalog }: { recipeId: string; fromCatalog: boolean }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" block variant="destructive" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden="true" />
        Supprimer la recette
      </Button>
    );
  }

  return (
    <form action={deleteRecipe} className="space-y-3 rounded-2xl border-2 border-destructive/40 p-4 text-center">
      <input type="hidden" name="id" value={recipeId} />
      <p role="alert" className="font-semibold">
        {fromCatalog
          ? "Supprimer ta version ? La recette du catalogue reviendra dans ta liste."
          : "Supprimer cette recette ? Elle ne pourra pas être récupérée."}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <FormSubmit variant="destructive" pendingLabel="Suppression…">
          <Trash2 aria-hidden="true" />
          Oui, supprimer
        </FormSubmit>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Non, garder
        </Button>
      </div>
    </form>
  );
}
