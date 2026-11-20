"use client";

import { CircleCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoredFlag } from "@/components/use-stored-flag";

// Le bilan d'une semaine finie : « Semaine du 16 nov. terminée : on a retiré ce qui a été
// cuisiné. Il te reste 6 articles. » Il reste là tant qu'on ne l'a pas fermé (sur ce téléphone).
export function SettlementNotice({ listId, text }: { listId: string; text: string }) {
  const [closed, close] = useStoredFlag("local", `popote:bilan-ferme:${listId}`, true);
  if (closed) return null;

  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-sage-soft py-2 pr-1 pl-4 text-sage-deep">
      <CircleCheck aria-hidden="true" className="mt-2.5 size-5 shrink-0" />
      <p className="flex-1 py-2 font-semibold">{text}</p>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Fermer" onClick={close} className="text-sage-deep">
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
