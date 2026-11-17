import type { ReactNode } from "react";
import { cn } from "cn";

// Cadre d'un écran de l'appli, à côté de la barre d'onglets : marges et largeur de lecture.
// `narrow` : pour une fiche ou un formulaire, qu'on lit de haut en bas.
export function AppPage({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return (
    <main className={cn("mx-auto w-full px-5 pt-6 sm:px-8 lg:pt-10", narrow ? "max-w-2xl" : "max-w-5xl")}>
      {children}
    </main>
  );
}
