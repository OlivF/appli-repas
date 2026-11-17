"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Bouton d'envoi du design system : désactivé pendant l'envoi, pour éviter les doublons,
// avec un libellé d'attente (« Enregistrement… »).
// `pending` : à fournir quand le formulaire s'envoie lui-même (useActionState), que
// useFormStatus ne voit pas.
export function FormSubmit({
  children,
  pendingLabel,
  pending,
  ...button
}: Omit<ComponentProps<typeof Button>, "type"> & { pendingLabel?: ReactNode; pending?: boolean }) {
  const status = useFormStatus();
  const sending = pending ?? status.pending;
  return (
    <Button {...button} type="submit" disabled={sending || button.disabled}>
      {sending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
