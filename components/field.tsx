import type { ReactNode } from "react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";

// Un champ : son libellé, la saisie, puis une aide ou une erreur.
// Passe `describedBy` et `invalid` à la saisie pour la relier à l'aide et à l'erreur.
export function Field({
  id,
  label,
  help,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (props: { describedBy?: string; invalid?: true }) => ReactNode;
}) {
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ describedBy, invalid: error ? true : undefined })}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        help && (
          <p id={`${id}-help`} className="text-[0.9375rem] text-muted-foreground">
            {help}
          </p>
        )
      )}
    </div>
  );
}

export function FieldError({
  id,
  alert = false,
  children,
}: {
  id?: string;
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role={alert ? "alert" : undefined}
      className="text-[0.9375rem] font-semibold text-destructive"
    >
      {children}
    </p>
  );
}

// Groupe de puces (régimes, appétit) : un titre de groupe et les choix à la suite.
export function ChoiceGroup({ legend, children }: { legend: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-base leading-snug font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
