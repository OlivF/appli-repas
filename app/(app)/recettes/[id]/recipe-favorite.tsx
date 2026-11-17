"use client";

import { useOptimistic, useState, useTransition } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { FieldError } from "@/components/field";
import { toggleFavorite } from "../actions";

// Le cœur de la fiche : il change tout de suite, l'enregistrement suit.
export function RecipeFavorite({ recipeId, favorite }: { recipeId: string; favorite: boolean }) {
  const [on, setOn] = useOptimistic(favorite);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  return (
    <div className="flex flex-col items-end gap-1">
      <FavoriteButton
        on={on}
        pending={pending}
        onToggle={(next) =>
          startTransition(async () => {
            setOn(next);
            const result = await toggleFavorite(recipeId, next);
            setError(result.error);
          })
        }
      />
      {error && <FieldError alert>{error}</FieldError>}
    </div>
  );
}
