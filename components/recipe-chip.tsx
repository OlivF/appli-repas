import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { CHIP_FRAME } from "@/components/choice-chip";
import { DietBadge } from "@/components/diet-badge";
import { CHIP_SCROLLER } from "@/components/field";

// Une recette en puce : lien vers sa fiche (« Se marie avec »), bouton pour la choisir
// (« Les basiques »), ou simple pastille à glisser. La pastille Céto la signale d'un coup d'œil.
export function RecipeChip({
  label,
  keto = false,
  href,
  onClick,
  className,
}: {
  label: ReactNode;
  keto?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      {keto && <DietBadge diet="keto" />}
    </>
  );
  const frame = cn(CHIP_FRAME, "pl-3.5 whitespace-nowrap", keto ? "pr-2" : "pr-3.5", className);
  const interactive =
    "press cursor-pointer outline-none hover:border-input/60 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-ring";

  if (href) {
    return (
      <Link href={href} className={cn(frame, interactive)}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(frame, interactive)}>
        {content}
      </button>
    );
  }
  return <span className={frame}>{content}</span>;
}

// Une rangée de recettes en puces, avec son libellé (« Se marie avec », « Steak haché ») :
// elle défile sur téléphone, passe à la ligne sur ordinateur. `children` : des <li>.
export function RecipeChipRow({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p id={id} className="text-[0.9375rem] font-semibold text-muted-foreground">
        {label}
      </p>
      <ul aria-labelledby={id} className={cn(CHIP_SCROLLER, "mt-1")}>
        {children}
      </ul>
    </div>
  );
}
