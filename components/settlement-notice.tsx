"use client";

import { useSyncExternalStore } from "react";
import { CircleCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_PREFIX = "popote:bilan-ferme:";

// La fermeture est retenue sur ce téléphone, par liste (et pour la visite, sans stockage).
const listeners = new Set<() => void>();
const closedThisVisit = new Set<string>();
function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isClosed(listId: string) {
  if (closedThisVisit.has(listId)) return true;
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + listId) === "1";
  } catch {
    return false;
  }
}

// Le bilan d'une semaine finie : « Semaine du 16 nov. terminée : on a retiré ce qui a été
// cuisiné. Il te reste 6 articles. » Il reste là tant qu'on ne l'a pas fermé.
export function SettlementNotice({ listId, text }: { listId: string; text: string }) {
  // Côté serveur, fermé : rien ne clignote si on l'avait déjà fermé.
  const closed = useSyncExternalStore(subscribe, () => isClosed(listId), () => true);
  if (closed) return null;

  function close() {
    closedThisVisit.add(listId);
    try {
      window.localStorage.setItem(STORAGE_PREFIX + listId, "1");
    } catch {
      // Navigation privée : l'encart se ferme pour cette visite seulement.
    }
    listeners.forEach((listener) => listener());
  }

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
