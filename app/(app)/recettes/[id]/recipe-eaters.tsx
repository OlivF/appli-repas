"use client";

import { useOptimistic, useState, useTransition } from "react";
import { FieldError } from "@/components/field";
import { MemberToggle } from "@/components/member-toggle";
import type { Diet } from "@/lib/members";
import { describeEaters, dietReason, incompatibleDiets, memberEatability } from "@/lib/recipes";
import type { RecipeMember } from "@/lib/recipes-data";
import { toggleExclusion } from "../actions";

// Qui est à table pour cette recette : touche un avatar pour dire qu'il n'en mange pas,
// c'est enregistré aussitôt (catalogue compris).
export function RecipeEaters({
  recipeId,
  recipeDiets,
  members,
  excludedIds,
}: {
  recipeId: string;
  recipeDiets: Diet[];
  members: RecipeMember[];
  excludedIds: string[];
}) {
  const [excluded, setExcluded] = useOptimistic(excludedIds);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const outIds = members
    .filter((member) => memberEatability({ diets: recipeDiets }, member, excluded) !== "ok")
    .map((member) => member.id);

  return (
    <div>
      <p className="font-semibold text-muted-foreground">{describeEaters(members, outIds)}</p>
      <div className="mt-3 flex flex-wrap">
        {members.map((member) => {
          const blocked = incompatibleDiets(recipeDiets, member.diets);
          return (
            <MemberToggle
              key={member.id}
              member={member}
              pressed={outIds.includes(member.id)}
              disabled={blocked.length > 0}
              reason={blocked.length > 0 ? dietReason(blocked) : undefined}
              onPressedChange={(pressed) =>
                startTransition(async () => {
                  setExcluded(pressed ? [...excluded, member.id] : excluded.filter((id) => id !== member.id));
                  const result = await toggleExclusion(recipeId, member.id, pressed);
                  setError(result.error);
                })
              }
            />
          );
        })}
      </div>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">Touche un prénom pour dire qu’il n’en mange pas.</p>
      {error && <FieldError alert>{error}</FieldError>}
    </div>
  );
}
