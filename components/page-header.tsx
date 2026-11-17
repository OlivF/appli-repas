import type { ReactNode } from "react";
import { cn } from "cn";

// En-tête d'écran : grand titre Fraunces, une phrase d'explication, une action éventuelle.
export function PageHeader({
  title,
  lead,
  action,
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[2.25rem] leading-[1.08] sm:text-[2.75rem]">{title}</h1>
        {lead && <p className="mt-3 max-w-[38ch] text-lg text-muted-foreground">{lead}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}

// Titre de section, plus petit, avec une action alignée à droite (« Modifier »).
export function SectionHeader({
  id,
  title,
  action,
}: {
  id?: string;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className="text-[1.625rem] leading-tight">
        {title}
      </h2>
      {action}
    </div>
  );
}
