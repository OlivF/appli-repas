"use client";

import { useId, useState } from "react";
import { CookingPot, Minus, Plus, Refrigerator } from "lucide-react";
import { FieldError } from "@/components/field";
import { SwitchField } from "@/components/switch-field";
import { Button } from "@/components/ui/button";

const MAX_PARTS = 50;

// Sous « Voir la recette », pour un plat d'aujourd'hui ou d'un jour passé de la semaine :
// « Pas cuisiné » (ses ingrédients restent au frigo au bilan) et « Il en reste » (un reste de
// plat au frigo, 1 part par défaut). `onLeftover` rend un message d'erreur, ou null ; sans lui,
// pas de « Il en reste » (un yaourt, une pomme). `eaten` : un plat léger, « Pas mangé ».
export function CookedControls({
  skipped,
  onSkippedChange,
  onLeftover,
  eaten = false,
}: {
  skipped: boolean;
  onSkippedChange: (skipped: boolean) => void;
  onLeftover?: (parts: number) => Promise<string | null>;
  eaten?: boolean;
}) {
  const switchId = useId();
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function store() {
    if (saving || !onLeftover) return;
    setSaving(true);
    const message = await onLeftover(parts);
    setSaving(false);
    setError(message);
  }

  return (
    <div className="space-y-3 rounded-2xl bg-muted/70 px-4 py-3">
      <SwitchField
        id={switchId}
        label={eaten ? "Pas mangé" : "Pas cuisiné"}
        description={eaten ? "Il reste au frigo." : "Ses ingrédients restent au frigo."}
        checked={skipped}
        onCheckedChange={onSkippedChange}
      />
      {!onLeftover ? null : open ? (
        <div className="space-y-3 border-t border-border/70 pt-3">
          <p className="font-semibold">Il en reste combien ?</p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Une part de moins"
              disabled={parts <= 1}
              onClick={() => setParts((value) => Math.max(1, value - 1))}
            >
              <Minus aria-hidden="true" />
            </Button>
            <span className="min-w-16 text-center text-lg font-semibold tabular-nums" aria-live="polite">
              {parts} {parts > 1 ? "parts" : "part"}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Une part de plus"
              disabled={parts >= MAX_PARTS}
              onClick={() => setParts((value) => Math.min(MAX_PARTS, value + 1))}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
          {error && <FieldError alert>{error}</FieldError>}
          <Button type="button" block onClick={store} disabled={saving}>
            <Refrigerator aria-hidden="true" />
            {saving ? "Rangement…" : "Ranger au frigo"}
          </Button>
        </div>
      ) : (
        <Button type="button" variant="secondary" block onClick={() => setOpen(true)}>
          <CookingPot aria-hidden="true" />
          Il en reste
        </Button>
      )}
    </div>
  );
}
