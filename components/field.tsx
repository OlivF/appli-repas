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

// Rangée de puces de filtre : sur téléphone elle défile au doigt sans prendre de hauteur,
// sur ordinateur elle passe à la ligne. Le titre n'est lu que par les lecteurs d'écran.
// Une rangée de puces : elle défile sur téléphone, passe à la ligne à partir de 640 px.
// pb-4 / -mb-3 : de la place pour l'ombre des puces, que le défilement couperait.
export const CHIP_SCROLLER =
  "-mx-5 -mb-3 flex gap-2 overflow-x-auto px-5 pt-1 pb-4 [scrollbar-width:none] sm:mx-0 sm:mb-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-1 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0";

export function ChoiceRow({ legend, children, className }: { legend: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="sr-only">{legend}</legend>
      <div className={CHIP_SCROLLER}>{children}</div>
    </fieldset>
  );
}
