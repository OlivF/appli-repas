import { cn } from "cn";

// L'état du direct d'une liste partagée : en attente de connexion, reçu en direct, coupé.
export type LiveStatus = "connecting" | "live" | "offline";

// « ● En direct » (sauge) ou « ● Hors ligne » (moutarde), à droite du compteur de la liste de
// courses, quand le foyer a plusieurs comptes. Rien tant que la connexion s'établit. Jamais de
// toast : l'autre coche, la case se coche, c'est tout.
export function LiveIndicator({ status, className }: { status: LiveStatus; className?: string }) {
  return (
    <p role="status" className={cn("flex min-h-6 shrink-0 items-center gap-1.5 text-[0.875rem] font-semibold", className)}>
      {status !== "connecting" && (
        <>
          <span
            aria-hidden="true"
            className={cn("size-2.5 rounded-full", status === "live" ? "bg-sage" : "bg-mustard")}
          />
          <span className={status === "live" ? "text-sage-deep" : "text-mustard-deep"}>
            {status === "live" ? "En direct" : "Hors ligne"}
          </span>
        </>
      )}
    </p>
  );
}
