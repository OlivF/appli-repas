import { cn } from "cn";
import { COCOTTE_PARTS } from "./cocotte";

type Tone = "color" | "mono";

// La cocotte seule. En couleur : tomate (fill-primary, plus vive en mode sombre) et couvercle
// brun qui devient crème en mode sombre (fill-foreground). En monochrome : la couleur du texte.
export function LogoMark({ tone = "color", className }: { tone?: Tone; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      {COCOTTE_PARTS.map((part) => (
        <path
          key={part.d}
          d={part.d}
          className={tone === "mono" ? "fill-current" : part.color === "tomato" ? "fill-primary" : "fill-foreground"}
        />
      ))}
    </svg>
  );
}

// Le logo de Popote. `full` : la cocotte et le nom en Fraunces 600. Tout suit la taille du
// texte : <Logo className="text-[2rem]" /> agrandit l'ensemble.
export function Logo({
  variant = "full",
  tone = "color",
  className,
}: {
  variant?: "icon" | "full";
  tone?: Tone;
  className?: string;
}) {
  if (variant === "icon") return <LogoMark tone={tone} className={className} />;
  return (
    <span className={cn("inline-flex items-center gap-[0.4em] font-heading text-[1.5rem] leading-none", className)}>
      <LogoMark tone={tone} className="size-[1.4em]" />
      Popote
    </span>
  );
}
