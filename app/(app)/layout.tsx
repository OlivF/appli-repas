import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";

// Écrans de l'appli une fois le foyer créé : la barre d'onglets en bas sur téléphone ; à partir
// de 1024 px, la navigation est dans le header. Le parcours /bienvenue reste sans barre.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      <div className="pb-32 lg:pb-16">{children}</div>
    </>
  );
}
