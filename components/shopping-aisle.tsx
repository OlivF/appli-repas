"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { AisleIcon } from "@/components/aisle-icon";
import type { GroceryAisle } from "@/lib/recipes";

// Un rayon de la liste : icône, titre, ce qui reste à prendre, puis ses articles. Tout pris : il se
// replie (on peut le rouvrir) ; il se rouvre de lui-même si un article est décoché.
export function ShoppingAisle({
  aisle,
  label,
  remaining,
  children,
}: {
  aisle: GroceryAisle;
  label: string;
  remaining: number;
  children: ReactNode;
}) {
  const titleId = useId();
  const listId = useId();
  const done = remaining === 0;
  const [opened, setOpened] = useState(false);
  const [wasDone, setWasDone] = useState(done);
  // Un rayon qui redevient « tout pris » se replie à nouveau.
  if (done !== wasDone) {
    setWasDone(done);
    if (done) setOpened(false);
  }
  const expanded = !done || opened;

  const icon = (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full",
        done ? "bg-sage-soft text-sage-deep" : "bg-tomato-soft text-tomato-deep",
      )}
    >
      <AisleIcon aisle={aisle} className="size-5" />
    </span>
  );

  return (
    <section aria-labelledby={titleId} className="rounded-3xl border border-border/80 bg-card px-4 pt-3 pb-1 shadow-soft">
      {done ? (
        <h2 id={titleId} className="text-[1.375rem] leading-tight">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setOpened((open) => !open)}
            className="press -mx-1 flex min-h-12 w-[calc(100%+0.5rem)] items-center gap-3 rounded-2xl px-1 pb-2 text-left"
          >
            {icon}
            <span className="min-w-0 flex-1">
              <span className="block">{label}</span>
              <span className="block font-sans text-[0.9375rem] font-semibold text-sage-deep">Tout est pris</span>
            </span>
            <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </button>
        </h2>
      ) : (
        <div className="flex min-h-12 items-center gap-3 pb-2">
          {icon}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[1.375rem] leading-tight">
              {label}
            </h2>
            <p className="text-[0.9375rem] font-semibold text-muted-foreground">{remaining} à prendre</p>
          </div>
        </div>
      )}
      {expanded && (
        <ul id={listId} className="border-t border-border/70">
          {children}
        </ul>
      )}
    </section>
  );
}

// Une section repliable sous la liste (Placard, Déjà à la maison), fermée au départ.
export function ShoppingFold({
  icon,
  title,
  hint,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-3xl border-2 border-dashed border-border bg-card/60 px-4 py-1">
      <h2 className="text-[1.375rem] leading-tight">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((value) => !value)}
          className="press flex min-h-14 w-full items-center gap-3 rounded-2xl text-left"
        >
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-oat-soft text-oat-deep">
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block">{title}</span>
            <span className="block font-sans text-[0.9375rem] font-normal text-muted-foreground">{hint}</span>
          </span>
          <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      {open && (
        <ul id={listId} className="border-t border-border/70">
          {children}
        </ul>
      )}
    </section>
  );
}
