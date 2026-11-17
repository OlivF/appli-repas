import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ‹ Semaine du 23 au 29 novembre › : les flèches changent de semaine (l'adresse la garde).
export function WeekPicker({
  label,
  relation,
  prevHref,
  nextHref,
}: {
  label: string;
  relation: "current" | "next" | null;
  prevHref: string;
  nextHref: string;
}) {
  return (
    <nav aria-label="Changer de semaine" className="flex items-center gap-2">
      <Button asChild variant="secondary" size="icon-sm">
        <Link href={prevHref} aria-label="Semaine précédente" scroll={false}>
          <ChevronLeft aria-hidden="true" />
        </Link>
      </Button>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
        <p aria-live="polite" className="font-heading text-[1.25rem] leading-tight">
          {label}
        </p>
        {relation && (
          <Badge variant={relation === "next" ? "sage" : "mustard"}>
            {relation === "next" ? "Semaine prochaine" : "Cette semaine"}
          </Badge>
        )}
      </div>
      <Button asChild variant="secondary" size="icon-sm">
        <Link href={nextHref} aria-label="Semaine suivante" scroll={false}>
          <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
    </nav>
  );
}
