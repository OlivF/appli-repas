"use client";

import type { ComponentProps, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Un réglage oui / non : le libellé et son explication à gauche, l'interrupteur à droite.
// Dans un formulaire, l'interrupteur envoie « on » sous son `name` quand il est activé.
export function SwitchField({
  id,
  label,
  description,
  ...props
}: Omit<ComponentProps<typeof Switch>, "id"> & { id: string; label: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        {description && (
          <p id={`${id}-description`} className="mt-0.5 text-[0.9375rem] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Switch id={id} aria-describedby={description ? `${id}-description` : undefined} {...props} />
    </div>
  );
}
