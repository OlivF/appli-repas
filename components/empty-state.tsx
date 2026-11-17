import type { ReactNode } from "react";
import { cn } from "cn";

// État vide : une illustration, ce qui manque, et le geste pour y remédier.
export function EmptyState({
  illustration,
  title,
  children,
  action,
  className,
}: {
  illustration: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-3xl border-2 border-dashed border-border bg-card/60 px-6 py-10 text-center",
        className,
      )}
    >
      {illustration}
      <h2 className="mt-5 text-[1.625rem] leading-tight">{title}</h2>
      {children && <p className="mt-2 max-w-[32ch] text-base text-muted-foreground">{children}</p>}
      {action && <div className="mt-6 w-full max-w-xs">{action}</div>}
    </div>
  );
}
