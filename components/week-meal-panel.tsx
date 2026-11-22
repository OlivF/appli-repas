"use client";

import { Trash2 } from "lucide-react";
import { cn } from "cn";
import { ChoiceChip } from "@/components/choice-chip";
import { EatersPicker, type PickerMember } from "@/components/eaters-picker";
import { MemberAvatars, type AvatarMember } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MEAL_TYPES, type MealType } from "@/lib/meal-slots";

const labelOf = (mealType: MealType) => MEAL_TYPES.find((meal) => meal.value === mealType)!.label;

// « Qui est là ? » pour un repas, cette semaine seulement (le réglage du foyer reste le modèle) :
// tous les membres du foyer, cochés s'ils sont là. `note` : ce que deviennent les plats de ceux
// qu'on décoche. « Pas de dîner ce jour-là » retire le repas ; « Comme d'habitude » (`changed`)
// le remet comme dans le foyer. Avec `choices`, c'est « Un repas en plus » : on choisit d'abord
// le repas parmi ceux qui n'ont pas lieu ce jour-là, puis « Ajouter ».
export function WeekMealPanel({
  title,
  members,
  selected,
  onChange,
  note,
  changed = false,
  meal,
  choices,
  onMealChange,
  onValidate,
  onNoMeal,
  onUsual,
}: {
  title: string;
  members: readonly PickerMember[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  note: string | null;
  changed?: boolean;
  meal: MealType;
  choices?: readonly MealType[];
  onMealChange?: (meal: MealType) => void;
  onValidate: () => void;
  onNoMeal?: () => void;
  onUsual?: () => void;
}) {
  const adding = choices !== undefined;
  return (
    <>
      <SheetHeader>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>Pour cette semaine seulement.</SheetDescription>
      </SheetHeader>
      {adding && (
        <fieldset className="mb-5">
          <legend className="text-xl">Quel repas ?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {choices.map((choice) => (
              <ChoiceChip
                key={choice}
                type="radio"
                name="repas-en-plus"
                value={choice}
                checked={choice === meal}
                onChange={() => onMealChange?.(choice)}
              >
                {labelOf(choice)}
              </ChoiceChip>
            ))}
          </div>
        </fieldset>
      )}
      <EatersPicker
        label="Qui est là ?"
        labelHidden={!adding}
        members={members}
        selected={selected}
        onChange={onChange}
        memberLabel={(name) => `${name} est là`}
      />
      {note && <p className="mt-3 text-[0.9375rem] text-muted-foreground">{note}</p>}
      <Button block size="lg" className="mt-5" disabled={selected.length === 0} onClick={onValidate}>
        {adding ? "Ajouter" : "Valider"}
      </Button>
      {!adding && onNoMeal && (
        <Button variant="ghost" block className="mt-2 text-muted-foreground" onClick={onNoMeal}>
          <Trash2 aria-hidden="true" />
          Pas de {labelOf(meal).toLowerCase()} ce jour-là
        </Button>
      )}
      {!adding && changed && onUsual && (
        <p className="mt-1 text-center">
          <Button variant="link" onClick={onUsual}>
            Comme d’habitude
          </Button>
        </p>
      )}
    </>
  );
}

// Les présents d'un repas, en petits avatars, à côté de son nom : les toucher ouvre « Qui est là ? ».
export function MealAttendees({
  label,
  members,
  onOpen,
  className,
}: {
  // « Qui est là au dîner de lundi ? »
  label: string;
  members: AvatarMember[];
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={label}
      title={label}
      className={cn(
        "press inline-flex min-h-11 shrink-0 items-center rounded-full px-1.5 outline-none hover:bg-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring xl:min-h-9",
        className,
      )}
    >
      <MemberAvatars members={members} size="xs" max={3} decorative />
    </button>
  );
}
