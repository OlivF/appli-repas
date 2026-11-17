"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Bouton d'envoi désactivé pendant l'enregistrement, pour éviter les doubles envois.
export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn btn-${variant}`}>
      {children}
    </button>
  );
}
