"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { cn } from "cn";
import { FieldError } from "@/components/field";
import { Button } from "@/components/ui/button";
import type { LeaveConsequence } from "@/lib/household-accounts";
import { leaveHouseholdAction } from "./actions";

// « Quitter ce foyer », discret, au-dessus de « Se déconnecter » : la confirmation dit ce qui va
// se passer (foyer supprimé, quelqu'un d'autre pourra inviter, ou rien de plus).
export function LeaveHousehold({ consequence, successor }: { consequence: LeaveConsequence; successor: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // En bas de page, l'encadré s'ouvrirait sous la barre d'onglets : on l'amène en vue.
  useEffect(() => {
    if (confirming) box.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [confirming]);

  if (!confirming) {
    return (
      <Button type="button" variant="link" className="text-muted-foreground" onClick={() => setConfirming(true)}>
        Quitter ce foyer
      </Button>
    );
  }

  const deletes = consequence === "delete_household";
  const message = deletes
    ? "Tu es la seule personne du foyer : il sera supprimé avec ses recettes, ses menus et sa liste."
    : consequence === "promote_oldest" && successor
      ? `${successor} pourra désormais inviter.`
      : "Tu ne verras plus les menus ni la liste de ce foyer.";

  function leave() {
    setError(null);
    startTransition(async () => {
      const result = await leaveHouseholdAction();
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div ref={box} className="w-full space-y-3 rounded-2xl border-2 border-destructive/40 p-4 text-center">
      <p className="font-semibold">Quitter ce foyer ?</p>
      <p role="alert" className={cn(deletes ? "font-semibold text-tomato-deep" : "text-muted-foreground")}>
        {message}
      </p>
      {error && <FieldError alert>{error}</FieldError>}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button type="button" variant="destructive" disabled={pending} onClick={leave}>
          <LogOut aria-hidden="true" />
          {pending ? "Un instant…" : "Oui, quitter"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Non, rester
        </Button>
      </div>
    </div>
  );
}
