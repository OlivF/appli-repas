"use client";

import Link from "next/link";
import { useTransition } from "react";
import { House, LogOut, Settings } from "lucide-react";
import { cn } from "cn";
import { signOut } from "@/app/connexion/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { accountInitial } from "@/lib/account";

// L'avatar du compte : l'initiale de l'email sur la tomate pâle.
export function AccountAvatar({ email, className }: { email: string | undefined; className?: string }) {
  return (
    <Avatar aria-hidden="true" className={className}>
      <AvatarFallback className="bg-tomato-soft text-lg text-tomato-deep">{accountInitial(email)}</AvatarFallback>
    </Avatar>
  );
}

// Le menu du compte, en haut à droite : Mon foyer, Paramètres, Se déconnecter.
export function AccountMenu({ email }: { email: string | undefined }) {
  const [leaving, startLeaving] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Ton compte"
        className={cn(
          "press grid size-11 place-items-center rounded-full outline-none",
          "hover:ring-4 hover:ring-tomato-soft/70 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring data-[state=open]:ring-4 data-[state=open]:ring-tomato-soft",
        )}
      >
        <AccountAvatar email={email} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {email && <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>}
        <DropdownMenuItem asChild>
          <Link href="/foyer">
            <House aria-hidden="true" />
            Mon foyer
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/parametres">
            <Settings aria-hidden="true" />
            Paramètres
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={leaving}
          // Le menu reste ouvert, « Déconnexion… », jusqu'au départ vers l'accueil.
          onSelect={(event) => {
            event.preventDefault();
            startLeaving(() => signOut());
          }}
        >
          <LogOut aria-hidden="true" />
          {leaving ? "Déconnexion…" : "Se déconnecter"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
