import type { ReactNode } from "react";
import { SiteFooter } from "@/components/layout/site-footer";

// Pages publiques : l'accueil et les pages légales, avec leur pied de page.
// `data-site` : le header aligne alors son contenu sur celui de ces pages (voir HeaderFrame).
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div data-site>
      {children}
      <SiteFooter />
    </div>
  );
}
