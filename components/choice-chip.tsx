import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

// Le cadre commun des puces : filtres et choix (ChoiceChip), recettes (RecipeChip).
export const CHIP_FRAME =
  "inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-border bg-card py-2 text-base font-semibold shadow-soft select-none";

// Une vraie case (ou bouton radio) de formulaire, habillée en puce : tout le cadre est cliquable.
export function ChoiceChip({
  children,
  icon,
  ...input
}: Omit<ComponentProps<"input">, "className" | "children"> & {
  type: "checkbox" | "radio";
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        CHIP_FRAME,
        "press group relative cursor-pointer pr-3.5 pl-2.5 hover:border-input/60 has-checked:border-primary has-checked:bg-tomato-soft has-checked:text-tomato-deep has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ring",
      )}
    >
      <input {...input} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="grid size-5.5 shrink-0 place-items-center rounded-full border-2 border-input bg-card text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground"
      >
        <Check className="size-3" strokeWidth={4} />
      </span>
      {icon && (
        <span aria-hidden="true" className="-ml-0.5 [&_svg]:size-4.5">
          {icon}
        </span>
      )}
      {children}
    </label>
  );
}
