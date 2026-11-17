import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

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
    <label className="press group relative inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-card py-2 pr-3.5 pl-2.5 text-base font-semibold shadow-soft select-none hover:border-input/60 has-checked:border-primary has-checked:bg-tomato-soft has-checked:text-tomato-deep has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-ring">
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
