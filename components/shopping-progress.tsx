import { LiveIndicator, type LiveStatus } from "@/components/live-indicator";
import { Progress } from "@/components/ui/progress";

// Le haut de la liste de courses : « 12 sur 30 » et la barre qui avance. À plusieurs comptes,
// `live` : « En direct » ou « Hors ligne » à droite du compteur.
export function ShoppingProgress({ done, total, live = null }: { done: number; total: number; live?: LiveStatus | null }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-[1.625rem] leading-tight tabular-nums">
          {`${done} sur ${total}`}
          <span className="sr-only"> articles pris</span>
        </p>
        {live && <LiveIndicator status={live} />}
      </div>
      <Progress value={total === 0 ? 0 : (done / total) * 100} aria-label="Articles pris" className="mt-2 h-1.5" />
    </div>
  );
}
