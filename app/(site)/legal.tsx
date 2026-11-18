import type { ReactNode } from "react";
import { AppPage } from "@/components/app-page";
import { PageHeader } from "@/components/page-header";

// Gabarit des pages légales : un titre, la date de mise à jour, des rubriques courtes.
// Les passages entre crochets sont à compléter par l'éditeur du site.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <AppPage narrow>
      <div className="pb-16 sm:pb-24">
        <PageHeader title={title} lead={`Mise à jour : ${updated}`} />
        <div className="mt-10 space-y-10">{children}</div>
      </div>
    </AppPage>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[1.625rem] leading-tight">{title}</h2>
      <div className="space-y-3 text-foreground/85 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">{children}</div>
    </section>
  );
}

// Un passage à compléter, bien visible.
export function ToFill({ children }: { children: ReactNode }) {
  return <mark className="rounded-md bg-mustard-soft px-1.5 py-0.5 text-mustard-deep">[{children}]</mark>;
}
