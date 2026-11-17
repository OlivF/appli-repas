import { cn } from "cn";

// La marque : une tomate et sa feuille, puis « Nos repas » en Fraunces.
export function TomatoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <circle cx="16" cy="18" r="12" fill="#e4572e" />
      <path d="M10 13.5c2.2 1.4 4.2 1.6 6 .4 1.8 1.2 3.8 1 6-.4" fill="none" stroke="#a33c1b" strokeWidth="1.4" strokeLinecap="round" opacity=".45" />
      <path d="M16 7.5c-.6-2.2.2-3.8 2-4.6" fill="none" stroke="#4e6b42" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 8c-3.2-2.6-6.4-1.8-7.4.6 2.8 1.4 5.2 1.2 7.4-.6Zm0 0c3-2.8 6.4-2.2 7.6.2-2.8 1.6-5.4 1.6-7.6-.2Z" fill="#7c9a6d" />
      <ellipse cx="11.5" cy="15.5" rx="2.2" ry="1.3" fill="#fff" opacity=".35" transform="rotate(-30 11.5 15.5)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <TomatoMark />
      <span className="font-heading text-[1.375rem] leading-none">Nos repas</span>
    </span>
  );
}
