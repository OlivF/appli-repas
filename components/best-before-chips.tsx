"use client";

import { useId } from "react";
import { ChoiceChip } from "@/components/choice-chip";
import { ChoiceGroup } from "@/components/field";
import { Input } from "@/components/ui/input";
import { DATE_PRESETS, dayDate, type DatePreset } from "@/lib/fridge-items";

export type BestBeforeValue = { preset: DatePreset; custom: string };

// La date limite en puces : « Aujourd'hui », « Demain », « Dans 3 jours », « Dans 1 semaine »,
// « Choisir… » (le calendrier du téléphone), « Pas de date ». Une date choisie s'affiche dans sa
// puce (« jeu. 10 déc. »).
export function BestBeforeChips({
  value,
  onChange,
  today,
  legend = "Date limite",
}: {
  value: BestBeforeValue;
  onChange: (value: BestBeforeValue) => void;
  today: string;
  legend?: string;
}) {
  const name = useId();
  const dateId = useId();
  return (
    <div className="space-y-3">
      <ChoiceGroup legend={legend}>
        {DATE_PRESETS.map((preset) => (
          <ChoiceChip
            key={preset.value}
            type="radio"
            name={name}
            value={preset.value}
            checked={value.preset === preset.value}
            onChange={() => onChange({ ...value, preset: preset.value })}
          >
            {preset.value === "custom" && value.preset === "custom" && value.custom ? dayDate(value.custom, today) : preset.label}
          </ChoiceChip>
        ))}
      </ChoiceGroup>
      {value.preset === "custom" && (
        <div className="space-y-2">
          <label htmlFor={dateId} className="sr-only">
            Choisir la date limite
          </label>
          <Input
            id={dateId}
            type="date"
            value={value.custom}
            onChange={(event) => onChange({ preset: "custom", custom: event.target.value })}
            className="max-w-56"
          />
        </div>
      )}
    </div>
  );
}
