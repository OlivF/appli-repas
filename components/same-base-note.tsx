import { Link } from "lucide-react";
import { cn } from "cn";

// Deux plats du même repas qui partagent leur élément principal : une seule cuisson.
export function SameBaseNote({ base, className }: { base: string; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-muted-foreground", className)}>
      <Link aria-hidden="true" className="size-3.5 shrink-0" />
      Même base : {base.toLocaleLowerCase("fr")}
    </p>
  );
}
