"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

// À droite du header, pour un visiteur. Sur téléphone, « Se connecter » seul : le grand bouton
// d'inscription de la page d'accueil est juste dessous. Rien sur les pages de connexion, qui
// ont déjà leur choix « Se connecter / Créer un compte ».
export function GuestActions() {
  const pathname = usePathname();
  if (pathname === "/connexion" || pathname.startsWith("/connexion/")) return null;

  return (
    <div className="ml-auto flex items-center gap-2">
      <Button asChild variant="ghost" size="sm" className="text-foreground">
        <Link href="/connexion">Se connecter</Link>
      </Button>
      <Button asChild size="sm" className="max-sm:hidden">
        <Link href="/connexion/inscription">Créer mon compte</Link>
      </Button>
    </div>
  );
}
