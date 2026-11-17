import type { ReactNode } from "react";
import { cn } from "cn";

// Cadre d'un écran de l'appli, à côté de la barre d'onglets : marges et largeur de lecture.
// `narrow` : pour une fiche ou un formulaire, qu'on lit de haut en bas.
// `wide` : pour la grille de la semaine, sept colonnes côte à côte.
export function AppPage({
  children,
  narrow = false,
  wide = false,
}: {
  children: ReactNode;
  narrow?: boolean;
  wide?: boolean;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full px-5 pt-6 sm:px-8 lg:pt-10",
        narrow ? "max-w-2xl" : wide ? "max-w-[100rem]" : "max-w-5xl",
      )}
    >
      {children}
    </main>
  );
}
