"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// Au-dessus de la barre d'onglets du téléphone (et de la zone sûre du bas).
const ABOVE_NAV = "calc(4.75rem + max(0.375rem, env(safe-area-inset-bottom)))";

// Les petits messages du bas de l'écran (« Rangé au frigo », « Fini · Annuler »), shadcn/ui
// (Sonner) habillé aux couleurs de Popote par nos variables CSS : ils suivent le mode sombre.
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: ABOVE_NAV }}
      mobileOffset={{ bottom: ABOVE_NAV, left: "0.75rem", right: "0.75rem" }}
      duration={5000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-2xl border border-border bg-card py-2 pr-2 pl-4 text-base text-card-foreground shadow-lift sm:w-[var(--width)]",
          content: "min-w-0 flex-1",
          title: "font-semibold leading-snug",
          icon: "text-sage-deep",
          actionButton:
            // Pas « text-link » : cette classe porte aussi l'ancien style des liens soulignés.
            "press inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-base font-bold text-tomato-deep outline-offset-2 hover:bg-muted",
        },
      }}
      {...props}
    />
  );
}
