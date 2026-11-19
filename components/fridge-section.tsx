import { useId, type ReactNode } from "react";
import { cn } from "cn";

// Une section du frigo, en carte comme un rayon de la liste : icône, titre, une phrase, puis
// les articles (ou des groupes). `urgent` : « À finir vite », en tomate.
export function FridgeSection({
  title,
  hint,
  icon,
  urgent = false,
  children,
}: {
  title: string;
  hint?: string;
  icon: ReactNode;
  urgent?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="rounded-3xl border border-border/80 bg-card px-4 pt-3 pb-1 shadow-soft">
      <div className="flex min-h-12 items-center gap-3 pb-2">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5",
            urgent ? "bg-tomato-soft text-tomato-deep" : "bg-sage-soft text-sage-deep",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-[1.375rem] leading-tight">
            {title}
          </h2>
          {hint && <p className="text-[0.9375rem] font-semibold text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

// Un groupe dans une section (« Plats », un rayon) : un petit titre et ses articles.
export function FridgeGroup({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  const titleId = useId();
  return (
    <div className="border-t border-border/70 pt-2">
      <h3 id={titleId} className="flex items-center gap-2 font-sans text-[0.9375rem] font-semibold text-muted-foreground [&_svg]:size-4">
        <span aria-hidden="true">{icon}</span>
        {label}
      </h3>
      <ul aria-labelledby={titleId}>{children}</ul>
    </div>
  );
}
