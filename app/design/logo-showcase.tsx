import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-2.5">
      <p className="text-[0.875rem] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

// Le logo retenu (la cocotte au cœur) et ses déclinaisons, tels que l'appli les utilise.
export function LogoShowcase() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      <div className="grid place-items-center rounded-3xl border border-border/70 bg-card py-12 shadow-soft">
        <Logo variant="icon" className="size-32" />
      </div>
      <div className="grid gap-7 rounded-3xl border border-border/70 bg-card p-6 shadow-soft sm:grid-cols-2">
        <Row label="Logo horizontal">
          <Logo className="text-[1.875rem]" />
        </Row>
        <Row label="Icône seule : 16, 32 et 64 px">
          <div className="flex items-end gap-5">
            <Logo variant="icon" className="size-4" />
            <Logo variant="icon" className="size-8" />
            <Logo variant="icon" className="size-16" />
          </div>
        </Row>
        <Row label="Monochrome">
          <div className="grid gap-2">
            <div className="rounded-xl bg-[#fbf7f0] px-4 py-3 text-[#2b2118] ring-1 ring-border/60">
              <Logo tone="mono" />
            </div>
            <div className="rounded-xl bg-[#1e1611] px-4 py-3 text-[#f6eee3]">
              <Logo tone="mono" />
            </div>
          </div>
        </Row>
        <Row label="Icône de l’appli et onglet">
          <div className="flex items-end gap-4">
            <span className="grid size-16 place-items-center rounded-[1.125rem] bg-tomato text-[#fffdf9] shadow-soft">
              <Logo variant="icon" tone="mono" className="size-10" />
            </span>
            <span className="flex items-center gap-2 rounded-t-xl bg-muted px-3 py-2 text-[0.8125rem] whitespace-nowrap">
              <Logo variant="icon" className="size-4" />
              La semaine · Popote
            </span>
          </div>
        </Row>
      </div>
    </div>
  );
}
