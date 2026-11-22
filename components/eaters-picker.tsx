"use client";

import { useId } from "react";
import type { AvatarMember } from "@/components/member-avatar";
import { MemberToggle } from "@/components/member-toggle";
import { Mismatch } from "@/components/planned-meal-card";
import type { Diet } from "@/lib/members";
import { dietReason, memberEatability } from "@/lib/recipes";

export type PickerMember = AvatarMember & { diets: readonly Diet[] };

// « Pour qui ? » / « Qui mange ce plat ? » : les présents du repas en avatars à cocher, leur
// régime sous le prénom. Avec `recipe`, signale un coché qu'elle ne respecte pas (il reste
// cochable : on peut vouloir lui servir quand même).
export function EatersPicker({
  members,
  selected,
  onChange,
  recipe,
  label = "Pour qui ?",
  labelHidden = false,
  memberLabel,
  className,
}: {
  members: readonly PickerMember[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  recipe?: { diets: readonly Diet[]; excludedIds: readonly string[] };
  label?: string;
  // Le titre du panneau le dit déjà : le libellé reste pour les lecteurs d'écran.
  labelHidden?: boolean;
  // Le nom lu de chaque avatar (« Léa est là ») ; « Léa mange ce plat » sinon.
  memberLabel?: (firstName: string) => string;
  className?: string;
}) {
  const id = useId();
  const unsuitable = recipe
    ? members.filter(
        (member) => selected.includes(member.id) && memberEatability(recipe, member, recipe.excludedIds) !== "ok",
      )
    : [];

  function toggle(memberId: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(memberId);
    else next.delete(memberId);
    onChange(members.filter((member) => next.has(member.id)).map((member) => member.id));
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className={className}>
      <h3 id={`${id}-label`} className={labelHidden ? "sr-only" : "text-xl"}>
        {label}
      </h3>
      <div className="mt-2 flex flex-wrap">
        {members.map((member) => (
          <MemberToggle
            key={member.id}
            mode="pick"
            member={member}
            pressed={selected.includes(member.id)}
            label={memberLabel?.(member.first_name)}
            reason={member.diets.length > 0 ? dietReason(member.diets) : undefined}
            onPressedChange={(on) => toggle(member.id, on)}
          />
        ))}
      </div>
      {unsuitable.length > 0 && (
        <p className="mt-1">
          <Mismatch
            names={new Intl.ListFormat("fr", { type: "conjunction" }).format(unsuitable.map((member) => member.first_name))}
          />
        </p>
      )}
    </div>
  );
}
